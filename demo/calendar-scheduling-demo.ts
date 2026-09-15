// demo/calendar-scheduling-demo.ts
// Exercises the calendar/recurrence layer built on top of TimeKeeper:
// src/components/cyre-calendar.ts (computeNextOccurrence - real 5-field cron,
// IANA timezone + DST via Intl.DateTimeFormat, one-off calendar dates,
// weekday-restricted daily triggers), TimeKeeper's own `recompute` hook
// (types/timer.ts's Timer['recompute'], used by both the normal
// post-execution reschedule path and resume() after a pause - see section
// 3b), cyre-schedule.ts (consumes recompute instead of the old
// fixed-interval-forever bug, or the workaround-of-a-workaround that
// replaced it before recompute existed), and the matching `schedule` field
// wired up on orchestration.ts's OrchestrationTrigger (cron-based
// orchestration triggers, previously a dead/unused field on the type).
//
// One thing worth knowing before reading the asserts below: cron here only
// accepts numeric fields (0-6 for day-of-week, no MON/TUE/... aliases, no
// 7-as-Sunday). The OLD calculateCronNext() this replaced only ever matched
// three hardcoded string patterns ('0 9 * * MON' etc.) and fell through to
// "try again in 1 minute" for anything else - so this is already strictly
// more capable - but named weekday aliases were out of scope for this pass
// and are not supported. Section 1 flags this explicitly rather than
// silently working around it.
//
// `cyre.schedule` is now wired onto the public cyre object (app.ts's
// `//schedule,` and `//import {schedule} ...` were previously commented
// out - this demo used to import cyre-schedule.ts directly by path because
// of that). computeNextOccurrence() and TimeKeeper are still internal, so
// those two stay direct module imports for the pure-math and armed-timer
// checks in sections 1 and 2d.
import {cyre, log} from '../src'
import {computeNextOccurrence} from '../src/components/cyre-calendar'
import {TimeKeeper} from '../src/components/cyre-timekeeper'

const schedule = cyre.schedule

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const pad2 = (n: number) => String(n).padStart(2, '0')

// Formats a UTC ms instant as HH:mm inside an IANA timezone, for round-trip
// checks - just Intl, same primitive cyre-calendar.ts itself is built on.
const hhmmInZone = (utcMs: number, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })
  const parts = formatter.formatToParts(new Date(utcMs))
  const hour = parts.find(p => p.type === 'hour')?.value ?? '??'
  const minute = parts.find(p => p.type === 'minute')?.value ?? '??'
  return `${hour === '24' ? '00' : hour}:${minute}`
}

await cyre.init()

// =============================================================================
// 0) REGISTER CHANNELS  →  the targets every schedule/orchestration trigger
//    below calls into. Deliberately NOT calling cyre.lock() in this demo:
//    orchestration.keep() (section 4) IS gated by metricsState.canRegister()
//    the same way cyre.action()/cyre.on() are, and section 4 needs to call
//    keep() with a freshly-computed cron expression close to when it
//    activates - locking here up front would make that keep() call fail
//    with "system is locked" the moment it ran. schedule.task() itself is
//    NOT gated by lock() (it never calls metricsState.canRegister()), so
//    that asymmetry isn't actually exercised by this demo either way.
// =============================================================================
console.log('\n=== 0) registering channels ===')

let digestCount = 0
const digestPayloads: any[] = []
cyre.action({id: 'daily/digest'})
cyre.on('daily/digest', (payload: any) => {
  digestCount++
  digestPayloads.push(payload)
  log.debug(`  📰 daily/digest #${digestCount}: ${JSON.stringify(payload)}`)
  return {sent: true}
})

let reminderCount = 0
cyre.action({id: 'reminder/fire'})
cyre.on('reminder/fire', (payload: any) => {
  reminderCount++
  log.debug(`  ⏰ reminder/fire #${reminderCount}: ${JSON.stringify(payload)}`)
  return {reminded: true}
})

let cronTickCount = 0
const cronTickTimes: number[] = []
cyre.action({id: 'cron/tick'})
cyre.on('cron/tick', () => {
  cronTickCount++
  cronTickTimes.push(Date.now())
  log.debug(`  🕐 cron/tick #${cronTickCount} at ${new Date().toISOString()}`)
  return {ticked: true}
})

let orchestrationCronCount = 0
cyre.action({id: 'orchestration/cron-log'})
cyre.on('orchestration/cron-log', () => {
  orchestrationCronCount++
  return {logged: true}
})

let pauseResumeCount = 0
const pauseResumeTimes: number[] = []
cyre.action({id: 'pause-resume/tick'})
cyre.on('pause-resume/tick', () => {
  pauseResumeCount++
  pauseResumeTimes.push(Date.now())
  log.debug(
    `  ⏸️  pause-resume/tick #${pauseResumeCount} at ${new Date().toISOString()}`
  )
  return {ticked: true}
})

console.log('  channels registered')

// =============================================================================
// 1) PURE CALENDAR MATH  →  computeNextOccurrence() is a pure function
//    (no timers, no waiting) - every case here is deterministic given a
//    fixed `after` reference point, so this is where the real correctness
//    checking happens rather than in the slower live-timer sections below.
// =============================================================================
console.log('\n=== 1) cyre-calendar.ts: pure recurrence math ===')

// 1a) Daily cron in UTC - no DST to worry about, so two consecutive
// occurrences MUST be exactly 24h apart. This is the direct check against
// the bug being fixed: the old code would compute one initial delay and then
// repeat forever on THAT interval, so a schedule made mid-day would never
// actually land on 09:00 again after day one.
{
  const after = Date.UTC(2026, 0, 15, 3, 0, 0) // 2026-01-15 03:00 UTC
  const first = computeNextOccurrence(
    {cron: '0 9 * * *', timezone: 'UTC'},
    after
  )
  const second = computeNextOccurrence(
    {cron: '0 9 * * *', timezone: 'UTC'},
    first!
  )
  const firstParts = new Date(first!)
  const gapHours = (second! - first!) / 3600000
  console.log(
    `  first: ${firstParts.toISOString()}, second: ${new Date(second!).toISOString()}, gap: ${gapHours}h`
  )
  console.log(
    firstParts.getUTCHours() === 9 &&
      firstParts.getUTCMinutes() === 0 &&
      gapHours === 24
      ? '✅ daily 09:00 UTC cron lands on 09:00 exactly, and stays exactly 24h apart on the next occurrence'
      : '❌ daily cron did not land on 09:00 or drifted off a 24h cadence'
  )
}

// 1b) Weekday-restricted cron (Mon-Fri only, numeric dow)
{
  const after = Date.UTC(2026, 0, 15, 0, 0, 0) // a Thursday
  const occurrence = computeNextOccurrence(
    {cron: '30 8 * * 1-5', timezone: 'UTC'},
    after
  )
  const weekday = new Date(occurrence!).getUTCDay()
  console.log(
    `  next weekday-8:30 occurrence: ${new Date(occurrence!).toISOString()} (weekday ${weekday})`
  )
  console.log(
    weekday >= 1 && weekday <= 5
      ? '✅ "1-5" dow range correctly restricts occurrences to Monday-Friday'
      : `❌ expected a weekday (1-5), got weekday ${weekday}`
  )
}

// 1c) dom/dow OR-semantics - standard cron rule: when BOTH day-of-month and
// day-of-week are restricted (neither is '*'), a day matches if EITHER
// field matches, not both. '0 0 1 * 1' = midnight on the 1st of the month
// OR any Monday.
{
  const after = Date.UTC(2026, 0, 15, 0, 0, 0)
  const occurrence = computeNextOccurrence(
    {cron: '0 0 1 * 1', timezone: 'UTC'},
    after
  )
  const d = new Date(occurrence!)
  const matchesDom = d.getUTCDate() === 1
  const matchesDow = d.getUTCDay() === 1
  console.log(`  next "1st-of-month OR Monday" occurrence: ${d.toISOString()}`)
  console.log(
    matchesDom || matchesDow
      ? '✅ dom/dow OR-semantics honored (day matched by date-of-month or weekday, not required to match both)'
      : '❌ occurrence matched neither the day-of-month nor the day-of-week field'
  )
  console.log(
    'ℹ️  named weekday aliases (MON/TUE/...) are NOT supported by this parser - only numeric 0-6 - ' +
      'unlike the old calculateCronNext(), which ONLY matched 3 hardcoded named-weekday strings and nothing else'
  )
}

// 1d) Step values
{
  const after = Date.UTC(2026, 0, 15, 1, 0, 0)
  const occurrence = computeNextOccurrence(
    {cron: '0 */4 * * *', timezone: 'UTC'},
    after
  )
  const hour = new Date(occurrence!).getUTCHours()
  console.log(
    `  next "every 4 hours" occurrence: ${new Date(occurrence!).toISOString()}`
  )
  console.log(
    hour % 4 === 0
      ? '✅ "*/4" step correctly restricts hours to multiples of 4'
      : `❌ expected an hour divisible by 4, got ${hour}`
  )
}

// 1e/1f) One-off calendar dates - past never fires again, future fires once
{
  const pastResult = computeNextOccurrence(
    {date: '2020-01-01', time: '09:00', timezone: 'UTC'},
    Date.now()
  )
  const futureResult = computeNextOccurrence(
    {date: '2030-06-15', time: '14:30', timezone: 'UTC'},
    Date.now()
  )
  const fd = new Date(futureResult!)
  console.log(
    `  past date -> ${pastResult}, future date -> ${fd.toISOString()}`
  )
  console.log(
    pastResult === undefined
      ? '✅ a one-off calendar date already in the past correctly returns undefined (never reschedules)'
      : '❌ a past calendar date should never produce a future occurrence'
  )
  console.log(
    fd.getUTCFullYear() === 2030 &&
      fd.getUTCMonth() === 5 &&
      fd.getUTCDate() === 15 &&
      fd.getUTCHours() === 14 &&
      fd.getUTCMinutes() === 30
      ? '✅ a one-off future calendar date resolves to exactly that date/time'
      : '❌ future calendar date did not resolve to the expected instant'
  )
}

// 1g) Timezone + DST correctness - round-trip through a real IANA zone.
// This doesn't assume anything about the current DST state; it just checks
// that whatever instant computeNextOccurrence picks reads back as 09:00
// when reformatted in that same zone - proving the offset conversion is
// self-consistent regardless of which side of a DST boundary "now" is on.
{
  const occurrence = computeNextOccurrence(
    {time: '09:00', timezone: 'America/New_York'},
    Date.now()
  )
  const readBack = hhmmInZone(occurrence!, 'America/New_York')
  console.log(
    `  next 09:00 America/New_York -> ${new Date(occurrence!).toISOString()} (reads back as ${readBack} there)`
  )
  console.log(
    readBack === '09:00'
      ? '✅ timezone-aware occurrence round-trips correctly through Intl.DateTimeFormat (DST-safe)'
      : `❌ expected the occurrence to read back as 09:00 in its own timezone, got ${readBack}`
  )
}

// 1h) `time` + `days` (the mechanism schedule.weekly() is built on)
{
  const after = Date.UTC(2026, 0, 15, 0, 0, 0) // Thursday
  const occurrence = computeNextOccurrence(
    {time: '12:00', days: [1], timezone: 'UTC'}, // Monday only
    after
  )
  const weekday = new Date(occurrence!).getUTCDay()
  console.log(
    `  next Monday-12:00 occurrence: ${new Date(occurrence!).toISOString()} (weekday ${weekday})`
  )
  console.log(
    weekday === 1
      ? '✅ `days` correctly restricts a `time` trigger to the given weekday(s)'
      : `❌ expected weekday 1 (Monday), got ${weekday}`
  )
}

// =============================================================================
// 2) LIVE TIMEKEEPER INTEGRATION  →  real schedule.*() calls, real timers.
//    2a/2b/2d are quick (<3s total); 2c (onDate) needs a real future minute
//    boundary, so it's defined here but launched later, running
//    concurrently with sections 3/4 instead of blocking serially.
// =============================================================================
console.log('\n=== 2) schedule.*() against the real TimeKeeper ===')

// 2a) once() - fires exactly once
{
  const before = reminderCount
  const result = schedule.once(150, {
    id: 'demo-once',
    channels: ['reminder/fire'],
    payload: {kind: 'once'}
  })
  console.log(`  schedule.once() -> ok:${result.ok} - ${result.message}`)
  await wait(300)
  console.log(`  reminder/fire count: ${reminderCount} (was ${before})`)
  console.log(
    reminderCount === before + 1
      ? '✅ schedule.once() fired exactly once'
      : `❌ expected exactly 1 fire, got ${reminderCount - before}`
  )
  schedule.cancel('demo-once')
}

// 2b) interval() - fires repeatedly, cancel() stops it
{
  const before = reminderCount
  schedule.interval(100, {
    id: 'demo-interval',
    channels: ['reminder/fire'],
    payload: {kind: 'interval'}
  })
  await wait(450) // ~4 ticks
  const midCount = reminderCount
  schedule.cancel('demo-interval')
  await wait(300) // long enough that more ticks WOULD land if still active
  console.log(
    `  reminder/fire count: mid=${midCount - before}, after cancel=${reminderCount - before}`
  )
  console.log(
    midCount - before >= 3 && reminderCount === midCount
      ? '✅ schedule.interval() fired repeatedly, then stopped cleanly on cancel()'
      : `❌ expected several ticks then a clean stop, got mid=${midCount - before} final=${reminderCount - before}`
  )
}

// 2c) onDate() moved below, running concurrently with sections 3/4 - see
// onDateCheck. `date`+`time` triggers are minute-resolution (there's no
// seconds field to give them), same as every other calendar trigger here,
// so it needs to target a real future minute boundary rather than "a couple
// seconds from now" - see the comment on onDateCheck for why the first
// version of this section failed.

// 2d) daily()/weekly() - can't wait real hours in a demo, so this checks the
// ARMED state instead: the trigger should already be registered as a real
// TimeKeeper timer whose nextExecutionTime is a genuine future occurrence
// with the correct hour/minute - proof the calendar engine actually ran,
// without needing to wait for it.
{
  const dailyResult = schedule.daily('09:00', {
    id: 'demo-daily',
    channels: ['daily/digest']
  })
  const weeklyResult = schedule.weekly('monday', '10:30', {
    id: 'demo-weekly',
    channels: ['daily/digest']
  })
  console.log(
    `  schedule.daily() -> ok:${dailyResult.ok}, schedule.weekly() -> ok:${weeklyResult.ok}`
  )

  const formations = TimeKeeper.status().formations
  const dailyTimer = formations.find(f => f.id === 'demo-daily-trigger-0')
  const weeklyTimer = formations.find(f => f.id === 'demo-weekly-trigger-0')

  const dailyNext = dailyTimer
    ? new Date(dailyTimer.nextExecutionTime)
    : undefined
  const weeklyNext = weeklyTimer
    ? new Date(weeklyTimer.nextExecutionTime)
    : undefined
  console.log(`  demo-daily next execution: ${dailyNext?.toISOString()}`)
  console.log(
    `  demo-weekly next execution: ${weeklyNext?.toISOString()} (weekday ${weeklyNext?.getUTCDay()})`
  )

  const dailyOk =
    !!dailyTimer &&
    dailyNext!.getUTCHours() === 9 &&
    dailyNext!.getUTCMinutes() === 0 &&
    dailyNext!.getTime() > Date.now()
  const weeklyOk =
    !!weeklyTimer &&
    weeklyNext!.getUTCDay() === 1 &&
    weeklyNext!.getUTCHours() === 10 &&
    weeklyNext!.getUTCMinutes() === 30

  console.log(
    dailyOk
      ? "✅ schedule.daily('09:00') armed a real TimeKeeper timer pointed at the next 09:00"
      : '❌ demo-daily is not armed with a correct next-09:00 execution time'
  )
  console.log(
    weeklyOk
      ? "✅ schedule.weekly('monday', '10:30') armed a real TimeKeeper timer pointed at the next Monday 10:30"
      : '❌ demo-weekly is not armed with a correct next-Monday-10:30 execution time'
  )

  schedule.cancel('demo-daily')
  schedule.cancel('demo-weekly')
}

// =============================================================================
// 3) THE ACTUAL BUG FIX, LIVE  →  cron granularity is 1 minute, so this is
//    the one section that can't be sped up - it runs a real '* * * * *'
//    ("every minute, at :00 seconds") cron trigger across a live minute
//    boundary and checks that the SECOND fire lands on another :00-seconds
//    boundary. Under the old code, the first fire's delay (whatever was
//    left until the next :00) would have been reused as a fixed repeat
//    interval forever, so the second fire would NOT land back on a :00
//    boundary except by coincidence. Runs concurrently with section 4 below
//    so the two ~1-minute waits overlap instead of stacking serially.
// =============================================================================
console.log(
  '\n=== 3) cron self-rearm across a real minute boundary (~60-90s) ==='
)

// 2c, continued) onDate() - a one-off calendar date/time, exercising the
// SAME `date`-trigger code path as 1e/1f but end-to-end through TimeKeeper
// this time, and confirming it never re-fires (a `date` trigger is never
// re-armed - see armCalendarTrigger's `shouldRearm`).
//
// The target MUST be the next real minute boundary (+ a small buffer), not
// "a couple seconds from now": `date`+`time` triggers only carry HH:mm, no
// seconds, so building the trigger's minute from `Date.now() + 1500`
// truncates away whatever seconds have already elapsed in the CURRENT
// minute. At e.g. 19:19:27.762, `Date.now() + 1500` is still within minute
// 19:19, so the trigger's target (19:19:00) was already 27s in the past by
// the time computeNextOccurrence checked it against `after` - it correctly
// refused to schedule a trigger for a time that had already passed, logged
// as task-trigger-no-future-occurrence, and never fired. This isn't a bug
// in the calendar engine; it's the same minute-only resolution cron itself
// has. Targeting a genuine upcoming boundary avoids the race entirely.
const onDateCheck = (async () => {
  const target = new Date(Date.now() + 60000 - (Date.now() % 60000) + 5000)
  const dateStr = `${target.getUTCFullYear()}-${pad2(target.getUTCMonth() + 1)}-${pad2(target.getUTCDate())}`
  const timeStr = `${pad2(target.getUTCHours())}:${pad2(target.getUTCMinutes())}`
  const before = digestCount

  const result = schedule.onDate(dateStr, timeStr, {
    id: 'demo-ondate',
    channels: ['daily/digest'],
    payload: {kind: 'ondate'}
  })
  console.log(
    `  schedule.onDate('${dateStr}', '${timeStr}') -> ok:${result.ok} - ${result.message}`
  )

  const deadline = Date.now() + 75000
  while (digestCount === before && Date.now() < deadline) {
    await wait(1000)
  }
  const afterFire = digestCount
  await wait(3000) // long enough that a wrongly-repeating trigger would fire again
  console.log(
    `  daily/digest count: right after=${afterFire - before}, well after=${digestCount - before}`
  )
  console.log(
    afterFire - before === 1 && digestCount - before === 1
      ? '✅ schedule.onDate() fired exactly once and never re-armed'
      : `❌ expected exactly 1 fire ever, got ${afterFire - before} then ${digestCount - before}`
  )
  schedule.cancel('demo-ondate')
})()

const cronRearmCheck = (async () => {
  schedule.task({
    id: 'demo-cron-rearm',
    triggers: [
      {
        cron: '* * * * *',
        timezone: 'UTC',
        channels: ['cron/tick'],
        repeat: true
      }
    ]
  })

  // Wait for 2 real fires, polling rather than sleeping a fixed guess
  const deadline = Date.now() + 150000
  while (cronTickCount < 2 && Date.now() < deadline) {
    await wait(1000)
  }

  schedule.cancel('demo-cron-rearm')

  if (cronTickTimes.length < 2) {
    console.log(
      `❌ cron trigger only fired ${cronTickTimes.length} time(s) within the wait window`
    )
    return
  }

  const [firstFire, secondFire] = cronTickTimes
  const gapMs = secondFire - firstFire
  const secondOffsetIntoMinute = secondFire % 60000
  console.log(
    `  fire #1: ${new Date(firstFire).toISOString()}, fire #2: ${new Date(secondFire).toISOString()}, gap: ${gapMs}ms`
  )
  console.log(
    gapMs > 50000 && gapMs < 70000 && secondOffsetIntoMinute < 5000
      ? '✅ the second fire landed on a fresh :00-seconds minute boundary, ~60s after the first - ' +
          "the calendar engine recomputed the occurrence rather than repeating on the first fire's initial delay"
      : `❌ expected a ~60s gap landing back on a :00 boundary, got a ${gapMs}ms gap at offset ${secondOffsetIntoMinute}ms into the minute`
  )
})()

// =============================================================================
// 3b) PAUSE/RESUME ON A CALENDAR TASK  →  the thing TimeKeeper's new
//    `recompute` hook was specifically added to fix. schedule.pause()/
//    resume() delegate straight to TimeKeeper.pause()/resume() - before
//    this change, resume() rescheduled using timer.interval, which for a
//    calendar-armed timer holds whatever fixed delay happened to be
//    computed at ARM time (e.g. "38421ms"), not the calendar rule. Pausing
//    and resuming would reschedule for "resume-time + that stale offset,"
//    landing nowhere near a real minute boundary. Now resume() flows
//    through the same recompute(currentTime) path as a normal reschedule,
//    so it recalculates fresh. This check pauses almost immediately after
//    arming (before the first-ever fire), waits long enough to prove
//    nothing fires while paused, resumes, and checks the newly-armed
//    nextExecutionTime lands back on a genuine :00-seconds boundary rather
//    than an arbitrary resume-time-plus-stale-offset - then waits for the
//    real fire to confirm it end-to-end.
// =============================================================================
const pauseResumeCheck = (async () => {
  schedule.task({
    id: 'demo-pause-resume',
    triggers: [
      {
        cron: '* * * * *',
        timezone: 'UTC',
        channels: ['pause-resume/tick'],
        repeat: true
      }
    ]
  })

  await wait(500) // let it arm before pausing
  const pausedOk = schedule.pause('demo-pause-resume')
  const pausedAt = Date.now()
  console.log(`  schedule.pause() -> ${pausedOk}`)

  await wait(10000) // long enough that a wrongly-still-active timer would tick
  const ticksWhilePaused = pauseResumeCount
  console.log(
    `  pause-resume/tick count after 10s paused: ${ticksWhilePaused} (expected 0)`
  )

  const resumedOk = schedule.resume('demo-pause-resume')
  console.log(`  schedule.resume() -> ${resumedOk}`)

  const resumedTimer = TimeKeeper.status().formations.find(
    f => f.id === 'demo-pause-resume-trigger-0'
  )
  const nextExecution = resumedTimer?.nextExecutionTime
  const offsetIntoMinute =
    nextExecution !== undefined ? nextExecution % 60000 : undefined
  console.log(
    `  next execution after resume: ${nextExecution !== undefined ? new Date(nextExecution).toISOString() : 'none'} ` +
      `(offset into minute: ${offsetIntoMinute}ms)`
  )
  console.log(
    ticksWhilePaused === 0
      ? '✅ no ticks fired during the 10s pause window'
      : `❌ expected 0 ticks while paused, got ${ticksWhilePaused}`
  )
  console.log(
    nextExecution !== undefined &&
      nextExecution > Date.now() &&
      offsetIntoMinute! < 5000
      ? '✅ resume() recalculated the next occurrence onto a fresh :00-seconds boundary, not resume-time-plus-stale-offset'
      : `❌ expected the resumed timer to land back on a :00 boundary in the future, got offset ${offsetIntoMinute}ms`
  )

  const before = pauseResumeCount
  const deadline = Date.now() + 65000
  while (pauseResumeCount === before && Date.now() < deadline) {
    await wait(1000)
  }
  console.log(
    `  pause-resume/tick count after resume: ${pauseResumeCount} (was ${before})`
  )
  console.log(
    pauseResumeCount === before + 1
      ? '✅ the resumed calendar task fired for real, right on schedule'
      : `❌ expected exactly 1 fire after resume, got ${pauseResumeCount - before}`
  )

  schedule.cancel('demo-pause-resume')
})()

// =============================================================================
// 4) ORCHESTRATION CRON TRIGGER  →  OrchestrationTrigger.schedule (a cron
//    string) previously sat unused in the type - registerTriggers()'s
//    'time' case never read it. Now it goes through the same
//    computeNextOccurrence()/self-rearm mechanism as section 3, via
//    armOrchestrationScheduleTrigger() in orchestration-engine.ts. Uses a
//    cron built for "the next minute boundary" so the wait is under 60s
//    instead of a guaranteed full minute-plus.
// =============================================================================
console.log(
  '\n=== 4) orchestration.keep() with a cron `schedule` trigger (<60s) ==='
)

const orchestrationCronCheck = (async () => {
  const next = new Date(Date.now() + 60000 - (Date.now() % 60000) + 1000)
  const cronExpr = `${next.getUTCMinutes()} ${next.getUTCHours()} * * *`

  cyre.orchestration.keep({
    id: 'demo-orchestration-cron',
    triggers: [
      {name: 'daily-tick', type: 'time', schedule: cronExpr, timezone: 'UTC'}
    ],
    workflow: [{name: 'log', type: 'action', targets: 'orchestration/cron-log'}]
  })
  const activateResult = cyre.orchestration.activate(
    'demo-orchestration-cron',
    true
  )
  console.log(
    `  activate() -> ok:${activateResult.ok} - ${activateResult.message}, waiting for cron "${cronExpr}" UTC`
  )

  const status = cyre.orchestration.getStatus('demo-orchestration-cron')
  console.log(
    `  armed with ${status?.timeKeeperInfo.timerCount} TimeKeeper timer(s)`
  )

  const before = orchestrationCronCount
  const deadline = Date.now() + 65000
  while (orchestrationCronCount === before && Date.now() < deadline) {
    await wait(1000)
  }

  cyre.orchestration.activate('demo-orchestration-cron', false)
  console.log(
    `  orchestration/cron-log count: ${orchestrationCronCount} (was ${before})`
  )
  console.log(
    orchestrationCronCount === before + 1
      ? '✅ the previously-dead `schedule` field on OrchestrationTrigger now genuinely drives a cron-based orchestration trigger'
      : `❌ expected exactly 1 fire from the orchestration cron trigger, got ${orchestrationCronCount - before}`
  )
})()

await Promise.all([
  onDateCheck,
  cronRearmCheck,
  pauseResumeCheck,
  orchestrationCronCheck
])

// =============================================================================
// 5) TEARDOWN
// =============================================================================
console.log('\n=== 5) teardown ===')
for (const id of [
  'demo-once',
  'demo-interval',
  'demo-ondate',
  'demo-daily',
  'demo-weekly',
  'demo-cron-rearm',
  'demo-pause-resume'
]) {
  schedule.cancel(id)
}
cyre.orchestration.forget('demo-orchestration-cron')
console.log(`  remaining schedule tasks: ${schedule.list().length}`)
console.log(`  remaining orchestrations: ${cyre.orchestration.list().length}`)

cyre.shutdown()
