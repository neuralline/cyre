// src/streams/switchmap-debug.test.ts

import {describe, it, expect, beforeEach} from 'vitest'
import {cyre} from '..'
import {createStream} from './index'

describe('CYRE SwitchMap Debug Test', () => {
  beforeEach(() => {
    console.log('\n[TEST] ---------- TEST INITIALIZING ----------')
    cyre.initialize()
  })

  it('should trace switchMap operations step by step', () => {
    console.log('[TEST] Step 1: Creating source stream')
    const source = createStream<number>('debug-source')

    // Create an array to capture all events in sequence
    const events: string[] = []
    const startTime = Date.now()

    // Helper to log events with timestamps
    const logEvent = (event: string) => {
      const now = Date.now()
      const elapsed = now - startTime
      const timestampedEvent = `[${elapsed}ms] ${event}`
      console.log(`[TEST] ${timestampedEvent}`)
      events.push(timestampedEvent)
    }

    logEvent('Step 2: Creating switchMap')

    // Tracking inner streams for debugging
    let innerStreamCount = 0
    let currentInnerStream: string | null = null

    const result = source.switchMap(num => {
      const innerStreamId = `inner-${num}-${innerStreamCount++}`
      logEvent(`Step 3-${num}: Creating inner stream ${innerStreamId}`)
      currentInnerStream = innerStreamId

      const inner = createStream<string>(innerStreamId)

      // Log when we create the inner stream
      logEvent(
        `Step 3-${num}: Inner stream created, immediately pushing value-${num}`
      )

      // IMPORTANT: Emit a value synchronously
      inner
        .next(`value-${num}`)
        .then(() => {
          logEvent(
            `Step 3-${num}: Inner stream emit completed for value-${num}`
          )
        })
        .catch(err => {
          logEvent(`ERROR: Inner stream emit failed: ${err}`)
        })

      return inner
    })

    logEvent('Step 4: Subscribing to result stream')

    let receivedValues = 0
    result.subscribe(val => {
      receivedValues++
      logEvent(`Step 5: Received value ${val} (${receivedValues} total)`)
    })

    logEvent('Step 6: Pushing value 1 to source')
    source.next(1).then(() => {
      logEvent('Step 6a: Source next(1) promise resolved')
    })

    logEvent('Step 7: Pushing value 2 to source')
    source.next(2).then(() => {
      logEvent('Step 7a: Source next(2) promise resolved')
    })

    logEvent('Step A: Waiting briefly to allow operations to complete')
    // Simulate waiting
    for (let i = 0; i < 1000000; i++) {
      // Busy wait to allow operations to complete
      if (i % 500000 === 0) {
        logEvent(
          `Step A${
            i / 500000
          }: Still waiting, received ${receivedValues} values so far`
        )
      }
    }

    logEvent('Step 8: Completing result stream')
    result.complete()

    logEvent('Step 9: Completing source stream')
    source.complete()

    logEvent('Step 10: Test completed')

    // Log all events in sequence for easier debugging
    console.log('\n[TEST] ---------- EVENT SEQUENCE ----------')
    events.forEach((event, i) => {
      console.log(`[TEST] ${i + 1}. ${event}`)
    })

    // Simple assertion to validate the test ran correctly
    expect(receivedValues).toBeGreaterThan(0)
    expect(events.length).toBeGreaterThan(10)
  })
})
