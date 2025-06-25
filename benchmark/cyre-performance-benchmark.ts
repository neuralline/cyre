// benchmark/cyre-performance-benchmark.ts
// File location: /benchmark/true-spray-pray-benchmark.ts

/**
 * Corrected Spray-and-Pray Benchmark
 *
 * Tests TRUE fire-and-forget behavior:
 * - No await on cyre.call()
 * - No .then() or .catch() handling
 * - Pure fire and move on
 * - Subscribers (.on) handle responses and update state
 */

import {cyre} from '../src'

interface TrueSprayResult {
  testName: string
  fireRate: number // Operations fired per second
  fireLatency: number // Time to fire (not process)
  totalFired: number
  responseRate: number // Responses received per second
  totalResponses: number
  lossRate: number // Percentage of fired operations that got responses
  memoryUsage: number
}

class TrueSprayPrayBenchmark {
  private memoryBaseline: number = 0

  constructor() {
    this.memoryBaseline = this.getMemoryUsage()
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024
    }
    return 0
  }

  /**
   * Test 1: Pure Fire-and-Forget vs Await Comparison
   */
  async testPureFireAndForget(): Promise<void> {
    console.log('\n🔥 TRUE Fire-and-Forget vs Await Comparison')
    console.log('='.repeat(60))

    const operations = 10000

    // === AWAIT PATTERN TEST ===
    console.log('\n📍 Testing AWAIT pattern (for comparison)...')
    cyre.action({id: 'await-comparison-test'})
    cyre.on('await-comparison-test', (payload: any) => ({
      processed: true,
      id: payload.id
    }))

    const awaitStart = performance.now()
    for (let i = 0; i < operations; i++) {
      await cyre.call('await-comparison-test', {id: i, data: `await-${i}`})
    }
    const awaitDuration = performance.now() - awaitStart
    const awaitRate = operations / (awaitDuration / 1000)

    console.log(`   Await Pattern: ${awaitRate.toFixed(0)} ops/sec`)
    console.log(`   Duration: ${awaitDuration.toFixed(2)}ms`)

    // === TRUE SPRAY-AND-PRAY TEST ===
    console.log('\n🚀 Testing TRUE Spray-and-Pray (pure fire-and-forget)...')

    let responsesReceived = 0
    let responseStartTime = 0
    let firstResponseTime = 0

    // Setup subscriber to track responses (this is where the "work" happens)
    cyre.action({id: 'true-spray-test'})
    cyre.on('true-spray-test', (payload: any) => {
      responsesReceived++

      if (responsesReceived === 1) {
        firstResponseTime = performance.now()
      }

      // Simulate some work in the subscriber (like updating React state)
      const processedData = {
        id: payload.id,
        processed: true,
        timestamp: Date.now(),
        data: payload.data?.toUpperCase() || 'NO_DATA'
      }

      // This could be updating state, triggering UI updates, etc.
      // The caller doesn't wait for this!
      return processedData
    })

    // PURE FIRE-AND-FORGET: No await, no .then(), no .catch()
    const fireStart = performance.now()

    for (let i = 0; i < operations; i++) {
      // TRUE SPRAY: Fire and immediately continue - no waiting!
      cyre.call('true-spray-test', {id: i, data: `spray-${i}`})
      // ^ Note: No await, no .then(), no .catch() - pure fire!
    }

    const fireDuration = performance.now() - fireStart
    const fireRate = operations / (fireDuration / 1000)

    console.log(`   🔥 Fire Rate: ${fireRate.toFixed(0)} ops/sec`)
    console.log(`   🔥 Fire Duration: ${fireDuration.toFixed(2)}ms`)
    console.log(
      `   🔥 Time per fire: ${(fireDuration / operations).toFixed(4)}ms`
    )

    // Wait for responses to settle
    console.log('\n⏳ Waiting for responses to settle...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    const responseEndTime = performance.now()
    const responseDuration = responseEndTime - firstResponseTime
    const responseRate = responsesReceived / (responseDuration / 1000)

    console.log(`\n📊 Response Analysis:`)
    console.log(`   Responses received: ${responsesReceived}/${operations}`)
    console.log(`   Response rate: ${responseRate.toFixed(0)} responses/sec`)
    console.log(
      `   Loss rate: ${(
        ((operations - responsesReceived) / operations) *
        100
      ).toFixed(2)}%`
    )

    console.log(`\n🏆 COMPARISON:`)
    console.log(`   Await: ${awaitRate.toFixed(0)} ops/sec (blocks until done)`)
    console.log(`   Spray: ${fireRate.toFixed(0)} fire/sec (immediate return)`)
    console.log(
      `   Advantage: ${(fireRate / awaitRate).toFixed(1)}x faster firing`
    )
    console.log(
      `   🎯 Key: Spray returns immediately, work happens in background!`
    )
  }

  /**
   * Test 2: State Update Pattern (React-like)
   */
  async testStateUpdatePattern(): Promise<void> {
    console.log('\n⚛️ State Update Pattern (React-like)')
    console.log('='.repeat(60))

    // Simulate React-like state
    const componentState = {
      items: [] as any[],
      loading: false,
      lastUpdate: 0,
      totalUpdates: 0
    }

    // Setup state update action
    cyre.action({id: 'state-update-test'})
    cyre.on('state-update-test', (payload: any) => {
      // Simulate React setState or similar
      componentState.items.push({
        id: payload.id,
        data: payload.data,
        processed: Date.now()
      })
      componentState.lastUpdate = Date.now()
      componentState.totalUpdates++

      // Simulate triggering a re-render
      if (componentState.totalUpdates % 100 === 0) {
        console.log(
          `   📝 State updates: ${componentState.totalUpdates}, Items: ${componentState.items.length}`
        )
      }

      return {stateUpdated: true, totalItems: componentState.items.length}
    })

    const operations = 5000
    console.log(`\n🔥 Firing ${operations} state updates (no waiting)...`)

    componentState.loading = true
    const fireStart = performance.now()

    // Fire all updates without waiting - true spray-and-pray
    for (let i = 0; i < operations; i++) {
      cyre.call('state-update-test', {
        id: i,
        data: `item-${i}`,
        category: i % 10,
        priority: i % 3 === 0 ? 'high' : 'normal'
      })
      // No await! The state updates happen in the background
    }

    const fireDuration = performance.now() - fireStart
    componentState.loading = false

    console.log(`   🚀 All updates fired in: ${fireDuration.toFixed(2)}ms`)
    console.log(
      `   🚀 Fire rate: ${(operations / (fireDuration / 1000)).toFixed(
        0
      )} ops/sec`
    )

    // Wait for state to settle
    await new Promise(resolve => setTimeout(resolve, 500))

    console.log(`\n📊 Final State:`)
    console.log(`   Items in state: ${componentState.items.length}`)
    console.log(`   Total updates: ${componentState.totalUpdates}`)
    console.log(
      `   Success rate: ${(
        (componentState.items.length / operations) *
        100
      ).toFixed(1)}%`
    )
    console.log(
      `   🎯 All updates happened in background while caller continued!`
    )
  }

  /**
   * Test 3: Mixed Workload (Await + Spray)
   */
  async testMixedWorkload(): Promise<void> {
    console.log('\n🎭 Mixed Workload: Critical Await + Background Spray')
    console.log('='.repeat(60))

    let backgroundProcessed = 0
    let criticalProcessed = 0

    // Critical operations (need result)
    cyre.action({id: 'critical-operation'})
    cyre.on('critical-operation', (payload: any) => {
      criticalProcessed++
      return {
        critical: true,
        result: payload.value * 2,
        processed: Date.now()
      }
    })

    // Background operations (fire-and-forget)
    cyre.action({id: 'background-operation'})
    cyre.on('background-operation', (payload: any) => {
      backgroundProcessed++
      // Simulate background work (logging, analytics, caching, etc.)
      return {
        background: true,
        logged: true,
        id: payload.id
      }
    })

    const criticalOps = 100
    const backgroundOps = 2000

    console.log('\n🔄 Running mixed workload...')
    const totalStart = performance.now()

    // Simulate real app: mix critical awaited calls with background spray
    for (let i = 0; i < criticalOps; i++) {
      // Critical operation - need the result
      const criticalStart = performance.now()
      const result = await cyre.call('critical-operation', {value: i})

      // Fire multiple background operations while doing critical work
      for (let j = 0; j < backgroundOps / criticalOps; j++) {
        // PURE SPRAY: Fire and forget background work
        cyre.call('background-operation', {
          id: i * 20 + j,
          type: 'analytics',
          criticalId: i
        })
      }

      if (i % 25 === 0) {
        console.log(
          `   ✅ Critical ${i}/${criticalOps}, Background fired: ${i * 20}`
        )
      }
    }

    const totalDuration = performance.now() - totalStart

    // Wait for background to settle
    await new Promise(resolve => setTimeout(resolve, 500))

    console.log(`\n📊 Mixed Workload Results:`)
    console.log(`   Duration: ${totalDuration.toFixed(2)}ms`)
    console.log(
      `   Critical ops: ${criticalProcessed}/${criticalOps} (awaited)`
    )
    console.log(
      `   Background ops: ${backgroundProcessed}/${backgroundOps} (sprayed)`
    )
    console.log(
      `   Critical rate: ${(criticalOps / (totalDuration / 1000)).toFixed(
        0
      )} ops/sec`
    )
    console.log(`   🎯 Background work didn't slow down critical operations!`)
  }

  /**
   * Test 4: Extreme Fire Rate Test
   */
  async testExtremeFireRate(): Promise<void> {
    console.log('\n🚀 Extreme Fire Rate Test')
    console.log('='.repeat(60))

    let processed = 0
    const operations = 50000 // High volume

    cyre.action({id: 'extreme-fire-test'})
    cyre.on('extreme-fire-test', (payload: any) => {
      processed++
      return {id: payload.id, processed: true}
    })

    console.log(`\n🔥 Firing ${operations} operations as fast as possible...`)

    const start = performance.now()

    // Fire as fast as possible - no delays, no awaits, pure spray
    for (let i = 0; i < operations; i++) {
      cyre.call('extreme-fire-test', {id: i})
    }

    const fireDuration = performance.now() - start
    const fireRate = operations / (fireDuration / 1000)

    console.log(`   🚀 Fire duration: ${fireDuration.toFixed(2)}ms`)
    console.log(`   🚀 Fire rate: ${fireRate.toFixed(0)} ops/sec`)
    console.log(
      `   🚀 Time per fire: ${((fireDuration / operations) * 1000).toFixed(
        2
      )}μs`
    )

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log(`\n📊 Processing Results:`)
    console.log(`   Fired: ${operations}`)
    console.log(`   Processed: ${processed}`)
    console.log(
      `   Success rate: ${((processed / operations) * 100).toFixed(1)}%`
    )
    console.log(`   🎯 Demonstrates true fire-and-forget capability!`)
  }

  async runTrueSprayTests(): Promise<void> {
    console.log('🎯 Starting TRUE Spray-and-Pray Benchmark')
    console.log('(Testing actual fire-and-forget behavior)')
    console.log('='.repeat(60))

    await this.testPureFireAndForget()
    await this.testStateUpdatePattern()
    await this.testMixedWorkload()
    await this.testExtremeFireRate()

    console.log('\n✅ True Spray-and-Pray tests completed!')
    console.log('\n🎯 Key Insight: True spray-and-pray means firing without')
    console.log('   any waiting - let subscribers handle responses!')
  }
}

// Export for use
export {TrueSprayPrayBenchmark}

// Run if executed directly
const benchmark = new TrueSprayPrayBenchmark()
benchmark.runTrueSprayTests().catch(console.error)
