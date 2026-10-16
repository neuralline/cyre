// test/cyre-core-fixes.test.ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/index'
import {TimeKeeper} from '../src/components/cyre-timekeeper'
import {systemMonitor} from '../src/context/system-monitor'

/*

      C.Y.R.E - C.O.R.E - F.I.X.E.S - T.E.S.T

      Regression tests for the v4.7.2 core fixes
      (see claude/cyre-analysis-2026-10.md, items 1.1, 1.2, 1.3, 2.1):
      - quartz engine no longer tight-loops while idle
      - multi-handler dispatch clears its timeout timer
      - memory stress reads real memory pressure, not heapUsed/heapTotal
      - extra handlers are never dropped by registration order

*/

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('Cyre core fixes (v4.7.2)', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    // reset(), not clear(): clear() stops the breathing timer but keeps
    // _init set, so the following init() returns early without re-arming
    // it - the quartz test below needs a real, freshly-initialized system
    cyre.reset()
    await cyre.init()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cyre.clear()
  })

  describe('handlers are never dropped by registration order (2.1)', () => {
    it('runs every handler when .on() is called before action()', async () => {
      const first = vi.fn()
      const second = vi.fn()

      cyre.on('order-before', first)
      cyre.on('order-before', second)
      cyre.action({id: 'order-before'})

      const result = await cyre.call('order-before', 'x')

      expect(result.ok).toBe(true)
      expect(first).toHaveBeenCalledWith('x')
      expect(second).toHaveBeenCalledWith('x')
    })

    it('runs every handler after the channel is re-registered', async () => {
      const first = vi.fn()
      const second = vi.fn()

      cyre.action({id: 'order-reregister'})
      cyre.on('order-reregister', first)
      cyre.on('order-reregister', second)
      cyre.action({id: 'order-reregister', payload: 1})

      await cyre.call('order-reregister')

      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
    })

    it('keeps the declared dispatch strategy after re-registration', async () => {
      const order: string[] = []

      cyre.action({id: 'order-waterfall', dispatch: 'waterfall'})
      cyre.on('order-waterfall', (n: number) => {
        order.push('a')
        return n + 1
      })
      cyre.on('order-waterfall', (n: number) => {
        order.push('b')
        return n * 10
      })
      cyre.action({id: 'order-waterfall', dispatch: 'waterfall'})

      const result = await cyre.call('order-waterfall', 1)

      expect(order).toEqual(['a', 'b'])
      expect(result.payload).toBe(20)
    })
  })

  describe('multi-handler dispatch timeout (1.2)', () => {
    it('clears its timeout timer once handlers settle', async () => {
      const TIMEOUT = 4321
      const setSpy = vi.spyOn(globalThis, 'setTimeout')
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout')

      cyre.action({id: 'timeout-cleanup', dispatchTimeout: TIMEOUT})
      cyre.on('timeout-cleanup', () => 1)
      cyre.on('timeout-cleanup', () => 2)

      for (let i = 0; i < 5; i++) {
        const result = await cyre.call('timeout-cleanup')
        expect(result.ok).toBe(true)
      }

      const dispatchTimers = setSpy.mock.calls
        .map((call, index) => ({delay: call[1], handle: setSpy.mock.results[index]?.value}))
        .filter(entry => entry.delay === TIMEOUT)

      expect(dispatchTimers.length).toBe(5)
      const cleared = new Set(clearSpy.mock.calls.map(call => call[0]))
      for (const {handle} of dispatchTimers) {
        expect(cleared.has(handle)).toBe(true)
      }
    })

    it('still times out a hung multi-handler dispatch', async () => {
      cyre.action({id: 'timeout-hang', dispatchTimeout: 150})
      cyre.on('timeout-hang', () => 'fast')
      cyre.on('timeout-hang', () => sleep(400).then(() => 'slow'))

      const result = await cyre.call('timeout-hang')

      expect(result.ok).toBe(false)
      expect(result.message).toContain('timeout after 150ms')
    })
  })

  describe('quartz engine (1.1)', () => {
    it('does not tight-loop while only the breathing timer is active', async () => {
      const immediateSpy = vi.spyOn(globalThis, 'setImmediate')

      await sleep(300)

      // Pre-fix this was thousands of setImmediate calls per 300ms
      expect(immediateSpy.mock.calls.length).toBeLessThan(20)
    })

    it('still fires a fast interval timer on schedule', async () => {
      let fired = 0
      TimeKeeper.keep(
        50,
        async () => {
          fired++
        },
        3,
        'core-fixes-fast-timer'
      )

      await sleep(400)

      expect(fired).toBe(3)
    })
  })

  describe('memory stress reading (1.3)', () => {
    it('reports resident memory against available memory', async () => {
      const {memory} = await systemMonitor.sample()

      expect(memory).toBeGreaterThanOrEqual(0)
      expect(memory).toBeLessThanOrEqual(100)

      const proc = process as NodeJS.Process & {availableMemory?: () => number}
      if (typeof proc.availableMemory === 'function' && proc.availableMemory() > 0) {
        const rss = process.memoryUsage().rss
        const expected = (rss / (rss + proc.availableMemory())) * 100
        expect(Math.abs(memory - expected)).toBeLessThan(5)
      }
    })
  })
})
