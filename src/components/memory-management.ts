// src/components/memory-management.ts
// Memory leak fixes for CYRE system

/*

      C.Y.R.E - M.E.M.O.R.Y - M.A.N.A.G.E.M.E.N.T
      
      Memory leak prevention and cleanup:
      - Proper cleanup of timers and intervals
      - Protection pipeline memory management
      - Payload state cleanup optimization
      - Group middleware cleanup
      - Event listener cleanup

*/

import {timeline, stores} from '../context/state'
import {payloadState} from '../context/payload-state'
import {metricsReport} from '../context/metrics-report'

// Memory cleanup utilities
export const memoryCleanup = {
  /**
   * Clean up action-related memory leaks
   */
  cleanupAction: (actionId: string): void => {
    try {
      // Clear any active timers
      const timer = timeline.get(actionId)
      if (timer) {
        if (timer.timeoutId) {
          clearTimeout(timer.timeoutId)
        }
        if (timer.recuperationInterval) {
          clearTimeout(timer.recuperationInterval)
        }
        timeline.forget(actionId)
      }

      // Clear payload state
      if (payloadState) {
        payloadState.forget(actionId)
      }

      // Clear metrics
      if (metricsReport) {
        // Remove action-specific metrics
        const events = metricsReport.exportEvents({actionIds: [actionId]})
        events.forEach(event => {
          // Clear event references (implementation would need to be added to metrics-report)
        })
      }
    } catch (error) {
      console.warn(`Cleanup warning for ${actionId}:`, error)
    }
  },

  /**
   * Force garbage collection if available
   */
  forceGC: (): void => {
    if (typeof global !== 'undefined' && (global as any).gc) {
      try {
        ;(global as any).gc()
      } catch (error) {
        // GC not available, ignore
      }
    }
  },

  /**
   * Get current memory usage
   */
  getMemoryUsage: (): {
    heapUsed: number
    heapTotal: number
    external: number
  } => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100, // MB
        heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100, // MB
        external: Math.round((usage.external / 1024 / 1024) * 100) / 100 // MB
      }
    }
    return {heapUsed: 0, heapTotal: 0, external: 0}
  },

  /**
   * Memory monitoring and alerts
   */
  monitorMemory: (
    thresholdMB: number = 100
  ): {
    isOverThreshold: boolean
    usage: ReturnType<typeof memoryCleanup.getMemoryUsage>
    recommendation?: string
  } => {
    const usage = memoryCleanup.getMemoryUsage()
    const isOverThreshold = usage.heapUsed > thresholdMB

    let recommendation: string | undefined
    if (isOverThreshold) {
      if (usage.heapUsed > thresholdMB * 2) {
        recommendation =
          'Critical: Force garbage collection and clear unused actions'
      } else {
        recommendation =
          'Warning: Consider cleaning up unused actions and running GC'
      }
    }

    return {
      isOverThreshold,
      usage,
      recommendation
    }
  },

  /**
   * Comprehensive system cleanup
   */
  deepCleanup: (): void => {
    try {
      // Clear all stores
      if (stores) {
        Object.values(stores).forEach((store: any) => {
          if (store && typeof store.clear === 'function') {
            store.clear()
          }
        })
      }

      // Clear payload state
      if (payloadState && typeof payloadState.clear === 'function') {
        payloadState.clear()
      }

      // Reset metrics
      if (metricsReport && typeof metricsReport.reset === 'function') {
        metricsReport.reset()
      }

      // Clear timelines
      if (timeline && typeof timeline.clear === 'function') {
        timeline.clear()
      }

      // Force garbage collection
      memoryCleanup.forceGC()
    } catch (error) {
      console.warn('Deep cleanup warning:', error)
    }
  }
}
