// src/streams/switchmap-mock.test.ts

import {describe, it, expect, beforeEach} from 'vitest'
import {cyre} from '../app'
import {createStream} from './index'

describe('SwitchMap Mock Test', () => {
  beforeEach(() => {
    console.log('\n[TEST] ---------- TEST INITIALIZING ----------')
    cyre.initialize()
  })

  it('should correctly switch between streams with proper sequencing', () => {
    // Create the test helper class
    class TestStream<T> {
      private _stream: any
      private _id: string

      constructor(id: string) {
        this._id = id
        this._stream = createStream<T>(id)
      }

      get stream() {
        return this._stream
      }

      // This is important - emitting AFTER stream creation
      // NOT during stream creation
      async emitValue(value: T) {
        console.log(`[TEST] Emitting value to ${this._id}:`, value)
        await this._stream.next(value)
        console.log(`[TEST] Emit completed for ${this._id}`)
      }

      complete() {
        console.log(`[TEST] Completing ${this._id}`)
        this._stream.complete()
      }
    }

    // Create test environment
    const results: any[] = []

    // Source stream
    const source = new TestStream<number>('source')

    // Factory function that creates inner streams
    const createInnerStream = (num: number) => {
      console.log(`[TEST] Creating inner stream for ${num}`)
      return new TestStream<string>(`inner-${num}`)
    }

    // Dictionary of inner streams
    const innerStreams: Record<number, TestStream<string>> = {}

    // Create the switchMap
    const switched = source.stream.switchMap(num => {
      // Create and store the inner stream
      const inner = createInnerStream(num)
      innerStreams[num] = inner

      // Important: JUST RETURN the inner stream
      // DO NOT emit values here!
      return inner.stream
    })

    // Subscribe to the result
    switched.subscribe(value => {
      console.log(`[TEST] Received value:`, value)
      results.push(value)
    })

    // Now test the sequence manually with explicit async steps

    // Step 1: Emit value 1 to the source
    console.log('[TEST] Step 1: Emitting 1 to source')
    source
      .emitValue(1)
      .then(() => {
        console.log('[TEST] Source emission 1 completed')

        // Step 2: Now that inner stream 1 is set up, emit a value to it
        console.log('[TEST] Step 2: Emitting to inner stream 1')
        return innerStreams[1].emitValue('value-1')
      })
      .then(() => {
        console.log('[TEST] Inner stream 1 emission completed')

        // Step 3: Emit value 2 to the source (should switch streams)
        console.log('[TEST] Step 3: Emitting 2 to source')
        return source.emitValue(2)
      })
      .then(() => {
        console.log('[TEST] Source emission 2 completed')

        // Step 4: Emit to the new inner stream
        console.log('[TEST] Step 4: Emitting to inner stream 2')
        return innerStreams[2].emitValue('value-2')
      })
      .then(() => {
        console.log('[TEST] Inner stream 2 emission completed')

        // Step 5: Cleanup
        console.log('[TEST] Step 5: Cleanup')
        switched.complete()
        source.complete()
        Object.values(innerStreams).forEach(s => s.complete())

        // Step 6: Verify results
        console.log('[TEST] Results:', results)
        expect(results.length).toBeGreaterThan(0)
        expect(results).toContain('value-1')
        expect(results).toContain('value-2')
      })

    // We need to return a promise that completes when the test is done
    return new Promise(resolve => {
      // Give our test enough time to complete all steps
      setTimeout(resolve, 100)
    })
  })
})
