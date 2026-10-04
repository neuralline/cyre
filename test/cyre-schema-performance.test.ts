// test/cyre-schema-performance.test.ts
// Vitest coverage for the two performance-oriented schema helpers in
// src/schema/cyre-schema.ts - fast() and memoize() - both of which had
// latent correctness bugs documented in claude/cyre-codebase-analysis.md
// Update 6 and fixed in this session. Nothing in demo/ exercises either
// helper (Update 6 confirmed that), so this is the first coverage either
// one has ever gotten, manual or automated.
//
// Both bugs were confirmed live with a standalone smoke test (compiled
// with tsc against stubbed ../types/core and ../components/sensor imports,
// run under plain node) before this suite was written, so the assertions
// below are known-good against the actual fixed source, not just reasoned
// through.
import {describe, it, expect} from 'vitest'
import {fast, memoize, string, number, object} from '../src/schema/cyre-schema'

describe('schema.fast()', () => {
  it('does not collide two schemas with identical source text but different captured values', () => {
    // string().minLength(3) and string().minLength(10) are two distinct
    // closures whose *literal source* is identical - the old cache, keyed
    // by schema.toString(), could not tell them apart and would silently
    // hand back whichever validator was cached first for both.
    const shortMin = fast(string().minLength(3))
    const longMin = fast(string().minLength(10))

    expect(shortMin).not.toBe(longMin)

    expect(shortMin('ab').ok).toBe(false) // too short for min 3
    expect(longMin('ab').ok).toBe(false) // too short for min 10
    expect(shortMin('abcd').ok).toBe(true) // satisfies min 3
    expect(longMin('abcd').ok).toBe(false) // still short of min 10
  })

  it('caches the wrapper per schema object, returning the same instance on repeat calls', () => {
    const schema = string().minLength(5)
    const first = fast(schema)
    const second = fast(schema)
    expect(first).toBe(second)
  })

  it('validates normally in production by default - the old unconditional bypass is gone', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const validator = fast(string().minLength(50))
      const result = validator('too short')
      expect(result.ok).toBe(false)
    } finally {
      process.env.NODE_ENV = original
    }
  })

  it('still allows explicitly opting into the production bypass', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const validator = fast(string().minLength(50), {
        skipValidationInProduction: true
      })
      const result = validator('too short')
      expect(result.ok).toBe(true)
    } finally {
      process.env.NODE_ENV = original
    }
  })
})

describe('schema.memoize()', () => {
  it('does not cache primitives across genuinely different values', () => {
    const validator = memoize(number().min(0).max(100))
    expect(validator(5).ok).toBe(true)
    expect(validator(5).ok).toBe(true) // cached hit, same result
    expect(validator(500).ok).toBe(false) // different value, not the stale cached result
  })

  it('re-validates an object payload after its contents change, even on the same object reference', () => {
    // This is the exact bug from analysis doc Update 6: the old cache was
    // keyed by object identity (`cache.has(value)` with the raw object as
    // the Map key), so mutating the same reference between calls returned
    // the first call's now-stale result instead of re-validating current
    // contents - a realistic scenario with buffered/reused payload objects.
    const validator = memoize(object({n: number().positive()}))
    const payload: {n: number} = {n: 5}

    expect(validator(payload).ok).toBe(true)

    payload.n = -5 // mutate the SAME object reference
    const afterMutation = validator(payload)
    expect(afterMutation.ok).toBe(false)
  })

  it('falls back to direct validation (no caching) for values that cannot be structurally keyed', () => {
    // A circular reference can't be JSON.stringify'd - the fix should
    // validate directly rather than throwing.
    const validator = memoize(object({n: number()}))
    const circular: any = {n: 5}
    circular.self = circular

    expect(() => validator(circular)).not.toThrow()
  })
})
