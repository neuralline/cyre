// test/use-metrics.test.ts

import {describe, it, expect, beforeEach, afterEach, beforeAll, vi} from 'vitest'
import {
  cyre,
  useBranch,
  useMetrics,
  findUnused,
  findNeverExecuted,
  hottest,
  slowest,
  errorProne
} from '../src/index'
import {updateBreathingFromMetrics} from '../src/context/metrics-state'
import {metricsStream} from '../src/context/metrics-stream'
import type {ChannelMetricsRow} from '../src/context/metrics-stream'

const tick = async (times = 1) => {
  for (let i = 0; i < times; i++) await updateBreathingFromMetrics()
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('useMetrics', () => {
  beforeAll(async () => {
    await cyre.init()
  })

  beforeEach(async () => {
    metricsStream.clear()
    cyre.clear()
    await cyre.init()
  })

  afterEach(() => {
    metricsStream.clear()
    vi.clearAllTimers()
    cyre.clear()
  })

  it('returns a system metrics snapshot from get()', () => {
    const vitals = useMetrics(cyre)

    const snapshot = vitals.get()

    expect(snapshot).toHaveProperty('available', true)
    expect(snapshot).toHaveProperty('system')
    expect(snapshot).toHaveProperty('stores')
    if ('stores' in snapshot) {
      expect(snapshot.stores).toHaveProperty('scheduledTasks')
      expect(snapshot.stores).toHaveProperty('orchestrations')
      expect(snapshot.stores).toHaveProperty('subscribedChannels')
      expect(snapshot.stores).toHaveProperty('handlers')
      expect(snapshot.stores).toHaveProperty('orphanedHandlers')
    }
  })

  it('rejects invalid instances', () => {
    expect(() => useMetrics({} as any)).toThrow(
      'Invalid instance - missing required methods'
    )
  })

  it('delivers an eager snapshot and supports multiple callbacks', () => {
    const vitals = useMetrics(cyre)
    const first = vi.fn()
    const second = vi.fn()

    const stopFirst = vitals.watch(first)
    const stopSecond = vitals.watch(second)

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first.mock.calls[0][0]).toHaveProperty('available', true)
    expect(second.mock.calls[0][0]).toHaveProperty('available', true)

    stopFirst()
    stopSecond()
    vitals.stop()
  })

  describe('push, not poll', () => {
    it('creates no channel and no timer of its own', () => {
      const before = cyre.getMetrics() as any
      const vitals = useMetrics(cyre)
      const stop = vitals.watch(() => {})
      vitals.on('slow-task', () => {})

      const after = cyre.getMetrics() as any
      expect(after.stores.channels).toBe(before.stores.channels)
      expect(after.stores.timeline).toBe(before.stores.timeline)

      stop()
      vitals.stop()
    })

    it('delivers on each breathing tick and stops after unsubscribe', async () => {
      const vitals = useMetrics(cyre)
      const handler = vi.fn()
      const stop = vitals.watch(handler)

      expect(handler).toHaveBeenCalledTimes(1)

      await tick()
      expect(handler).toHaveBeenCalledTimes(2)
      await tick()
      expect(handler).toHaveBeenCalledTimes(3)

      stop()
      await tick(2)
      expect(handler).toHaveBeenCalledTimes(3)
      expect(metricsStream.active()).toBe(false)
    })

    it('interval skips ticks that arrive sooner than requested', async () => {
      const vitals = useMetrics(cyre, {interval: 60_000})
      const handler = vi.fn()
      const stop = vitals.watch(handler)

      await tick(3)
      // eager delivery + the first tick; the rest arrive inside the interval
      expect(handler).toHaveBeenCalledTimes(2)

      stop()
    })

    it('interval tolerates tick jitter (a 1s tick 10ms early is not skipped)', () => {
      const sampleAt = (t: number) => ({
        t,
        stress: 0,
        cpu: 0,
        memory: 0,
        eventLoop: 0,
        callsPerSecond: 0,
        breathingRate: 1000,
        recuperating: false
      })
      const vitals = useMetrics(cyre, {interval: 1000})
      const handler = vi.fn()
      const stop = vitals.watch(handler)
      const base = Date.now() + 10_000

      metricsStream.tick(sampleAt(base)) // delivered (first tick)
      metricsStream.tick(sampleAt(base + 990)) // 10ms early - still delivered
      metricsStream.tick(sampleAt(base + 1500)) // only 510ms later - skipped
      metricsStream.tick(sampleAt(base + 2000)) // 1010ms after last delivery

      // eager + 3 delivered ticks
      expect(handler).toHaveBeenCalledTimes(4)
      stop()
    })

    it('does no tick-side work while nothing is subscribed', async () => {
      expect(metricsStream.active()).toBe(false)
      await tick(3)
      expect(metricsStream.series()).toEqual([])
    })

    it('stop() removes every subscription the hook made', async () => {
      const vitals = useMetrics(cyre)
      const watcher = vi.fn()
      const ticker = vi.fn()
      vitals.watch(watcher)
      vitals.on('tick', ticker)
      expect(metricsStream.count()).toBe(2)

      vitals.stop()
      vitals.stop() // idempotent
      expect(metricsStream.count()).toBe(0)

      await tick()
      expect(ticker).not.toHaveBeenCalled()
    })

    it('a throwing callback does not break other subscribers', async () => {
      const vitals = useMetrics(cyre)
      const good = vi.fn()
      vitals.on('tick', () => {
        throw new Error('bad subscriber')
      })
      vitals.on('tick', good)

      await tick()
      expect(good).toHaveBeenCalledTimes(1)
      vitals.stop()
    })

    it('watches metrics from a branch-scoped channel', async () => {
      const branch = useBranch(cyre, {id: 'metrics-branch'})
      branch.action({id: 'tracked-channel', payload: {value: 0}})

      const vitals = useMetrics(branch, {channelId: 'tracked-channel'})
      const handler = vi.fn()

      expect(vitals.channelId).toBe('metrics-branch/tracked-channel')

      const stop = vitals.watch(handler)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0]).toMatchObject({
        available: true,
        channelId: 'metrics-branch/tracked-channel'
      })

      await tick()
      expect(handler.mock.calls.length).toBeGreaterThan(1)

      stop()
      branch.destroy()
    })
  })

  describe('chart data', () => {
    it('records flat samples while subscribed', async () => {
      const vitals = useMetrics(cyre)
      vitals.on('tick', () => {})

      await tick(3)

      const series = vitals.series()
      expect(series).toHaveLength(3)
      for (const sample of series) {
        expect(sample).toEqual(
          expect.objectContaining({
            t: expect.any(Number),
            stress: expect.any(Number),
            cpu: expect.any(Number),
            memory: expect.any(Number),
            eventLoop: expect.any(Number),
            callsPerSecond: expect.any(Number),
            breathingRate: expect.any(Number),
            recuperating: expect.any(Boolean)
          })
        )
      }
      expect(series[2].t).toBeGreaterThanOrEqual(series[0].t)
      expect(vitals.series(2)).toHaveLength(2)
      vitals.stop()
    })

    it('ring buffer never exceeds its capacity', async () => {
      metricsStream.configure({capacity: 3})
      const vitals = useMetrics(cyre)
      vitals.on('tick', () => {})

      await tick(6)
      expect(vitals.series()).toHaveLength(3)
      vitals.stop()
    })

    it('reports per-channel rate, duration and idle time', async () => {
      cyre.action({id: 'rows/busy'})
      cyre.on('rows/busy', async () => {
        await wait(15)
        return {ok: true}
      })
      cyre.action({id: 'rows/dead'})
      cyre.on('rows/dead', () => ({ok: true}))

      const vitals = useMetrics(cyre)
      vitals.on('tick', () => {})

      await tick() // baseline window
      for (let i = 0; i < 5; i++) await cyre.call('rows/busy', i)
      await wait(20)
      await tick()

      const rows = vitals.channels()
      const busy = rows.find(row => row.id === 'rows/busy')!
      const dead = rows.find(row => row.id === 'rows/dead')!

      expect(busy.count).toBe(5)
      expect(busy.rate).toBeGreaterThan(0)
      expect(busy.lastMs).toBeGreaterThanOrEqual(10)
      expect(busy.maxMs).toBeGreaterThanOrEqual(busy.lastMs)
      expect(busy.neverExecuted).toBe(false)
      expect(dead.neverExecuted).toBe(true)
      expect(dead.count).toBe(0)
      vitals.stop()
    })
  })

  describe('events', () => {
    it('executionDuration is real, not always 0 (field-name regression)', async () => {
      cyre.action({id: 'duration/check'})
      cyre.on('duration/check', async () => {
        await wait(20)
        return {ok: true}
      })

      await cyre.call('duration/check')

      const metrics = cyre.getMetrics('duration/check') as any
      expect(metrics.executionDuration).toBeGreaterThanOrEqual(15)
    })

    it('emits slow-task only above the threshold', async () => {
      cyre.action({id: 'slow/one'})
      cyre.on('slow/one', async (ms: number) => {
        await wait(ms)
        return {ok: true}
      })

      const vitals = useMetrics(cyre, {slowMs: 25})
      const slow = vi.fn()
      vitals.on('slow-task', slow)

      await cyre.call('slow/one', 2)
      expect(slow).not.toHaveBeenCalled()

      await cyre.call('slow/one', 40)
      expect(slow).toHaveBeenCalledTimes(1)
      expect(slow.mock.calls[0][0]).toMatchObject({channelId: 'slow/one'})
      expect(slow.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(25)

      vitals.stop()

      slow.mockClear()
      await cyre.call('slow/one', 40)
      expect(slow).not.toHaveBeenCalled()
    })

    it('emits channel-error when a handler throws', async () => {
      cyre.action({id: 'err/one'})
      cyre.on('err/one', () => {
        throw new Error('boom')
      })

      const vitals = useMetrics(cyre)
      const onError = vi.fn()
      vitals.on('channel-error', onError)

      await cyre.call('err/one')

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toMatchObject({
        channelId: 'err/one',
        message: expect.stringContaining('boom')
      })
      vitals.stop()
    })

    it('scopes channel events to channelId when set', async () => {
      for (const id of ['scope/a', 'scope/b']) {
        cyre.action({id})
        cyre.on(id, () => {
          throw new Error('nope')
        })
      }

      const vitals = useMetrics(cyre, {channelId: 'scope/a'})
      const onError = vi.fn()
      vitals.on('channel-error', onError)

      await cyre.call('scope/a')
      await cyre.call('scope/b')

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0].channelId).toBe('scope/a')
      vitals.stop()
    })
  })
})

describe('metrics analyzers', () => {
  const row = (overrides: Partial<ChannelMetricsRow>): ChannelMetricsRow => ({
    id: 'x',
    count: 0,
    rate: 0,
    lastMs: 0,
    maxMs: 0,
    errors: 0,
    idleMs: 0,
    createdAt: 0,
    neverExecuted: false,
    blocked: false,
    ...overrides
  })

  const rows = [
    row({id: 'dead', neverExecuted: true, idleMs: 900_000}),
    row({id: 'stale', count: 4, idleMs: 300_000}),
    row({id: 'hot', count: 9000, rate: 250, idleMs: 5}),
    row({id: 'warm', count: 100, rate: 3, idleMs: 200}),
    row({id: 'slow', count: 10, rate: 1, lastMs: 40, maxMs: 900, idleMs: 100}),
    row({id: 'flaky', count: 8, errors: 4, idleMs: 100})
  ]

  it('findUnused returns long-idle channels, never-executed included, longest first', () => {
    expect(findUnused(rows, {idleMs: 60_000}).map(r => r.id)).toEqual([
      'dead',
      'stale'
    ])
    expect(
      findUnused(rows, {idleMs: 60_000, includeNeverExecuted: false}).map(
        r => r.id
      )
    ).toEqual(['stale'])
  })

  it('findNeverExecuted', () => {
    expect(findNeverExecuted(rows).map(r => r.id)).toEqual(['dead'])
  })

  it('hottest ranks by rate or lifetime count', () => {
    expect(hottest(rows, 2).map(r => r.id)).toEqual(['hot', 'warm'])
    expect(hottest(rows, 1, 'count')[0].id).toBe('hot')
  })

  it('slowest ranks by max or last duration', () => {
    expect(slowest(rows, 1)[0].id).toBe('slow')
    expect(slowest(rows, 1, 'lastMs')[0].id).toBe('slow')
  })

  it('errorProne filters by error ratio', () => {
    const result = errorProne(rows)
    expect(result.map(r => r.id)).toEqual(['flaky'])
    expect(result[0].errorRatio).toBeCloseTo(4 / 12)
  })

  it('analyzers do not mutate their input', () => {
    const snapshot = JSON.stringify(rows)
    hottest(rows)
    slowest(rows)
    findUnused(rows)
    errorProne(rows)
    expect(JSON.stringify(rows)).toBe(snapshot)
  })
})
