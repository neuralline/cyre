// src/components/cyre-bouncer.ts
// Unified protection system using state + TimeKeeper

import {io} from '../context/state'
import TimeKeeper from './cyre-timekeeper'
import payloadState from '../context/payload-state'
import {metricsState} from '../context/metrics-state'
import type {IO, ActionPayload, CyreResponse} from '../types/core'
import {processCall} from './cyre-call'

interface BouncerResult {
  bounce: boolean
  response?: CyreResponse
  payload?: ActionPayload
}

interface ProtectionState {
  lastExecution: number
  debounceStart: number
  pendingTimerId?: string
  throttleBlock: boolean
}

/**
 * Unified bouncer system - handles all pre-pipeline protections
 */
export const bouncer = {
  /**
   * Single entry point for all protection checks
   */
  async check(action: IO, payload: ActionPayload): Promise<BouncerResult> {
    const currentTime = Date.now()

    // Get or create protection state
    const state = this.getProtectionState(action.id, currentTime)

    // 1. Recuperation check (system-wide)
    if (this.isSystemRecuperating(action)) {
      return {
        bounce: true,
        response: {
          ok: false,
          payload: undefined,
          message: 'System recuperating - only critical actions allowed'
        }
      }
    }

    // 2. Throttle check (time-based blocking)
    if (action.throttle && this.shouldThrottle(action, state, currentTime)) {
      const remaining = action.throttle - (currentTime - state.lastExecution)
      return {
        bounce: true,
        response: {
          ok: false,
          payload: undefined,
          message: `Throttled - ${remaining}ms remaining`,
          metadata: {throttled: true, remaining}
        }
      }
    }

    // 3. Debounce check (call collapsing with maxWait)
    if (action.debounce) {
      return await this.handleDebounce(action, payload, state, currentTime)
    }

    // No protections triggered - allow execution
    this.updateExecutionState(action.id, currentTime)
    return {bounce: false, payload}
  },

  /**
   * Get protection state from io store
   */
  getProtectionState(actionId: string, currentTime: number): ProtectionState {
    const action = io.get(actionId)!

    return {
      lastExecution: action._lastExecTime || 0,
      debounceStart: action._debounceStart || 0,
      pendingTimerId: action._debounceTimer,
      throttleBlock: false
    }
  },

  /**
   * Check system recuperation status
   */
  isSystemRecuperating(action: IO): boolean {
    const breathing = metricsState.get().breathing
    return breathing.isRecuperating && action.priority?.level !== 'critical'
  },

  /**
   * Check if call should be throttled
   */
  shouldThrottle(
    action: IO,
    state: ProtectionState,
    currentTime: number
  ): boolean {
    if (!action.throttle || action.throttle <= 0) return false
    if (state.lastExecution === 0) return false // First call always passes

    return currentTime - state.lastExecution < action.throttle
  },

  /**
   * Handle debounce logic with maxWait support
   */
  async handleDebounce(
    action: IO,
    payload: ActionPayload,
    state: ProtectionState,
    currentTime: number
  ): Promise<BouncerResult> {
    // Store latest payload
    payloadState.set(action.id, payload, 'call')

    // Check maxWait constraint first
    if (action.maxWait && state.debounceStart > 0) {
      const waitTime = currentTime - state.debounceStart
      if (waitTime >= action.maxWait) {
        // MaxWait exceeded - execute immediately
        this.clearDebounceState(action.id)
        this.updateExecutionState(action.id, currentTime)
        return {bounce: false, payload}
      }
    }

    // Cancel pending debounce timer if exists
    if (state.pendingTimerId) {
      TimeKeeper.forget(state.pendingTimerId)
    }

    // Set up new debounce timer
    const timerId = `${action.id}-debounce-${currentTime}`
    const debounceStart = state.debounceStart || currentTime

    // Update state in io store
    io.set({
      ...action,
      _debounceTimer: timerId,
      _debounceStart: debounceStart
    })

    // Schedule debounced execution
    const timerResult = TimeKeeper.keep(
      action.debounce!,
      async () => {
        try {
          // Get latest payload and execute
          const latestPayload = payloadState.get(action.id) || payload
          const currentAction = io.get(action.id)!

          // Clear debounce state
          this.clearDebounceState(action.id)
          this.updateExecutionState(action.id, Date.now())

          // Execute the action
          return await processCall(currentAction, latestPayload)
        } catch (error) {
          this.clearDebounceState(action.id)
          throw error
        }
      },
      1, // Execute once
      timerId
    )

    if (timerResult.ok === 'error') {
      this.clearDebounceState(action.id)
      return {
        bounce: true,
        response: {
          ok: false,
          payload: null,
          message: `Debounce timer failed: ${timerResult.error.message}`
        }
      }
    }

    // Return debounced response
    return {
      bounce: true,
      response: {
        ok: true,
        payload,
        message: `Debounced - executing in ${action.debounce}ms`,
        metadata: {
          debounced: true,
          delay: action.debounce,
          timerId: timerId.slice(-8)
        }
      }
    }
  },

  /**
   * Update execution state in io store
   */
  updateExecutionState(actionId: string, currentTime: number): void {
    const action = io.get(actionId)
    if (action) {
      io.set({
        ...action,
        _lastExecTime: currentTime,
        _executionCount: (action._executionCount || 0) + 1
      })
    }
  },

  /**
   * Clear debounce state from io store
   */
  clearDebounceState(actionId: string): void {
    const action = io.get(actionId)
    if (action) {
      io.set({
        ...action,
        _debounceTimer: undefined,
        _debounceStart: undefined
      })
    }
  }
}
