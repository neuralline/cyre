// test/cyre-compile-flags.test.ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/index'

/*

      C.Y.R.E - C.O.M.P.I.L.E - F.L.A.G - C.O.V.E.R.A.G.E

      compile-pipeline.ts's compileAction() computes four flags on every
      registered channel - _hasFastPath, _hasProtections, _hasProcessing,
      _hasScheduling - plus a pre-compiled _pipeline array of talent
      functions for the "processing" category. These flags are what
      app.ts's call() checks FIRST (`if (action._hasFastPath) return await
      useDispatch(...)`) to skip straight past throttle/debounce/buffer/
      talent-pipeline logic entirely - they are the actual hot-path
      optimization this library is built around, not incidental
      bookkeeping. Despite that, nothing in the existing suite asserted on
      them directly before this file - flag-updates.test.ts covers a
      DIFFERENT set of flags (metricsState's system-level locked/
      operational/shutdown state), not these compiled per-action ones,
      despite the name suggesting otherwise.

      cyre.action()'s registration result conveniently exposes everything
      needed to test this without reaching into internal modules:
        - result.hasFastPath        - the computed _hasFastPath, mirrored
        - result.payload._hasFastPath / _hasProtections / _hasProcessing /
          _hasScheduling / _pipeline - the compiled action itself
        - result.message            - a human-readable summary that
          differs based on which flags are set (see cyre-actions.ts)

*/

describe('Cyre Compiled Action Flags', () => {
  beforeEach(async () => {
    cyre.clear()
    await cyre.init()
  })

  afterEach(() => {
    cyre.clear()
  })

  describe('Fast path detection', () => {
    it('should flag a plain channel with no talents as fast path', () => {
      const result = cyre.action({id: 'plain-channel', payload: {a: 1}})

      expect(result.ok).toBe(true)
      expect(result.hasFastPath).toBe(true)
      expect(result.payload?._hasFastPath).toBe(true)
      expect(result.payload?._hasProtections).toBe(false)
      expect(result.payload?._hasProcessing).toBe(false)
      expect(result.payload?._hasScheduling).toBe(false)
      expect(result.payload?._pipeline).toBeUndefined()
      expect(result.message).toContain('Fast path')
    })

    it('should still be fast path with plain non-talent fields set', () => {
      // dispatch/errorStrategy/priority/type have their own data
      // definitions but never set an operator, so they must not force a
      // channel off the fast path
      const result = cyre.action({
        id: 'plain-with-metadata',
        dispatch: 'parallel',
        errorStrategy: 'continue',
        priority: {level: 'low'}
      })

      expect(result.hasFastPath).toBe(true)
      expect(result.payload?._hasFastPath).toBe(true)
    })
  })

  describe('Protections flag', () => {
    it.each([
      ['throttle', {throttle: 500}],
      ['debounce', {debounce: 500}],
      ['buffer (number form)', {buffer: 500}],
      ['buffer (object form)', {buffer: {window: 500, strategy: 'overwrite'}}]
    ])(
      'should set _hasProtections and clear _hasFastPath for %s',
      (_label, fields) => {
        const result = cyre.action({id: `protections-${_label}`, ...fields})

        expect(result.ok).toBe(true)
        expect(result.payload?._hasProtections).toBe(true)
        expect(result.payload?._hasProcessing).toBe(false)
        expect(result.payload?._hasScheduling).toBe(false)
        expect(result.hasFastPath).toBe(false)
        expect(result.message).toContain('protections')
      }
    )

    it('should count block:false as a protection too - it has an operator regardless of value', () => {
      // data-definitions' block() only skips the 'block' operator when the
      // field is entirely absent (value === undefined) - an explicit
      // `block: false` still returns operator: 'block', so it still costs
      // the channel its fast path even though it's functionally a no-op.
      // This is a real, slightly surprising quirk worth pinning down.
      const result = cyre.action({id: 'explicit-block-false', block: false})

      expect(result.ok).toBe(true)
      expect(result.payload?._hasProtections).toBe(true)
      expect(result.hasFastPath).toBe(false)
    })

    it('should reject block:true as a blocking validation error, not a protection flag', () => {
      // block: true short-circuits compileAction entirely (the `blocking:
      // true` branch) - the returned compiledAction never reaches the
      // Object.assign that sets _hasFastPath/_hasProtections/etc, it only
      // carries _isBlocked/_blockReason
      const result = cyre.action({id: 'blocked-channel', block: true})

      expect(result.ok).toBe(false)
      expect(result.message).toContain('Channel creation failed')
      expect(result.payload?._isBlocked).toBe(true)
      expect(result.payload?._hasFastPath).toBeUndefined()
      expect(result.payload?._hasProtections).toBeUndefined()
    })
  })

  describe('Processing flag', () => {
    it.each([
      ['required', {required: true}],
      ['schema', {schema: (p: any) => ({ok: true, data: p})}],
      ['condition', {condition: () => true}],
      ['selector', {selector: (p: any) => p}],
      ['transform', {transform: (p: any) => p}],
      ['detectChanges', {detectChanges: true}]
    ])(
      'should set _hasProcessing and a 1-entry _pipeline for %s alone',
      (_label, fields) => {
        const result = cyre.action({id: `processing-${_label}`, ...fields})

        expect(result.ok).toBe(true)
        expect(result.payload?._hasProcessing).toBe(true)
        expect(result.payload?._hasProtections).toBe(false)
        expect(result.payload?._hasScheduling).toBe(false)
        expect(result.hasFastPath).toBe(false)
        expect(result.payload?._pipeline).toHaveLength(1)
        expect(typeof result.payload?._pipeline?.[0]).toBe('function')
      }
    )

    it('should accumulate one _pipeline entry per processing talent, in declaration order', () => {
      const result = cyre.action({
        id: 'multi-talent-pipeline',
        // Declaration order matters: compileAction iterates
        // Object.entries(action) in insertion order and pushes each
        // talent into the pipeline as it's encountered
        selector: (p: any) => p.data,
        condition: () => true,
        transform: (p: any) => ({...p, transformed: true})
      })

      expect(result.payload?._hasProcessing).toBe(true)
      expect(result.payload?._pipeline).toHaveLength(3)
    })

    it('should actually execute the pipeline in declaration order at call time', async () => {
      const order: string[] = []

      cyre.action({
        id: 'pipeline-execution-order',
        selector: (p: any) => {
          order.push('selector')
          return p.data
        },
        condition: (p: any) => {
          order.push('condition')
          return true
        },
        transform: (p: any) => {
          order.push('transform')
          return {...p, transformed: true}
        }
      })

      const handler = vi.fn()
      cyre.on('pipeline-execution-order', handler)

      const result = await cyre.call('pipeline-execution-order', {
        data: {value: 42}
      })

      expect(result.ok).toBe(true)
      expect(order).toEqual(['selector', 'condition', 'transform'])
      // selector extracted p.data, then transform added transformed: true
      // on top of THAT (each talent's output feeds the next)
      expect(handler).toHaveBeenCalledWith({value: 42, transformed: true})
    })
  })

  describe('Scheduling flag', () => {
    it.each([
      ['interval + repeat', {interval: 1000, repeat: 3}],
      ['delay + repeat', {delay: 500, repeat: 1}],
      ['repeat alone', {repeat: 5}]
    ])('should set _hasScheduling for %s', (_label, fields) => {
      const result = cyre.action({id: `scheduling-${_label}`, ...fields})

      expect(result.ok).toBe(true)
      expect(result.payload?._hasScheduling).toBe(true)
      expect(result.payload?._hasProtections).toBe(false)
      expect(result.payload?._hasProcessing).toBe(false)
      expect(result.hasFastPath).toBe(false)
      expect(result.message).toContain('scheduling')
    })
  })

  describe('Combined categories', () => {
    it('should set all three category flags and clear fast path when every category is present', () => {
      const result = cyre.action({
        id: 'kitchen-sink-channel',
        throttle: 1000,
        schema: (p: any) => ({ok: true, data: p}),
        interval: 2000,
        repeat: 2
      })

      expect(result.ok).toBe(true)
      expect(result.payload?._hasProtections).toBe(true)
      expect(result.payload?._hasProcessing).toBe(true)
      expect(result.payload?._hasScheduling).toBe(true)
      expect(result.hasFastPath).toBe(false)
      expect(result.payload?._hasFastPath).toBe(false)

      expect(result.message).toContain('protections')
      expect(result.message).toContain('processing talents')
      expect(result.message).toContain('scheduling')
    })

    it('documents a real mismatch: the status message always reports "0 processing talents"', () => {
      // cyre-actions.ts builds its status message from
      // `finalAction._processingTalents?.length` - but compile-pipeline.ts
      // never sets a field called _processingTalents anywhere, it only
      // sets _pipeline. So `_processingTalents` is always undefined and
      // the reported count is always 0, even when _pipeline genuinely has
      // several compiled talents. This test pins down the CURRENT
      // (buggy) behavior rather than silently working around it - if
      // cyre-actions.ts is ever fixed to read _pipeline.length instead,
      // this assertion is the one that should change.
      const result = cyre.action({
        id: 'talent-count-message-bug',
        required: true,
        selector: (p: any) => p,
        transform: (p: any) => p
      })

      expect(result.payload?._pipeline).toHaveLength(3)
      expect(result.message).toContain('0 processing talents')
    })
  })

  describe('Re-registration recomputes flags', () => {
    it('should flip _hasFastPath when a protection is removed on re-registration', () => {
      const first = cyre.action({id: 'recompiled-channel', throttle: 500})
      expect(first.hasFastPath).toBe(false)
      expect(first.payload?._hasProtections).toBe(true)

      // Re-registering the SAME id without throttle recompiles from
      // scratch - compileAction has no memory of the previous
      // registration, so the flags reflect only what's declared this time
      const second = cyre.action({id: 'recompiled-channel'})
      expect(second.hasFastPath).toBe(true)
      expect(second.payload?._hasProtections).toBe(false)
    })

    it('should flip _hasFastPath when a protection is added on re-registration', () => {
      const first = cyre.action({id: 'recompiled-channel-2'})
      expect(first.hasFastPath).toBe(true)

      const second = cyre.action({id: 'recompiled-channel-2', debounce: 300})
      expect(second.hasFastPath).toBe(false)
      expect(second.payload?._hasProtections).toBe(true)
    })
  })
})
