// test/use-cloud.test.ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre, useCloud, useBranch, poll, supabaseLive} from '../src/index'
import {cloudState} from '../src/context/cloud-state'

/*

      C.Y.R.E - U.S.E - C.L.O.U.D - T.E.S.T

      useCloud over poll() and supabaseLive(), against a fake Supabase
      client that mirrors the real Realtime API surface
      (channel().on().subscribe(cb), removeChannel, presenceState).

*/

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const waitFor = async (check: () => boolean, timeout = 1000): Promise<void> => {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out')
    await sleep(5)
  }
}

const fakeSupabase = () => {
  const channels: any[] = []
  const client = {
    channel: vi.fn((name: string, options?: any) => {
      const channel: any = {
        name,
        options,
        handlers: [] as Array<{type: string; filter: any; cb: (p: any) => void}>,
        statusCb: undefined as undefined | ((s: string, e?: Error) => void),
        removed: false,
        on(type: string, filter: any, cb: (p: any) => void) {
          channel.handlers.push({type, filter, cb})
          return channel
        },
        subscribe(cb?: (s: string, e?: Error) => void) {
          channel.statusCb = cb
          return channel
        },
        presenceState: () => ({user1: [{online: true}]})
      }
      channels.push(channel)
      return channel
    }),
    removeChannel: vi.fn((channel: any) => {
      channel.removed = true
      return Promise.resolve('ok')
    })
  }
  const last = () => channels[channels.length - 1]
  const fire = (type: string, payload: any) =>
    last()
      .handlers.filter((h: any) => h.type === type)
      .forEach((h: any) => h.cb(payload))
  const status = (s: string, e?: Error) => last().statusCb?.(s, e)
  return {client, channels, last, fire, status}
}

describe('useCloud', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    cyre.reset()
    await cyre.init()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cyre.clear()
  })

  describe('hook shape', () => {
    it('exposes the useCyre verbs plus source controls', () => {
      const cloud = useCloud(cyre, {
        id: 'shape',
        source: poll({every: 1000, fetch: () => [], immediate: false}),
        autoStart: false
      })

      for (const verb of ['call', 'on', 'get', 'forget', 'destroy', 'getStats', 'pause', 'resume', 'refresh', 'status']) {
        expect(typeof (cloud as any)[verb]).toBe('function')
      }
      expect(cloud.id).toBe('shape')
      expect(cloud.statusId).toBe('shape/status')
      expect(cloud.get()?.id).toBe('shape')
      expect(cloud.status().status).toBe('idle')
    })

    it('registers a normal channel - talents from the config apply', async () => {
      const handler = vi.fn()
      const cloud = useCloud(cyre, {
        id: 'talents',
        transform: (rows: number[]) => rows.length,
        source: poll({every: 1000, fetch: () => [1, 2, 3]})
      })
      cloud.on(handler)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(3)
    })

    it('rejects a missing source', () => {
      expect(() => useCloud(cyre, {id: 'nope'} as any)).toThrow(/source/)
    })
  })

  describe('poll()', () => {
    it('pulls immediately and on its interval', async () => {
      const fetcher = vi.fn(() => ({value: 1}))
      const handler = vi.fn()
      const cloud = useCloud(cyre, {id: 'interval', source: poll({every: 60, fetch: fetcher})})
      cloud.on(handler)

      await sleep(230)
      expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(3)
      expect(cloud.status().status).toBe('live')
      cloud.forget()
    })

    it('unwraps Supabase {data, error} query results', async () => {
      const handler = vi.fn()
      const cloud = useCloud(cyre, {
        id: 'unwrap',
        source: poll({every: 1000, fetch: async () => ({data: [{id: 1}], error: null, count: null})})
      })
      cloud.on(handler)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith([{id: 1}])
    })

    it('reports errors as retrying and backs off', async () => {
      const fetcher = vi.fn(async () => ({data: null, error: {message: 'JWT expired'}}))
      const cloud = useCloud(cyre, {id: 'failing', source: poll({every: 40, fetch: fetcher})})

      await waitFor(() => cloud.status().errorCount > 0)
      expect(cloud.status().status).toBe('retrying')
      expect(cloud.status().lastError).toBe('JWT expired')

      // backoff doubles 40 → 80 → 160ms, so far fewer pulls than ticks
      await sleep(250)
      expect(fetcher.mock.calls.length).toBeLessThanOrEqual(4)
      cloud.forget()
    })

    it('shares one in-flight pull between overlapping refreshes', async () => {
      let resolve!: (v: unknown) => void
      const fetcher = vi.fn(() => new Promise(r => (resolve = r)))
      const cloud = useCloud(cyre, {
        id: 'single-flight',
        source: poll({every: 10_000, fetch: fetcher, immediate: false})
      })

      const a = cloud.refresh()
      const b = cloud.refresh()
      resolve([1])
      await Promise.all([a, b])
      expect(fetcher).toHaveBeenCalledTimes(1)
      cloud.forget()
    })

    it('routes into an existing channel with `to`', async () => {
      const existing = vi.fn()
      cyre.action({id: 'inventory/stock'})
      cyre.on('inventory/stock', existing)

      useCloud(cyre, {
        id: 'stock-feed',
        to: 'inventory/stock',
        source: poll({every: 1000, fetch: () => ({sku: 'A1', qty: 4})})
      })

      await waitFor(() => existing.mock.calls.length > 0)
      expect(existing).toHaveBeenCalledWith({sku: 'A1', qty: 4})
    })

    it('uses ETag and skips 304 responses for URL sources', async () => {
      const responses = [
        new Response(JSON.stringify({v: 1}), {status: 200, headers: {etag: '"abc"'}}),
        new Response(null, {status: 304})
      ]
      const fetchMock = vi.fn(async (_url: any, init: any) => {
        fetchMock.headersSeen.push(new Headers(init.headers).get('if-none-match'))
        return responses.shift()!
      }) as any
      fetchMock.headersSeen = [] as (string | null)[]
      vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)

      const handler = vi.fn()
      const cloud = useCloud(cyre, {
        id: 'etag',
        source: poll({every: 10_000, fetch: 'https://api.example.com/v'})
      })
      cloud.on(handler)

      await waitFor(() => handler.mock.calls.length === 1)
      await cloud.refresh()

      expect(fetchMock.headersSeen).toEqual([null, '"abc"'])
      expect(handler).toHaveBeenCalledTimes(1) // the 304 delivered nothing
      cloud.forget()
    })

    it('pause() aborts the in-flight request and resume() reconnects', async () => {
      let seenSignal: AbortSignal | undefined
      const fetcher = vi.fn((signal: AbortSignal) => {
        seenSignal = signal
        return new Promise(() => {}) // never resolves
      })
      const cloud = useCloud(cyre, {id: 'pausable', source: poll({every: 10_000, fetch: fetcher})})

      await waitFor(() => !!seenSignal)
      cloud.pause()
      expect(seenSignal!.aborted).toBe(true)
      expect(cloud.status().status).toBe('paused')

      cloud.resume()
      await waitFor(() => fetcher.mock.calls.length === 2)
      expect(cloud.status().status).toBe('connecting')
      cloud.forget()
    })
  })

  describe('supabaseLive()', () => {
    it('subscribes to postgres_changes with the given filter', () => {
      const sb = fakeSupabase()
      useCloud(cyre, {
        id: 'orders/live',
        source: supabaseLive(sb.client, {table: 'orders', filter: 'store_id=eq.42'})
      })

      const handler = sb.last().handlers[0]
      expect(handler.type).toBe('postgres_changes')
      expect(handler.filter).toEqual({event: '*', schema: 'public', table: 'orders', filter: 'store_id=eq.42'})
    })

    it('watches several tables over one Realtime channel and routes each by meta.table', async () => {
      const sb = fakeSupabase()
      const members = vi.fn()
      const notes = vi.fn()
      cyre.action({id: 'room/members'})
      cyre.on('room/members', members)
      cyre.action({id: 'room/notes'})
      cyre.on('room/notes', notes)
      const project = 'p1'

      useCloud(cyre, {
        id: 'room/live',
        source: supabaseLive(sb.client, {
          channel: () => `project:${project}`,
          tables: [
            {table: 'project_members', filter: () => `project_id=eq.${project}`},
            {table: 'project_notes', event: 'INSERT', filter: () => `project_id=eq.${project}`}
          ]
        }),
        to: (_payload, meta) => (meta.table === 'project_members' ? 'room/members' : 'room/notes')
      })

      expect(sb.channels).toHaveLength(1)
      expect(sb.last().name).toBe('project:p1')
      expect(sb.last().handlers.map((h: any) => h.filter)).toEqual([
        {event: '*', schema: 'public', table: 'project_members', filter: 'project_id=eq.p1'},
        {event: 'INSERT', schema: 'public', table: 'project_notes', filter: 'project_id=eq.p1'}
      ])
      sb.status('SUBSCRIBED')

      const memberChange = {eventType: 'UPDATE', new: {user_id: 'u2'}}
      const noteChange = {eventType: 'INSERT', new: {id: 'n1'}}
      sb.last().handlers[0].cb(memberChange)
      sb.last().handlers[1].cb(noteChange)
      await waitFor(() => members.mock.calls.length === 1 && notes.mock.calls.length === 1)
      expect(members).toHaveBeenCalledWith(memberChange)
      expect(notes).toHaveBeenCalledWith(noteChange)
    })

    it('rejects a source with nothing to watch, and accepts tables alone', () => {
      const sb = fakeSupabase()
      expect(() => supabaseLive(sb.client, {tables: []})).toThrow()
      expect(() => supabaseLive(sb.client, {tables: [{table: 'orders'}]})).not.toThrow()
    })

    it('routes changes by eventType into existing channels', async () => {
      const sb = fakeSupabase()
      const created = vi.fn()
      const removed = vi.fn()
      cyre.action({id: 'orders/created'})
      cyre.on('orders/created', created)
      cyre.action({id: 'orders/removed'})
      cyre.on('orders/removed', removed)

      useCloud(cyre, {
        id: 'orders/live',
        source: supabaseLive(sb.client, {table: 'orders'}),
        to: {INSERT: 'orders/created', DELETE: 'orders/removed'}
      })
      sb.status('SUBSCRIBED')

      const insert = {eventType: 'INSERT', new: {id: 7, total: 20}, old: {}}
      const del = {eventType: 'DELETE', new: {}, old: {id: 3}}
      sb.fire('postgres_changes', insert)
      sb.fire('postgres_changes', del)

      await waitFor(() => created.mock.calls.length === 1 && removed.mock.calls.length === 1)
      expect(created).toHaveBeenCalledWith(insert)
      expect(removed).toHaveBeenCalledWith(del)
    })

    it('resyncs on first subscribe and again after a reconnect', async () => {
      const sb = fakeSupabase()
      const snapshot = vi.fn()
      const resyncFetch = vi.fn(async () => ({data: [{id: 1}], error: null}))
      cyre.action({id: 'orders/snapshot'})
      cyre.on('orders/snapshot', snapshot)

      const cloud = useCloud(cyre, {
        id: 'orders/live',
        source: supabaseLive(sb.client, {table: 'orders'}),
        resync: poll({every: 60_000, fetch: resyncFetch}),
        to: {resync: 'orders/snapshot'}
      })

      sb.status('SUBSCRIBED')
      await waitFor(() => snapshot.mock.calls.length === 1)
      expect(snapshot).toHaveBeenCalledWith([{id: 1}])
      expect(cloud.status().status).toBe('live')

      sb.status('CHANNEL_ERROR', new Error('socket dropped'))
      expect(cloud.status().status).toBe('retrying')
      expect(cloud.status().lastError).toBe('socket dropped')

      sb.status('SUBSCRIBED')
      await waitFor(() => snapshot.mock.calls.length === 2)
      expect(cloud.status().status).toBe('live')
      expect(cloud.status().lastSyncAt).toBeGreaterThan(0)
    })

    it('delivers broadcast payloads and presence state', async () => {
      const sb = fakeSupabase()
      const cursor = vi.fn()
      const online = vi.fn()
      cyre.action({id: 'ui/cursor'})
      cyre.on('ui/cursor', cursor)
      cyre.action({id: 'ui/online'})
      cyre.on('ui/online', online)

      useCloud(cyre, {
        id: 'room',
        source: supabaseLive(sb.client, {broadcast: 'cursor-move', presence: true}),
        to: {'cursor-move': 'ui/cursor', presence: 'ui/online'}
      })

      sb.fire('broadcast', {type: 'broadcast', event: 'cursor-move', payload: {x: 1, y: 2}})
      sb.fire('presence', {})

      await waitFor(() => cursor.mock.calls.length === 1 && online.mock.calls.length === 1)
      expect(cursor).toHaveBeenCalledWith({x: 1, y: 2})
      expect(online).toHaveBeenCalledWith({user1: [{online: true}]})
    })

    it('pause() removes the Realtime channel and resume() rejoins', () => {
      const sb = fakeSupabase()
      const cloud = useCloud(cyre, {id: 'rejoin', source: supabaseLive(sb.client, {table: 'orders'})})

      cloud.pause()
      expect(sb.client.removeChannel).toHaveBeenCalledTimes(1)
      expect(sb.channels[0].removed).toBe(true)

      cloud.resume()
      expect(sb.client.channel).toHaveBeenCalledTimes(2)
    })

    it('requires something to subscribe to', () => {
      expect(() => supabaseLive(fakeSupabase().client, {} as any)).toThrow()
    })
  })

  describe('core integration', () => {
    it('cyre.forget(id) disconnects the source', () => {
      const sb = fakeSupabase()
      useCloud(cyre, {id: 'forgettable', source: supabaseLive(sb.client, {table: 't'})})

      expect(cyre.forget('forgettable')).toBe(true)
      expect(sb.client.removeChannel).toHaveBeenCalledTimes(1)
      expect(cloudState.get('forgettable')).toBeUndefined()
    })

    it('cyre.pause(id) / cyre.resume(id) control the source', () => {
      const sb = fakeSupabase()
      const cloud = useCloud(cyre, {id: 'via-core', source: supabaseLive(sb.client, {table: 't'})})

      cyre.pause('via-core')
      expect(cloud.status().status).toBe('paused')
      cyre.resume('via-core')
      expect(cloud.status().status).toBe('connecting')
    })

    it('cyre.clear() tears every source down', () => {
      const sb = fakeSupabase()
      useCloud(cyre, {id: 'a', source: supabaseLive(sb.client, {table: 't'})})
      useCloud(cyre, {id: 'b', source: supabaseLive(sb.client, {table: 't'})})

      cyre.clear()
      expect(sb.client.removeChannel).toHaveBeenCalledTimes(2)
      expect(cloudState.size()).toBe(0)
    })

    it('publishes connection changes on the status channel', async () => {
      const sb = fakeSupabase()
      const statuses: string[] = []
      const cloud = useCloud(cyre, {
        id: 'watched',
        source: supabaseLive(sb.client, {table: 't'}),
        autoStart: false
      })
      cyre.on(cloud.statusId, (snapshot: any) => {
        statuses.push(snapshot.status)
      })

      cloud.resume()
      sb.status('SUBSCRIBED')
      await waitFor(() => statuses.includes('live'))
      expect(statuses).toEqual(['connecting', 'live'])
    })

    it('shows up in getMetrics()', () => {
      useCloud(cyre, {id: 'metered', source: poll({every: 1000, fetch: () => 1, immediate: false})})
      const metrics: any = cyre.getMetrics()
      expect(metrics.stores.cloudSources).toBe(1)
    })

    it('works inside a branch', async () => {
      // Static import (top of file), not `await import()` - vitest.setup.ts
      // calls vi.resetModules() after every test, so a dynamic import here
      // would load a fresh, never-initialized cyre module graph
      const branch = useBranch(cyre, {id: 'shop'}) as any
      const handler = vi.fn()
      const cloud = useCloud(branch, {id: 'prices', source: poll({every: 1000, fetch: () => 9})})
      cloud.on(handler)

      expect(cloud.id).toBe('shop/prices')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(9)
    })
  })

  describe('boot-time sources (client getter, live filter, resync function)', () => {
    it('accepts an async client getter and connects once it resolves', async () => {
      const sb = fakeSupabase()
      const cloud = useCloud(cyre, {
        id: 'async-client',
        source: supabaseLive(async () => sb.client, {table: 'orders'})
      })

      await waitFor(() => sb.channels.length === 1)
      sb.status('SUBSCRIBED')
      expect(cloud.status().status).toBe('live')
    })

    it('stays idle when the getter returns no client (not configured)', async () => {
      const cloud = useCloud(cyre, {
        id: 'no-client',
        source: supabaseLive(() => null, {table: 'orders'})
      })
      await sleep(10)
      expect(cloud.status().status).toBe('idle')
    })

    it('does not subscribe if paused while the client was still resolving', async () => {
      const sb = fakeSupabase()
      let release!: () => void
      const gate = new Promise<void>(r => (release = r))
      const cloud = useCloud(cyre, {
        id: 'slow-client',
        source: supabaseLive(async () => {
          await gate
          return sb.client
        }, {table: 'orders'})
      })

      cloud.pause()
      release()
      await sleep(10)
      expect(sb.channels.length).toBe(0)
    })

    it('reads channel/filter getters on every connect', async () => {
      const sb = fakeSupabase()
      let projectId = 'p1'
      const cloud = useCloud(cyre, {
        id: 'per-project',
        autoStart: false,
        source: supabaseLive(sb.client, {
          table: 'project_members',
          channel: () => `project_members:${projectId}`,
          filter: () => `project_id=eq.${projectId}`
        })
      })

      cloud.resume()
      projectId = 'p2'
      cloud.pause()
      cloud.resume()

      expect(sb.channels.map(c => c.name)).toEqual(['project_members:p1', 'project_members:p2'])
      expect(sb.channels[1].handlers[0].filter.filter).toBe('project_id=eq.p2')
      expect(sb.channels[0].removed).toBe(true)
    })

    it('runs a resync function on every subscribe and routes its result', async () => {
      const sb = fakeSupabase()
      const snapshot = vi.fn()
      cyre.action({id: 'members/snapshot'})
      cyre.on('members/snapshot', snapshot)

      useCloud(cyre, {
        id: 'resync-fn',
        source: supabaseLive(sb.client, {table: 'project_members'}),
        resync: async () => [{user: 'a'}],
        to: {resync: 'members/snapshot'}
      })

      sb.status('SUBSCRIBED')
      await waitFor(() => snapshot.mock.calls.length === 1)
      sb.status('CHANNEL_ERROR')
      sb.status('SUBSCRIBED')
      await waitFor(() => snapshot.mock.calls.length === 2)
      expect(snapshot).toHaveBeenCalledWith([{user: 'a'}])
    })

    it('a resync function returning undefined delivers nothing but records the sync', async () => {
      const sb = fakeSupabase()
      const reload = vi.fn(async () => undefined)
      const handler = vi.fn()
      const cloud = useCloud(cyre, {
        id: 'resync-void',
        source: supabaseLive(sb.client, {table: 'project_members'}),
        resync: reload
      })
      cloud.on(handler)

      sb.status('SUBSCRIBED')
      await waitFor(() => reload.mock.calls.length === 1)
      await waitFor(() => (cloud.status().lastSyncAt || 0) > 0)
      expect(handler).not.toHaveBeenCalled()
    })

    it('collapses a burst of changes into one handler run with channel debounce', async () => {
      const sb = fakeSupabase()
      const reload = vi.fn()
      const cloud = useCloud(cyre, {
        id: 'debounced-changes',
        debounce: 100,
        source: supabaseLive(sb.client, {table: 'project_notes'})
      })
      cloud.on(reload)

      for (let i = 0; i < 5; i++) sb.fire('postgres_changes', {eventType: 'INSERT', new: {id: i}})
      await sleep(180)
      expect(reload).toHaveBeenCalledTimes(1)
    })
  })
})
