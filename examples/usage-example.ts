// src/examples/usage-example.ts
// Example usage of the performance optimized data-definitions

import {
  compileActionWithStats,
  analyzeCompilationPerformance
} from '../src/schema/compilation-integration'
import {
  clearValidationCache,
  getValidationCacheStats
} from '../src/schema/data-definitions'
import {schema} from '../src/schema/cyre-schema'
import type {IO} from '../src/types/core'

/*

      C.Y.R.E - U.S.A.G.E - E.X.A.M.P.L.E
      
      Demonstrates performance optimized compilation:
      - Fast path actions (simple configurations)
      - Complex actions (using schema validation)
      - Cache usage and performance monitoring
      - Error handling with suggestions

*/

// Example 1: Fast path action (simple validation, cached)
const fastAction: Partial<IO> = {
  id: 'fast-action',
  type: 'user-click',
  log: true,
  payload: {message: 'Hello'}
}

// Example 1b: Another fast path action with throttle
const fastActionWithThrottle: Partial<IO> = {
  id: 'fast-action-throttle',
  type: 'button-click',
  throttle: 1000,
  payload: {action: 'click'}
}

// Example 2: Complex action (without schema for now to avoid optional() issue)
const complexAction: Partial<IO> = {
  id: 'complex-action',
  path: 'app/users/profile',
  condition: (payload: any) => payload.userId !== null,
  transform: (payload: any) => ({...payload, processed: true}),
  priority: {
    level: 'high',
    maxRetries: 3,
    timeout: 5000
  },
  detectChanges: true
}

// Example 3: Action with validation errors
const invalidAction: Partial<IO> = {
  id: '', // Error: empty ID
  throttle: -100, // Error: negative throttle
  debounce: 200, // Will conflict with throttle
  repeat: 0, // Blocking error
  maxWait: 50, // Error: less than debounce
  priority: 'invalid', // Error: not an object
  required: 'maybe' // Error: invalid value
}

/**
 * Demo function showing performance improvements
 */
export const demoPerformanceImprovements = (): void => {
  console.log('🚀 Cyre Data-Definitions Performance Demo\n')

  // Test fast action compilation
  console.log('1. Fast Action Compilation (cached validation)')
  const fastResult = compileActionWithStats(fastAction)
  console.log(
    `   ✅ Compiled successfully: ${
      fastResult.hasFastPath ? 'Fast Path' : 'Complex Path'
    }`
  )
  console.log(
    `   ⏱️  Compilation time: ${fastResult.compilationTime.toFixed(2)}ms`
  )
  console.log(
    `   📊 Errors: ${fastResult.errors.length}, Warnings: ${fastResult.warnings.length}\n`
  )

  // Test fast action with throttle (should still be fast path)
  console.log('1b. Fast Action with Throttle (protection talent)')
  const fastThrottleResult = compileActionWithStats(fastActionWithThrottle)
  console.log(
    `   ✅ Compiled successfully: ${
      fastThrottleResult.hasFastPath ? 'Fast Path' : 'Complex Path'
    }`
  )
  console.log(
    `   ⏱️  Compilation time: ${fastThrottleResult.compilationTime.toFixed(
      2
    )}ms`
  )
  console.log(
    `   🛡️  Has protections: ${fastThrottleResult.compiledAction._hasProtections}\n`
  )

  // Test same action again (should hit cache)
  console.log('2. Repeated Fast Action (cache hit)')
  const fastResult2 = compileActionWithStats(fastAction)
  console.log(
    `   ⚡ Cache benefit: ${(
      fastResult.compilationTime - fastResult2.compilationTime
    ).toFixed(2)}ms faster`
  )
  console.log(`   📈 Cache stats:`, getValidationCacheStats(), '\n')

  // Test complex action compilation
  console.log('3. Complex Action Compilation (fast validation)')
  const complexResult = compileActionWithStats(complexAction)
  console.log(
    `   ✅ Compiled successfully: ${
      complexResult.hasFastPath ? 'Fast Path' : 'Complex Path'
    }`
  )
  console.log(
    `   ⏱️  Compilation time: ${complexResult.compilationTime.toFixed(2)}ms`
  )
  console.log(
    `   🎯 Processing talents: ${complexResult.compiledAction._processingTalents?.join(
      ', '
    )}`
  )
  console.log(`   📊 Warnings: ${complexResult.warnings.length}\n`)

  // Test validation error handling
  console.log('4. Validation Error Handling (with suggestions)')
  const errorResult = compileActionWithStats(invalidAction)
  console.log(`   ❌ Validation failed as expected`)
  console.log(`   📝 Errors with suggestions:`)
  errorResult.errors.forEach((error, index) => {
    console.log(`      ${index + 1}. ${error}`)
  })
  console.log('')

  // Performance analysis
  console.log('5. Performance Analysis')
  const analysis = analyzeCompilationPerformance()
  console.log(`   🎯 Efficiency: ${analysis.efficiency}`)
  console.log(
    `   ⚡ Fast path ratio: ${(analysis.fastPathRatio * 100).toFixed(1)}%`
  )
  console.log(`   ⏱️  Average time: ${analysis.averageTime.toFixed(2)}ms`)
  console.log(`   💡 Recommendations:`)
  analysis.recommendations.forEach(rec => {
    console.log(`      • ${rec}`)
  })
  console.log('')

  // Show compilation stats
  console.log('6. Compilation Statistics')
  console.log(`   📊 Stats:`, fastResult.stats)
}

/**
 * Benchmark comparison function
 */
export const benchmarkValidationPerformance = (
  iterations: number = 1000
): void => {
  console.log(`\n🏁 Benchmark: ${iterations} iterations\n`)

  // Warm up
  for (let i = 0; i < 10; i++) {
    compileActionWithStats(fastAction)
  }

  // Benchmark fast actions (truly simple - no protections/processing/scheduling)
  const startFast = performance.now()
  for (let i = 0; i < iterations; i++) {
    compileActionWithStats({
      id: `fast-${i}`,
      type: 'simple',
      log: true
    })
  }
  const fastTime = performance.now() - startFast

  // Clear cache and benchmark actions with protections
  clearValidationCache()
  const startProtected = performance.now()
  for (let i = 0; i < iterations; i++) {
    compileActionWithStats({
      id: `protected-${i}`,
      type: 'throttled',
      throttle: 1000
    })
  }
  const protectedTime = performance.now() - startProtected

  // Benchmark complex actions with processing
  clearValidationCache()
  const startComplex = performance.now()
  for (let i = 0; i < iterations; i++) {
    compileActionWithStats({
      id: `complex-${i}`,
      condition: (payload: any) => payload.count > 0,
      priority: {level: 'medium'}
    })
  }
  const complexTime = performance.now() - startComplex

  console.log(
    `Fast actions:      ${fastTime.toFixed(2)}ms (${(
      fastTime / iterations
    ).toFixed(3)}ms per action)`
  )
  console.log(
    `Protected actions: ${protectedTime.toFixed(2)}ms (${(
      protectedTime / iterations
    ).toFixed(3)}ms per action)`
  )
  console.log(
    `Complex actions:   ${complexTime.toFixed(2)}ms (${(
      complexTime / iterations
    ).toFixed(3)}ms per action)`
  )
  console.log(
    `Protection overhead: ${(protectedTime / fastTime).toFixed(
      1
    )}x slower than fast path`
  )
  console.log(
    `Complex overhead: ${(complexTime / fastTime).toFixed(
      1
    )}x slower than fast path`
  )

  const cacheStats = getValidationCacheStats()
  console.log(`Cache usage: ${cacheStats.size}/${cacheStats.limit} entries`)
}

// Run demo if this file is executed directly
demoPerformanceImprovements()
benchmarkValidationPerformance()
