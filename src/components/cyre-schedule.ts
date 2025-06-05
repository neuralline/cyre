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
import type {ActionPayload, Priority} from '../types/core'
import {timeline} from '../context/state'
import {metricsState} from '../context/metrics-state'
import {sensor} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {log} from './cyre-log'

/*
  
        C.Y.R.E - S.C.H.E.D.U.L.E
        
        Unified scheduling system with trigger-based interface:
        - Your desired triggers: [{ time: '09:00', channels: ['morning-digest'] }]
        - Deep integration with timeline and breathing system
        - Universal coordination for all scheduled work
        - Backward compatible with existing interval/repeat
  
  */

// Active task registry
const activeTasks = new Map<string, TimelineTask>()
const taskTimers = new Map<string, string[]>() // task ID -> timer IDs
const triggerRegistry = new Map<string, TaskTrigger[]>() // task ID -> triggers

/**
 * Parse time string to Date object
 */
const parseTimeToday = (timeStr: string, timezone?: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  // Handle timezone if provided
  if (timezone) {
    // Simple timezone handling - could be enhanced with proper timezone library
    const offset = getTimezoneOffset(timezone)
    date.setMinutes(date.getMinutes() + offset)
  }

  return date
}

/**
 * Simple timezone offset calculation (could be enhanced)
 */
const getTimezoneOffset = (timezone: string): number => {
  // Basic timezone mapping - could be enhanced with full timezone support
  const timezones: Record<string, number> = {
    UTC: 0,
    EST: -300, // UTC-5
    PST: -480, // UTC-8
    GMT: 0,
    'user-local': new Date().getTimezoneOffset()
  }

  return timezones[timezone] || 0
}

/**
 * Calculate next execution time for trigger
 */
const calculateNextExecution = (trigger: TaskTrigger): number => {
  const now = Date.now()

  if (trigger.time) {
    // Time-based: '09:00', '14:30'
    const targetTime = parseTimeToday(trigger.time, trigger.timezone)
    if (targetTime.getTime() <= now) {
      // If time has passed today, schedule for tomorrow
      targetTime.setDate(targetTime.getDate() + 1)
    }
    return targetTime.getTime()
  }

  if (trigger.interval) {
    // Interval-based: every X milliseconds
    return now + (trigger.delay || 0) + trigger.interval
  }

  if (trigger.delay) {
    // One-time delay
    return now + trigger.delay
  }

  if (trigger.cron) {
    // Cron expression - basic implementation
    return calculateCronNext(trigger.cron, trigger.timezone)
  }

  // Default: execute immediately
  return now
}

/**
 * Basic cron calculation (could be enhanced with full cron library)
 */
const calculateCronNext = (cronExpr: string, timezone?: string): number => {
  // Basic cron patterns - could be enhanced
  const patterns: Record<string, number> = {
    '0 9 * * MON': getNextWeekday(1, 9, 0), // Every Monday at 9 AM
    '0 17 * * FRI': getNextWeekday(5, 17, 0), // Every Friday at 5 PM
    '0 */4 * * *': getNextInterval(4 * 60 * 60 * 1000) // Every 4 hours
  }

  return patterns[cronExpr] || Date.now() + 60000 // Default: 1 minute
}

/**
 * Helper: Get next weekday at specific time
 */
const getNextWeekday = (
  targetDay: number,
  hours: number,
  minutes: number
): number => {
  const now = new Date()
  const target = new Date()
  target.setHours(hours, minutes, 0, 0)

  const daysUntilTarget = (targetDay - now.getDay() + 7) % 7
  if (daysUntilTarget === 0 && target.getTime() <= now.getTime()) {
    // Target time has passed today, schedule for next week
    target.setDate(target.getDate() + 7)
  } else {
    target.setDate(target.getDate() + daysUntilTarget)
  }

  return target.getTime()
}

/**
 * Helper: Get next interval execution
 */
const getNextInterval = (intervalMs: number): number => {
  return Date.now() + intervalMs
}

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
    sensor.log(task.id, 'info', 'task-trigger-execution', {
      triggerId: context.triggerId,
      triggerType: trigger.time
        ? 'time'
        : trigger.interval
        ? 'interval'
        : 'other'
    })

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
      const {orchestration} = await import(
        '../orchestration/orchestration-engine'
      )

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

    // Calculate next execution if repeating
    let nextExecution: number | undefined
    if (
      trigger.repeat === true ||
      (typeof trigger.repeat === 'number' && trigger.repeat > 1)
    ) {
      if (trigger.time) {
        // Daily repeat for time-based triggers
        nextExecution = calculateNextExecution(trigger)
      } else if (trigger.interval) {
        // Interval repeat
        nextExecution = Date.now() + trigger.interval
      }
    }

    sensor.log(
      task.id,
      allSuccessful ? 'success' : 'error',
      'task-trigger-complete',
      {
        duration,
        channelCount: trigger.channels?.length || 0,
        orchestrationId: trigger.orchestration,
        nextExecution
      }
    )

    return {
      ok: allSuccessful,
      duration,
      result: results.length === 1 ? results[0] : results,
      nextExecution
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
 * Schedule task triggers using TimeKeeper
 */
const scheduleTaskTriggers = (task: TimelineTask): string[] => {
  const timerIds: string[] = []

  task.triggers.forEach((trigger, index) => {
    if (trigger.enabled === false) return

    const triggerId = `${task.id}-trigger-${index}`
    const nextExecution = calculateNextExecution(trigger)
    const delay = Math.max(0, nextExecution - Date.now())

    // Determine repeat configuration
    let repeat: number | boolean = false
    if (trigger.repeat === true) {
      repeat = true
    } else if (typeof trigger.repeat === 'number') {
      repeat = trigger.repeat
    } else if (trigger.time || trigger.cron) {
      repeat = true // Time and cron triggers repeat by default
    }

    try {
      const timerResult = TimeKeeper.keep(
        trigger.interval || delay,
        async () => {
          // Check if task is still active
          if (!activeTasks.has(task.id)) return

          // Check breathing system if configured
          if (task.breathing?.adaptToStress) {
            const breathing = metricsState.get().breathing
            if (breathing.stress > (task.breathing.pauseThreshold || 0.9)) {
              sensor.log(task.id, 'info', 'task-paused-stress', {
                stress: breathing.stress,
                threshold: task.breathing.pauseThreshold
              })
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
              sensor.log(task.id, 'skip', 'task-conditions-not-met')
              return
            }
          }

          // Create execution context
          const context: TaskExecutionContext = {
            taskId: task.id,
            triggerId,
            trigger,
            executionCount: 0, // Could track this
            systemStress: metricsState.get().breathing.stress,
            timestamp: Date.now()
          }

          // Execute trigger
          const result = await executeTrigger(task, trigger, context)

          // Handle result
          if (!result.ok && result.shouldRetry && task.retry?.enabled) {
            // Schedule retry (could implement retry logic here)
            sensor.log(task.id, 'info', 'task-retry-scheduled')
          }

          // Schedule next execution if needed
          if (result.nextExecution && trigger.repeat) {
            const nextDelay = Math.max(0, result.nextExecution - Date.now())
            // Could reschedule here for dynamic timing
          }
        },
        repeat,
        triggerId,
        delay
      )

      if (timerResult.kind === 'ok') {
        timerIds.push(triggerId)
        sensor.log(task.id, 'info', 'task-trigger-scheduled', {
          triggerId,
          delay,
          repeat,
          nextExecution
        })
      } else {
        sensor.error(
          task.id,
          timerResult.error.message,
          'task-trigger-schedule-failed'
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error(task.id, errorMessage, 'task-trigger-schedule-error')
    }
  })

  return timerIds
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
      if (activeTasks.has(config.id)) {
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
          !trigger.time && !trigger.interval && !trigger.cron && !trigger.delay
      )

      if (invalidTriggers.length > 0) {
        return {
          ok: false,
          message:
            'All triggers must have time, interval, cron, or delay specified'
        }
      }

      // Schedule all triggers
      const timerIds = scheduleTaskTriggers(task)

      if (timerIds.length === 0) {
        return {
          ok: false,
          message: 'Failed to schedule any triggers'
        }
      }

      // Register task
      activeTasks.set(task.id, task)
      taskTimers.set(task.id, timerIds)
      triggerRegistry.set(task.id, task.triggers)

      sensor.log(task.id, 'success', 'task-scheduled', {
        triggerCount: task.triggers.length,
        timerCount: timerIds.length,
        type: task.type
      })

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
    const dayMap: Record<string, string> = {
      monday: '0 9 * * 1',
      tuesday: '0 9 * * 2',
      wednesday: '0 9 * * 3',
      thursday: '0 9 * * 4',
      friday: '0 9 * * 5',
      saturday: '0 9 * * 6',
      sunday: '0 9 * * 0'
    }

    const [hours, minutes] = time.split(':')
    const cronExpr = `${minutes} ${hours} * * ${
      dayMap[day.toLowerCase()]?.split(' ')[4] || '1'
    }`

    return schedule.task({
      ...config,
      triggers: [
        {
          cron: cronExpr,
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
        taskTimers.delete(taskId)
      }

      activeTasks.delete(taskId)
      triggerRegistry.delete(taskId)

      sensor.log(taskId, 'info', 'task-cancelled')
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
        sensor.log(taskId, 'info', 'task-paused')
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
        sensor.log(taskId, 'info', 'task-resumed')
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
    let tasks = Array.from(activeTasks.values())

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
    const allTasks = Array.from(activeTasks.values())
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
