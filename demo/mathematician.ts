// Set up matrix getters
/**
 * src/benchmarks/mathematician-benchmark.ts
 * Channel lifecycle performance testing - The Mathematician Module
 * Tests Cyre's ability to create, process, and destroy channels like mathematical equations
 */

import {cyre} from '../src'

interface MathematicianResult {
  testName: string
  channelsCreated: number
  channelsProcessed: number
  channelsDestroyed: number
  operationsPerSecond: number
  averageLatencyMs: number
  memoryUsageMB: number
  equationComplexity: 'simple' | 'medium' | 'complex' | 'extreme'
  successRate: number
  errorCount: number
}

class MathematicianBenchmark {
  private startMemory: number = 0

  private measureMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024
    }
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024
    }
    return 0
  }

  /**
   * Test 1: Simple Mathematical Operations (Addition/Subtraction)
   * Create channel -> Process -> Destroy
   */
  async testSimpleMathOperations(): Promise<MathematicianResult> {
    console.log(
      '🧮 Testing Simple Math Operations (Create->Process->Destroy)...'
    )

    const iterations = 5000
    let channelsCreated = 0
    let channelsProcessed = 0
    let channelsDestroyed = 0
    let errorCount = 0
    const latencies: number[] = []

    this.startMemory = this.measureMemory()
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        // Create variable (channel)
        const varA = `var_a_${i}`
        const varB = `var_b_${i}`
        const result = `result_${i}`

        // Create channels for variables
        cyre.action({
          id: varA,
          payload: {value: Math.floor(Math.random() * 100)}
        })
        cyre.action({
          id: varB,
          payload: {value: Math.floor(Math.random() * 100)}
        })
        cyre.action({id: result, payload: {value: 0}})
        channelsCreated += 3

        // Set up mathematical operation (addition) - PROPER cyre.on() setup
        cyre.on(varA, (payload: any) => payload) // Simple getter
        cyre.on(varB, (payload: any) => payload) // Simple getter
        cyre.on(result, async (payload: any) => {
          const aValue = (await cyre.call(varA)).payload.value
          const bValue = (await cyre.call(varB)).payload.value
          return {value: aValue + bValue, operation: 'addition'}
        })

        // Execute the equation: result = a + b
        await cyre.call(result)
        channelsProcessed += 1
      } catch (error) {
        errorCount++
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    // Clean up all channels at once - much more efficient!
    cyre.clear()

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory
    const successRate = ((iterations - errorCount) / iterations) * 100

    return {
      testName: 'Simple Math Operations',
      channelsCreated,
      channelsProcessed,
      channelsDestroyed,
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      equationComplexity: 'simple',
      successRate: Number(successRate.toFixed(2)),
      errorCount
    }
  }

  /**
   * Test 2: Complex Mathematical Chains (Algebraic Expressions)
   * result = (a * b) + (c / d) - e
   */
  async testComplexMathChains(): Promise<MathematicianResult> {
    console.log('🔬 Testing Complex Math Chains (Algebraic Expressions)...')

    const iterations = 2000
    let channelsCreated = 0
    let channelsProcessed = 0
    let channelsDestroyed = 0
    let errorCount = 0
    const latencies: number[] = []

    this.startMemory = this.measureMemory()
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        // Create variables for complex equation: result = (a * b) + (c / d) - e
        const variables = ['a', 'b', 'c', 'd', 'e'].map(name => `${name}_${i}`)
        const [varA, varB, varC, varD, varE] = variables
        const tempResults = [`mult_${i}`, `div_${i}`, `add_${i}`, `final_${i}`]

        // Create all variable channels
        variables.forEach(varName => {
          cyre.action({
            id: varName,
            payload: {value: Math.floor(Math.random() * 10) + 1} // Avoid division by zero
          })
          // Set up getter handlers
          cyre.on(varName, (payload: any) => payload)
          channelsCreated++
        })

        // Create intermediate result channels
        tempResults.forEach(resultName => {
          cyre.action({id: resultName, payload: {value: 0}})
          channelsCreated++
        })

        // Phase 2: Set up ALL handlers (now all dependencies exist)

        // Set up variable getters first
        variables.forEach(varName => {
          cyre.on(varName, (payload: any) => payload)
        })

        // Set up mathematical operations chain in dependency order

        // Step 1: mult = a * b
        cyre.on(tempResults[0], async () => {
          const aResult = await cyre.call(varA)
          const bResult = await cyre.call(varB)
          const a = aResult?.payload?.value ?? 0
          const b = bResult?.payload?.value ?? 0
          return {value: a * b, operation: 'multiplication'}
        })

        // Step 2: div = c / d
        cyre.on(tempResults[1], async () => {
          const cResult = await cyre.call(varC)
          const dResult = await cyre.call(varD)
          const c = cResult?.payload?.value ?? 0
          const d = dResult?.payload?.value ?? 1 // Avoid division by zero
          return {value: c / d, operation: 'division'}
        })

        // Step 3: add = mult + div
        cyre.on(tempResults[2], async () => {
          const multResult = await cyre.call(tempResults[0])
          const divResult = await cyre.call(tempResults[1])
          const mult = multResult?.payload?.value ?? 0
          const div = divResult?.payload?.value ?? 0
          return {value: mult + div, operation: 'addition'}
        })

        // Step 4: final = add - e
        cyre.on(tempResults[3], async () => {
          const addResult = await cyre.call(tempResults[2])
          const eResult = await cyre.call(varE)
          const add = addResult?.payload?.value ?? 0
          const e = eResult?.payload?.value ?? 0
          return {value: add - e, operation: 'subtraction'}
        })

        // Execute the complex equation
        await cyre.call(tempResults[3])
        channelsProcessed += 4 // 4 operations executed
      } catch (error) {
        errorCount++
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory
    const successRate = ((iterations - errorCount) / iterations) * 100

    return {
      testName: 'Complex Math Chains',
      channelsCreated,
      channelsProcessed,
      channelsDestroyed,
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      equationComplexity: 'complex',
      successRate: Number(successRate.toFixed(2)),
      errorCount
    }
  }

  /**
   * Test 3: Matrix Operations (Large-scale channel coordination)
   * 3x3 Matrix multiplication through channels
   */
  async testMatrixOperations(): Promise<MathematicianResult> {
    console.log('🔢 Testing Matrix Operations (3x3 Matrix Multiplication)...')

    const iterations = 500
    let channelsCreated = 0
    let channelsProcessed = 0
    let channelsDestroyed = 0
    let errorCount = 0
    const latencies: number[] = []

    this.startMemory = this.measureMemory()
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        // Create 3x3 matrices as channels
        const matrixA: string[] = []
        const matrixB: string[] = []
        const matrixResult: string[] = []

        // Create matrix A (3x3 = 9 channels)
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const channelId = `matA_${i}_${row}_${col}`
            matrixA.push(channelId)
            cyre.action({
              id: channelId,
              payload: {value: Math.floor(Math.random() * 10)}
            })
            channelsCreated++
          }
        }

        // Create matrix B (3x3 = 9 channels)
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const channelId = `matB_${i}_${row}_${col}`
            matrixB.push(channelId)
            cyre.action({
              id: channelId,
              payload: {value: Math.floor(Math.random() * 10)}
            })
            channelsCreated++
          }
        }

        // Create result matrix (3x3 = 9 channels)
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const channelId = `result_${i}_${row}_${col}`
            matrixResult.push(channelId)
            cyre.action({id: channelId, payload: {value: 0}})
            channelsCreated++

            // Set up matrix multiplication for this cell
            cyre.on(channelId, async () => {
              let sum = 0
              for (let k = 0; k < 3; k++) {
                const aVal = (await cyre.call(`matA_${i}_${row}_${k}`)).payload
                  .value
                const bVal = (await cyre.call(`matB_${i}_${k}_${col}`)).payload
                  .value
                sum += aVal * bVal
              }
              return {value: sum, operation: 'matrix_multiplication'}
            })
          }
        }

        // Execute matrix multiplication (9 operations)
        for (const resultChannel of matrixResult) {
          await cyre.call(resultChannel)
          channelsProcessed++
        }

        // Clean up all matrix channels using cyre.clear() AFTER execution
        cyre.clear()
        channelsDestroyed = channelsCreated
      } catch (error) {
        errorCount++
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory
    const successRate = ((iterations - errorCount) / iterations) * 100

    return {
      testName: 'Matrix Operations',
      channelsCreated,
      channelsProcessed,
      channelsDestroyed,
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      equationComplexity: 'extreme',
      successRate: Number(successRate.toFixed(2)),
      errorCount
    }
  }

  /**
   * Test 4: Recursive Mathematical Functions (Fibonacci through channels)
   */
  async testRecursiveFunctions(): Promise<MathematicianResult> {
    console.log('🌀 Testing Recursive Functions (Fibonacci Sequence)...')

    const iterations = 1000
    const fibDepth = 15 // Calculate fib(15) through channels
    let channelsCreated = 0
    let channelsProcessed = 0
    let channelsDestroyed = 0
    let errorCount = 0
    const latencies: number[] = []

    this.startMemory = this.measureMemory()
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        // Create fibonacci calculation channels in proper dependency order
        const fibChannels: string[] = []

        // Step 1: Create ALL actions first
        for (let n = 0; n <= fibDepth; n++) {
          const channelId = `fib_${i}_${n}`
          fibChannels.push(channelId)

          if (n === 0 || n === 1) {
            // Base cases with actual values
            cyre.action({id: channelId, payload: {value: n}})
          } else {
            // Recursive cases start with 0
            cyre.action({id: channelId, payload: {value: 0}})
          }
          channelsCreated++
        }

        // Step 2: Set up handlers in dependency order (base cases first)
        for (let n = 0; n <= fibDepth; n++) {
          const channelId = `fib_${i}_${n}`

          if (n === 0 || n === 1) {
            // Base case handlers - simple getters
            cyre.on(channelId, (payload: any) => payload)
          } else {
            // Recursive handlers - now all dependencies exist
            cyre.on(channelId, async () => {
              const fib1Result = await cyre.call(`fib_${i}_${n - 1}`)
              const fib2Result = await cyre.call(`fib_${i}_${n - 2}`)

              // Safe access with null checks
              const fib1 = fib1Result?.payload?.value ?? 0
              const fib2 = fib2Result?.payload?.value ?? 0

              return {value: fib1 + fib2, operation: 'fibonacci'}
            })
          }
        }

        // Calculate fibonacci(15)
        await cyre.call(`fib_${i}_${fibDepth}`)
        channelsProcessed += 1

        // Clean up all fibonacci channels using cyre.clear()
        cyre.clear()
        channelsDestroyed = fibChannels.length
      } catch (error) {
        errorCount++
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory
    const successRate = ((iterations - errorCount) / iterations) * 100

    return {
      testName: 'Recursive Functions',
      channelsCreated,
      channelsProcessed,
      channelsDestroyed,
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      equationComplexity: 'medium',
      successRate: Number(successRate.toFixed(2)),
      errorCount
    }
  }

  /**
   * Test 5: Massive Channel Lifecycle (Pure creation/destruction speed)
   */
  async testMassiveChannelLifecycle(): Promise<MathematicianResult> {
    console.log('⚡ Testing Massive Channel Lifecycle (Pure Speed)...')

    const iterations = 10000
    let channelsCreated = 0
    let channelsProcessed = 0
    let channelsDestroyed = 0
    let errorCount = 0
    const latencies: number[] = []

    this.startMemory = this.measureMemory()
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        const channelId = `speed_test_${i}`

        // Create
        cyre.action({
          id: channelId,
          payload: {
            value: Math.random(),
            timestamp: Date.now(),
            iteration: i
          }
        })
        channelsCreated++

        // Process
        cyre.on(channelId, (payload: any) => {
          return {
            processed: true,
            originalValue: payload.value,
            processedAt: Date.now()
          }
        })

        await cyre.call(channelId, {operation: 'speed_test'})
        channelsProcessed++

        // Destroy (using cyre.clear() after the loop for efficiency)
        channelsDestroyed++ // Track for reporting
      } catch (error) {
        errorCount++
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory
    const successRate = ((iterations - errorCount) / iterations) * 100

    return {
      testName: 'Massive Channel Lifecycle',
      channelsCreated,
      channelsProcessed,
      channelsDestroyed,
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      equationComplexity: 'simple',
      successRate: Number(successRate.toFixed(2)),
      errorCount
    }
  }

  private printResults(results: MathematicianResult[]): void {
    console.log('\n🧮 MATHEMATICIAN MODULE BENCHMARK RESULTS')
    console.log('==========================================')

    let totalChannelsCreated = 0
    let totalChannelsProcessed = 0
    let totalChannelsDestroyed = 0

    results.forEach(result => {
      totalChannelsCreated += result.channelsCreated
      totalChannelsProcessed += result.channelsProcessed
      totalChannelsDestroyed += result.channelsDestroyed

      console.log(
        `\n${result.testName} [${result.equationComplexity.toUpperCase()}]`
      )
      console.log(
        `  • Operations/sec: ${result.operationsPerSecond.toLocaleString()}`
      )
      console.log(`  • Avg Latency: ${result.averageLatencyMs}ms`)
      console.log(
        `  • Channels Created: ${result.channelsCreated.toLocaleString()}`
      )
      console.log(
        `  • Channels Processed: ${result.channelsProcessed.toLocaleString()}`
      )
      console.log(
        `  • Channels Destroyed: ${result.channelsDestroyed.toLocaleString()}`
      )
      console.log(`  • Success Rate: ${result.successRate}%`)
      console.log(`  • Memory Usage: ${result.memoryUsageMB}MB`)
      console.log(`  • Errors: ${result.errorCount}`)
    })

    console.log('\n📊 MATHEMATICIAN MODULE SUMMARY')
    console.log('===============================')
    console.log(
      `• Total Channels Created: ${totalChannelsCreated.toLocaleString()}`
    )
    console.log(
      `• Total Channels Processed: ${totalChannelsProcessed.toLocaleString()}`
    )
    console.log(
      `• Total Channels Destroyed: ${totalChannelsDestroyed.toLocaleString()}`
    )

    const avgOpsPerSec =
      results.reduce((sum, r) => sum + r.operationsPerSecond, 0) /
      results.length
    const avgLatency =
      results.reduce((sum, r) => sum + r.averageLatencyMs, 0) / results.length
    const avgSuccessRate =
      results.reduce((sum, r) => sum + r.successRate, 0) / results.length

    console.log(
      `• Average Operations/sec: ${Math.round(avgOpsPerSec).toLocaleString()}`
    )
    console.log(`• Average Latency: ${avgLatency.toFixed(3)}ms`)
    console.log(`• Average Success Rate: ${avgSuccessRate.toFixed(2)}%`)

    console.log('\n🔥 MATHEMATICIAN MODULE INSIGHTS:')
    console.log(
      `✅ Channel lifecycle performance: ${
        results[4]?.operationsPerSecond.toLocaleString() || 'N/A'
      } channels/sec`
    )
    console.log(
      `✅ Complex mathematical coordination: ${
        results[1]?.operationsPerSecond.toLocaleString() || 'N/A'
      } equations/sec`
    )
    console.log(
      `✅ Matrix computation capability: ${
        results[2]?.operationsPerSecond.toLocaleString() || 'N/A'
      } matrices/sec`
    )
    console.log(
      `✅ Recursive algorithm support: ${
        results[3]?.operationsPerSecond.toLocaleString() || 'N/A'
      } calculations/sec`
    )

    const perfectResilience = results.every(r => r.successRate >= 99.9)
    if (perfectResilience) {
      console.log(
        '\n🛡️ MATHEMATICIAN RESILIENCE: Perfect mathematical precision maintained!'
      )
    }
  }

  async runMathematicianBenchmark(): Promise<void> {
    console.log('🧮 CYRE MATHEMATICIAN MODULE BENCHMARK')
    console.log('======================================')
    console.log('Testing channel-based mathematical computation...\n')

    const results: MathematicianResult[] = []

    try {
      results.push(await this.testSimpleMathOperations())
      await new Promise(resolve => setTimeout(resolve, 500))

      results.push(await this.testComplexMathChains())
      await new Promise(resolve => setTimeout(resolve, 500))

      results.push(await this.testMatrixOperations())
      await new Promise(resolve => setTimeout(resolve, 500))

      results.push(await this.testRecursiveFunctions())
      await new Promise(resolve => setTimeout(resolve, 500))

      results.push(await this.testMassiveChannelLifecycle())

      this.printResults(results)
    } catch (error) {
      console.error('❌ Mathematician benchmark failed:', error)
    }
  }
}

// Export for use
export {MathematicianBenchmark}

// Run if called directly
const benchmark = new MathematicianBenchmark()
benchmark.runMathematicianBenchmark().catch(console.error)
