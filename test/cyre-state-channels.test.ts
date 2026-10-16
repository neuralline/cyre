// test/cyre-state-channels.test.ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre, useCyre} from '../src/index'

/*

      C.Y.R.E - S.T.A.T.E - C.H.A.N.N.E.L.S - T.E.S.T

      `state: true` channels hold a value: callable with zero subscribers
      (no "no subscriber" error), readable with the typed cyre.value(id),
      and still a normal channel for any subscriber that does listen.

*/

describe('state channels', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    cyre.reset()
    await cyre.init()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cyre.clear()
  })

  it('can be called with no subscribers and holds the value', async () => {
    cyre.action({id: 'review/state', state: true})

    const result = await cyre.call('review/state', {role: 'owner', pending: 2})

    expect(result.ok).toBe(true)
    expect(result.payload).toEqual({role: 'owner', pending: 2})
    expect(cyre.value<{role: string}>('review/state')?.role).toBe('owner')
  })

  it('a plain channel with no subscribers still fails, a state channel does not', async () => {
    cyre.action({id: 'plain'})
    cyre.action({id: 'held', state: true})

    expect((await cyre.call('plain', 1)).ok).toBe(false)
    expect((await cyre.call('held', 1)).ok).toBe(true)
  })

  it('starts from the registered default payload', () => {
    cyre.action({id: 'theme/state', state: true, payload: {name: 'dark'}})
    expect(cyre.value('theme/state')).toEqual({name: 'dark'})
  })

  it('keeps the latest value across calls and remembers the previous one', async () => {
    cyre.action({id: 'counter', state: true})
    await cyre.call('counter', 1)
    await cyre.call('counter', 2)

    expect(cyre.value('counter')).toBe(2)
    expect(cyre.getPrevious('counter')).toBe(1)
  })

  it('still dispatches to subscribers when there are some', async () => {
    const outpost = vi.fn()
    cyre.action({id: 'user/state', state: true})
    cyre.on('user/state', outpost)

    await cyre.call('user/state', {id: 'u1'})

    expect(outpost).toHaveBeenCalledWith({id: 'u1'})
    expect(cyre.value('user/state')).toEqual({id: 'u1'})
  })

  it('stores the response too, so cyre.get(id).res.payload readers keep working', async () => {
    cyre.action({id: 'legacy/read', state: true})
    await cyre.call('legacy/read', [1, 2, 3])
    expect(cyre.get('legacy/read')?.res?.payload).toEqual([1, 2, 3])
  })

  it('applies talents before storing (transform, detectChanges)', async () => {
    cyre.action({id: 'names', state: true, transform: (list: string[]) => list.map(n => n.toUpperCase()), detectChanges: true})

    expect((await cyre.call('names', ['ana'])).ok).toBe(true)
    expect(cyre.value('names')).toEqual(['ANA'])
  })

  it('never chains a stored value that looks like an IntraLink', async () => {
    const target = vi.fn()
    cyre.action({id: 'other'})
    cyre.on('other', target)
    cyre.action({id: 'looks-like-link', state: true})

    await cyre.call('looks-like-link', {id: 'other', payload: 1})

    expect(target).not.toHaveBeenCalled()
  })

  it('rejects state: true with keepPayload: false', () => {
    const result = cyre.action({id: 'bad', state: true, keepPayload: false})
    expect(result.ok).toBe(false)
  })

  it('rejects a non-boolean state', () => {
    const result = cyre.action({id: 'bad-type', state: 'yes' as any})
    expect(result.ok).toBe(false)
  })

  it('useCyre exposes value()', async () => {
    const hook = useCyre<{n: number}>(cyre, {id: 'hooked', state: true})
    await hook.call({n: 5})
    expect(hook.value()).toEqual({n: 5})
  })

  it('is undefined for a channel that was never called', () => {
    cyre.action({id: 'empty', state: true})
    expect(cyre.value('empty')).toBeUndefined()
  })

  it('a call with no payload re-broadcasts the current value instead of resetting to the default', async () => {
    const outpost = vi.fn()
    cyre.action({id: 'mode', state: true, payload: 'idle'})
    cyre.on('mode', outpost)
    await cyre.call('mode', 'busy')
    await cyre.call('mode')

    expect(cyre.value('mode')).toBe('busy')
    expect(outpost).toHaveBeenLastCalledWith('busy')
  })
})
