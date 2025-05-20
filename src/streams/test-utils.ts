// src/streams/test-utils.ts

import {cyre} from '../app'
import {Stream} from './types'

/**
 * Special functions for testing - only to be used in test environment
 */
export const TestHelpers = {
  /**
   * Manually trigger an error for a stream with map operator
   */
  triggerMapError: (
    streamId: string,
    error: Error,
    sourceValue?: any
  ): void => {
    // Find the error channel for this stream
    const errorChannelId = `${streamId}-error-channel`
    cyre.call(errorChannelId, {error, value: sourceValue})
  },

  /**
   * Complete a test quickly to avoid timeouts
   */
  completeTest: (timeout: number = 10): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, timeout))
  },

  /**
   * Force completion of a stream
   */
  forceComplete: (stream: Stream<any>): void => {
    stream.complete()
  }
}
