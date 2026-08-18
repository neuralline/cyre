// src/components/cyre-schedule.ts
// Timeline task scheduler with trigger-based interface

import type {
  TimelineTask,
  TaskTrigger,
  ScheduleConfig,
  QuickScheduleConfig,
  TaskResult,
  TaskExecutionContext,
  TaskExecutionResult,
  TimelineLoad,
  TaskFilter
} from '../types/timeline'
import {metricsState} from '../context/metrics-state'
import {scheduleState} from '../context/schedule-state'
import {sensor} from '../components/sensor'
import {TimeKeeper} from '../components/cyre-timekeeper'
import {computeNextOccurrence} from '../components/cyre-calendar'

/*

        C.Y.R.E - S.C.H.E.D.U.L.E

        Unified scheduling system with trigger-based interface:
        - Your desired triggers: [{ time: '09:00', channels: ['morning-digest'] }]
        - Calendar-correct: real cron parsing, IANA timezones + DST, one-off
          calendar dates, weekday-restricted daily triggers - all computed by
          cyre-calendar.ts and re-derived on every fire, so a "daily at 09:00"
          trigger stays locked to 09:00 instead of drifting into a fixed
          interval based on whatever the first day's delay happened to be
        - Deep integration with timeline and breathing system
        - Universal coordination for all scheduled work
        - Backward compatible with existing interval/repeat

  */

const {
  tasks: activeTasks,
  timerIds: taskTimers,
  triggers: triggerRegistry
} = scheduleState

/**
 * True when a trigger is calendar-based (time-of-day, cron, or a specific
 * date) rather than a plain fixed interval/delay
 */
const isCalendarTrigger = (trigger: TaskTrigger): boolean =>
  !!(trigger.time || trigger.cron || trigger.date)

/**
 * Execute task trigger
 */
const executeTrigger = async (
  task: TimelineTask,
  trigger: TaskTrigger,
  context: TaskExecutionContext
): Promise<TaskExecutionResult> => {
  const startTime = performance.now()

  try {
    let results: any[] = []

    // Execute channels if specified
    if (trigger.channels && trigger.channels.length > 0) {
      const {call} = await import('../app')

      const channelResults = await Promise.all(
        trigger.channels.map(channelId =>
          call(channelId, trigger.payload || context.variables)
        )
      )

      results.push(...channelResults)
    }

    // Execute orchestration if specified
    if (trigger.orchestration) {
      // orchestration-engine.ts actually lives in src/orchestration/, not
      // next to this file in src/components/ - the previous relative path
      // here ('./orchestration-engine') pointed at a nonexistent module and
      // would have thrown the moment any trigger.orchestration ran
      const {orchestration} =
        await import('../orchestration/orchestration-engine')

      const orchestrationResult = await orchestration.trigger(
        trigger.orchestration,
        'task-trigger',
        trigger.payload || context.variables
      )

      results.push(orchestrationResult)
    }

    // Execute custom function if specified
    if (trigger.function) {
      const functionResult = await trigger.function()
      results.push(functionResult)
    }

    const duration = performance.now() - startTime
    const allSuccessful = results.every(r => r.ok !== false)

    return {
      ok: allSuccessful,
      duration,
      result: results.length === 1 ? results[0] : results
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const duration = performance.now() - startTime

    sensor.error(task.id, errorMessage, 'task-trigger-execution')

    return {
      ok: false,
      duration,
      error: errorMessage,
      shouldRetry: task.retry?.enabled || false
    }
  }
}

/**
 * Run one firing of a trigger: breathing/condition gates, then execute.
 * Shared by both the calendar-armed path and the plain interval path.
 */
const runTriggerOnce = async (
  task: TimelineTask,
  trigger: TaskTrigger,
  triggerId: string
): Promise<void> => {
  if (!activeTasks.get(task.id)) return

  // Check breathing system if configured
  if (task.breathing?.adaptToStress) {
    const breathing = metricsState.get().breathing
    if (breathing.stress > (task.breathing.pauseThreshold || 0.9)) {
      return
    }
  }

  // Check task conditions
  if (task.conditions && task.conditions.length > 0) {
    const conditionsMet = task.conditions.every(condition => {
      try {
        return condition({}) // Could pass more context here
      } catch {
        return false
      }
    })

    if (!conditionsMet) {
      sensor.debug(task.id, 'skip', 'task-conditions-not-met')
      return
    }
  }

  const context: TaskExecutionContext = {
    taskId: task.id,
    triggerId,
    trigger,
    executionCount: 0,
    systemStress: metricsState.get().breathing.stress,
    timestamp: Date.now()
  }

  const result = await executeTrigger(task, trigger, context)

  if (!result.ok && result.shouldRetry && task.retry?.enabled) {
    sensor.debug(task.id, 'info', 'task-retry-scheduled')
  }
}

/**
 * Arms a calendar-based trigger (time/cron/date) on TimeKeeper, using its
 * native `recompute` hook (see Timer['recompute'] in types/timer.ts) for
 * anything that should keep recurring, so TimeKeeper itself - not this
 * function - is what recalculates the next occurrence on every reschedule.
 * This is what keeps a "daily at 09:00" trigger locked to 09:00 forever
 * instead of repeating on a fixed interval derived from day one's delay,
 * and it's also what makes pause()/resume() correct for calendar triggers:
 * resume() reschedules through the exact same recompute-aware path, so a
 * task paused for three days resumes by recalculating from the actual
 * resume time rather than reusing a stale pre-pause interval.
 *
 * Earlier version of this function re-armed itself from inside its own
 * TimeKeeper callback via a same-tick `TimeKeeper.keep()` call, which raced
 * QuartzEngine's own post-execution bookkeeping for that same timer id and
 * silently died after firing once - see the git history for that bug if
 * curious. Moving the recompute logic into TimeKeeper itself (this function
 * now only runs ONCE, to make the initial arm) removes that whole class of
 * bug rather than working around it.
 */
const armCalendarTrigger = (
  task: TimelineTask,
  trigger: TaskTrigger,
  triggerId: string
): void => {
  const recurrenceRule = {
    time: trigger.time,
    cron: trigger.cron,
    date: trigger.date,
    days: trigger.days,
    timezone: trigger.timezone
  }

  const nextOccurrence = computeNextOccurrence(recurrenceRule, Date.now())

  if (nextOccurrence === undefined) {
    sensor.debug(task.id, 'info', 'task-trigger-no-future-occurrence')
    return
  }

  const delay = Math.max(0, nextOccurrence - Date.now())
  // A specific calendar `date` fires once, ever. Everything else (time/cron)
  // repeats unless the trigger explicitly opts out.
  const shouldRearm = trigger.repeat !== false && !trigger.date

  const timerResult = TimeKeeper.keep(
    delay,
    () => runTriggerOnce(task, trigger, triggerId),
    shouldRearm ? true : 1,
    triggerId,
    undefined,
    shouldRearm
      ? from => computeNextOccurrence(recurrenceRule, from)
      : undefined
  )

  if (timerResult.ok === 'ok') {
    const existing = taskTimers.get(task.id) || []
    if (!existing.includes(triggerId)) {
      taskTimers.set(task.id, [...existing, triggerId])
    }
    sensor.debug(task.id, 'info', 'task-trigger-scheduled')
  } else {
    sensor.error(
      task.id,
      timerResult.error.message,
      'task-trigger-schedule-failed'
    )
  }
}

/**
 * Arms a plain interval/delay trigger using TimeKeeper's native repeat -
 * a fixed cadence is the correct semantics here, so no calendar math needed.
 */
const armIntervalTrigger = (
  task: TimelineTask,
  trigger: TaskTrigger,
  triggerId: string
): void => {
  const repeat: number | boolean =
    trigger.repeat === true || trigger.repeat === false
      ? trigger.repeat
      : typeof trigger.repeat === 'number'
        ? trigger.repeat
        : false

  const timerResult = TimeKeeper.keep(
    trigger.interval || trigger.delay || 0,
    () => runTriggerOnce(task, trigger, triggerId),
    repeat,
    triggerId,
    trigger.delay
  )

  if (timerResult.ok === 'ok') {
    const existing = taskTimers.get(task.id) || []
    taskTimers.set(task.id, [...existing, triggerId])
    sensor.debug(task.id, 'info', 'task-trigger-scheduled')
  } else {
    sensor.error(
      task.id,
      timerResult.error.message,
      'task-trigger-schedule-failed'
    )
  }
}

/**
 * Schedule task triggers using TimeKeeper
 */
const scheduleTaskTriggers = (task: TimelineTask): string[] => {
  taskTimers.set(task.id, [])

  task.triggers.forEach((trigger, index) => {
    if (trigger.enabled === false) return

    const triggerId = `${task.id}-trigger-${index}`

    try {
      if (isCalendarTrigger(trigger)) {
        armCalendarTrigger(task, trigger, triggerId)
      } else {
        armIntervalTrigger(task, trigger, triggerId)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error(task.id, errorMessage, 'task-trigger-schedule-error')
    }
  })

  return taskTimers.get(task.id) || []
}

/**
 * Main scheduling API
 */
export const schedule = {
  /**
   * Schedule task with trigger-based interface
   */
  task: (config: ScheduleConfig): TaskResult => {
    try {
      if (!config.id || !config.triggers || config.triggers.length === 0) {
        return {
          ok: false,
          message: 'Task ID and at least one trigger are required'
        }
      }

      // Check for existing task
      if (activeTasks.get(config.id)) {
        return {
          ok: false,
          message: `Task ${config.id} already exists`
        }
      }

      // Create timeline task
      const task: TimelineTask = {
        id: config.id,
        type: config.type || 'scheduled-event',
        source: 'schedule',
        triggers: config.triggers,
        dependencies: config.dependencies,
        conflicts: config.conflicts,
        breathing: config.breathing,
        retry: config.retry,
        conditions: config.conditions,
        enabled: config.enabled !== false,
        metadata: {
          ...config.metadata,
          createdAt: Date.now()
        }
      }

      // Validate triggers
      const invalidTriggers = task.triggers.filter(
        trigger =>
          !trigger.time &&
          !trigger.interval &&
          !trigger.cron &&
          !trigger.delay &&
          !trigger.date
      )

      if (invalidTriggers.length > 0) {
        return {
          ok: false,
          message:
            'All triggers must have time, interval, cron, date, or delay specified'
        }
      }

      // Register task before arming triggers - runTriggerOnce() checks
      // activeTasks for a still-active task, so it must exist first
      activeTasks.set(task.id, task)
      triggerRegistry.set(task.id, task.triggers)

      // Schedule all triggers
      const timerIds = scheduleTaskTriggers(task)

      if (timerIds.length === 0) {
        activeTasks.forget(task.id)
        triggerRegistry.forget(task.id)
        taskTimers.forget(task.id)
        return {
          ok: false,
          message: 'Failed to schedule any triggers'
        }
      }

      sensor.debug(task.id, 'success', 'task-scheduled')

      return {
        ok: true,
        taskId: task.id,
        message: `Task scheduled with ${timerIds.length} triggers`
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error(config.id, errorMessage, 'task-schedule-error')

      return {
        ok: false,
        message: `Task scheduling failed: ${errorMessage}`
      }
    }
  },

  /**
   * Quick scheduling methods
   */
  daily: (time: string, config: QuickScheduleConfig): TaskResult => {
    return schedule.task({
      ...config,
      triggers: [
        {
          time,
          channels: config.channels,
          orchestration: config.orchestration,
          function: config.function,
          payload: config.payload,
          timezone: config.timezone,
          repeat: true
        }
      ]
    })
  },

  weekly: (
    day: string,
    time: string,
    config: QuickScheduleConfig
  ): TaskResult => {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    }

    const weekday = dayMap[day.toLowerCase()]
    if (weekday === undefined) {
      return {ok: false, message: `Unknown weekday: "${day}"`}
    }

    return schedule.task({
      ...config,
      triggers: [
        {
          time,
          days: [weekday],
          channels: config.channels,
          orchestration: config.orchestration,
          function: config.function,
          payload: config.payload,
          timezone: config.timezone,
          repeat: true
        }
      ]
    })
  },

  /**
   * One-off run on a specific calendar date (and optional time-of-day)
   */
  onDate: (
    date: string,
    time: string | undefined,
    config: QuickScheduleConfig
  ): TaskResult => {
    return schedule.task({
      ...config,
      triggers: [
        {
          date,
          time,
          channels: config.channels,
          orchestration: config.orchestration,
          function: config.function,
          payload: config.payload,
          timezone: config.timezone,
          repeat: false
        }
      ]
    })
  },

  interval: (intervalMs: number, config: QuickScheduleConfig): TaskResult => {
    return schedule.task({
      ...config,
      triggers: [
        {
          interval: intervalMs,
          channels: config.channels,
          orchestration: config.orchestration,
          function: config.function,
          payload: config.payload,
          repeat: true
        }
      ]
    })
  },

  once: (delay: number, config: QuickScheduleConfig): TaskResult => {
    return schedule.task({
      ...config,
      triggers: [
        {
          delay,
          channels: config.channels,
          orchestration: config.orchestration,
          function: config.function,
          payload: config.payload,
          repeat: false
        }
      ]
    })
  },

  /**
   * Task management
   */
  cancel: (taskId: string): boolean => {
    try {
      const timerIds = taskTimers.get(taskId)
      if (timerIds) {
        timerIds.forEach(timerId => TimeKeeper.forget(timerId))
        taskTimers.forget(taskId)
      }

      activeTasks.forget(taskId)
      triggerRegistry.forget(taskId)

      return true
    } catch (error) {
      sensor.error(taskId, String(error), 'task-cancel-error')
      return false
    }
  },

  pause: (taskId: string): boolean => {
    try {
      const timerIds = taskTimers.get(taskId)
      if (timerIds) {
        timerIds.forEach(timerId => TimeKeeper.pause(timerId))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  resume: (taskId: string): boolean => {
    try {
      const timerIds = taskTimers.get(taskId)
      if (timerIds) {
        timerIds.forEach(timerId => TimeKeeper.resume(timerId))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  /**
   * Query and monitoring
   */
  list: (filter?: TaskFilter): TimelineTask[] => {
    let tasks = activeTasks.getAll()

    if (filter) {
      if (filter.type) {
        tasks = tasks.filter(task => task.type === filter.type)
      }
      if (filter.source) {
        tasks = tasks.filter(task => task.source === filter.source)
      }
      if (filter.enabled !== undefined) {
        tasks = tasks.filter(task => task.enabled === filter.enabled)
      }
      if (filter.tags) {
        tasks = tasks.filter(task =>
          filter.tags!.some(tag => task.metadata?.tags?.includes(tag))
        )
      }
    }

    return tasks
  },

  get: (taskId: string): TimelineTask | undefined => {
    return activeTasks.get(taskId)
  },

  getLoad: (): TimelineLoad => {
    const allTasks = activeTasks.getAll()
    const enabledTasks = allTasks.filter(task => task.enabled)
    const breathing = metricsState.get().breathing

    return {
      totalTasks: allTasks.length,
      activeTasks: enabledTasks.length,
      queuedTasks: 0, // Could track queued tasks
      nextExecution: Date.now() + 60000, // Could calculate actual next execution
      systemCapacity: 1 - breathing.stress,
      overloaded: breathing.stress > 0.8,
      estimatedRecovery:
        breathing.stress > 0.8
          ? Date.now() + breathing.currentRate * 2
          : undefined
    }
  }
}

// Export the schedule API
export default schedule
