// src/components/cyre-calendar.ts
// Zero-dependency calendar/cron recurrence engine

/*

      C.Y.R.E - C.A.L.E.N.D.A.R

      Pure functions for computing "when does this fire next":
      - Standard 5-field cron ('*', lists, ranges, steps, dom/dow OR-semantics)
      - Plain time-of-day recurrence, optionally restricted to weekdays
      - One-off calendar dates
      - Real IANA timezone + DST correctness via Intl.DateTimeFormat
        (built into Node >=20 and every modern browser - no dependency needed)

      Single source of truth shared by cyre-schedule.ts and
      orchestration-engine.ts, so "when does this run next" is computed the
      same way everywhere instead of duplicated, divergent logic.

*/

export interface RecurrenceTrigger {
  // Specific calendar date, 'YYYY-MM-DD' - fires once, combined with `time`
  // (defaults to '00:00'). Never reschedules past that date.
  date?: string
  // Wall-clock time of day, 'HH:mm'
  time?: string
  // Restrict `time` recurrence to these weekdays (0=Sun..6=Sat). Omitted = every day.
  days?: number[]
  // Standard 5-field cron: 'minute hour day-of-month month day-of-week'
  cron?: string
  // IANA timezone, e.g. 'Europe/London'. Defaults to UTC.
  timezone?: string
}

interface ZonedParts {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number
  minute: number
  second: number
}

// Formatter cache - Intl.DateTimeFormat construction is the expensive part,
// not formatting, so reuse one per timezone rather than building on every call
const formatterCache = new Map<string, Intl.DateTimeFormat>()

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    formatterCache.set(timeZone, formatter)
  }
  return formatter
}

// Wall-clock fields for a UTC instant, as seen in `timeZone`
const getZonedParts = (utcMs: number, timeZone: string): ZonedParts => {
  const parts = getFormatter(timeZone).formatToParts(new Date(utcMs))
  const lookup: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = parseInt(part.value, 10)
  }
  // Intl reports midnight as hour 24 with hour12:false in some engines
  const hour = lookup.hour === 24 ? 0 : lookup.hour
  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour,
    minute: lookup.minute,
    second: lookup.second
  }
}

// UTC-anchored offset (local wall clock minus UTC instant, ms) for a given instant
const getOffsetMs = (utcMs: number, timeZone: string): number => {
  const p = getZonedParts(utcMs, timeZone)
  const asUtcOfLocal = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  )
  return asUtcOfLocal - utcMs
}

// Converts a wall-clock time in `timeZone` to a UTC instant, DST-correct.
// Standard two-pass convergence: guess the offset from a naive UTC
// interpretation, then re-check the offset at the corrected instant in case
// the guess landed on the other side of a DST transition.
const zonedTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): number => {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset1 = getOffsetMs(naiveUtc, timeZone)
  const utc1 = naiveUtc - offset1
  const offset2 = getOffsetMs(utc1, timeZone)
  return offset2 === offset1 ? utc1 : naiveUtc - offset2
}

const weekdayOf = (year: number, month: number, day: number): number =>
  new Date(Date.UTC(year, month - 1, day)).getUTCDay()

// --- cron field parsing ---------------------------------------------------

// '*' | '*/n' | 'a' | 'a-b' | 'a-b/n' | comma-separated list of the above
const parseCronField = (
  field: string,
  min: number,
  max: number
): Set<number> => {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    const [range, stepStr] = part.split('/')
    const step = stepStr ? parseInt(stepStr, 10) : 1
    let start = min
    let end = max

    if (range !== '*') {
      if (range.includes('-')) {
        const [s, e] = range.split('-').map(Number)
        start = s
        end = e
      } else {
        start = end = Number(range)
      }
    }

    if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(step)) {
      throw new Error(`Invalid cron field: "${field}"`)
    }

    for (let v = start; v <= end; v += step) values.add(v)
  }

  return values
}

interface CronSets {
  minute: Set<number>
  hour: Set<number>
  dom: Set<number>
  month: Set<number>
  dow: Set<number>
  domRestricted: boolean
  dowRestricted: boolean
}

const parseCron = (expression: string): CronSets => {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(
      `Invalid cron expression "${expression}" - expected 5 fields (minute hour dom month dow)`
    )
  }
  const [minute, hour, dom, month, dow] = fields
  return {
    minute: parseCronField(minute, 0, 59),
    hour: parseCronField(hour, 0, 23),
    dom: parseCronField(dom, 1, 31),
    month: parseCronField(month, 1, 12),
    dow: parseCronField(dow, 0, 6),
    domRestricted: dom !== '*',
    dowRestricted: dow !== '*'
  }
}

const MAX_LOOKAHEAD_DAYS = 366 * 4 // covers e.g. "Feb 29" style schedules

// Finds the next UTC instant matching `sets`, strictly after `after`.
// Walks calendar days (cheap, timezone-independent arithmetic) and only
// does timezone-aware conversion for the (small) set of matching hour/minute
// combinations on days that already match - not once per minute for years.
const nextCronOccurrence = (
  sets: CronSets,
  timeZone: string,
  after: number
): number | undefined => {
  const start = getZonedParts(after, timeZone)
  const sortedHours = [...sets.hour].sort((a, b) => a - b)
  const sortedMinutes = [...sets.minute].sort((a, b) => a - b)
  const baseDayUtc = Date.UTC(start.year, start.month - 1, start.day)

  for (let dayOffset = 0; dayOffset <= MAX_LOOKAHEAD_DAYS; dayOffset++) {
    const d = new Date(baseDayUtc + dayOffset * 86400000)
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth() + 1
    const day = d.getUTCDate()

    if (!sets.month.has(month)) continue

    const domMatch = sets.dom.has(day)
    const dowMatch = sets.dow.has(weekdayOf(year, month, day))
    const dayMatches =
      sets.domRestricted && sets.dowRestricted
        ? domMatch || dowMatch
        : domMatch && dowMatch

    if (!dayMatches) continue

    for (const h of sortedHours) {
      for (const mi of sortedMinutes) {
        const candidate = zonedTimeToUtc(year, month, day, h, mi, 0, timeZone)
        if (candidate > after) return candidate
      }
    }
  }

  return undefined
}

// --- public API ------------------------------------------------------------

/**
 * Computes the next UTC timestamp (ms) a recurrence trigger should fire,
 * strictly after `after`. Returns undefined when the trigger can never fire
 * again (a one-off `date` that has already passed, or a search that exceeds
 * the lookahead bound).
 *
 * Pure and side-effect free - callers own scheduling (TimeKeeper) and
 * rescheduling after each fire.
 */
export const computeNextOccurrence = (
  trigger: RecurrenceTrigger,
  after: number = Date.now()
): number | undefined => {
  const timeZone = trigger.timezone || 'UTC'

  if (trigger.date) {
    const [year, month, day] = trigger.date.split('-').map(Number)
    const [hour, minute] = (trigger.time || '00:00').split(':').map(Number)
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
      throw new Error(
        `Invalid calendar trigger date/time: ${trigger.date} ${trigger.time}`
      )
    }
    const occurrence = zonedTimeToUtc(
      year,
      month,
      day,
      hour,
      minute,
      0,
      timeZone
    )
    return occurrence > after ? occurrence : undefined
  }

  if (trigger.cron) {
    return nextCronOccurrence(parseCron(trigger.cron), timeZone, after)
  }

  if (trigger.time) {
    const [hour, minute] = trigger.time.split(':').map(Number)
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      throw new Error(`Invalid time trigger: "${trigger.time}"`)
    }
    // Reuse the cron engine: fixed minute/hour, unrestricted dom/month,
    // dow restricted to `days` when given
    const sets: CronSets = {
      minute: new Set([minute]),
      hour: new Set([hour]),
      dom: parseCronField('*', 1, 31),
      month: parseCronField('*', 1, 12),
      dow: trigger.days?.length
        ? new Set(trigger.days)
        : parseCronField('*', 0, 6),
      domRestricted: false,
      dowRestricted: !!trigger.days?.length
    }
    return nextCronOccurrence(sets, timeZone, after)
  }

  return undefined
}

export default {computeNextOccurrence}
