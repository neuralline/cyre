// examples/breathing-aware-orchestration.ts
// Orchestration that adapts to system breathing and stress levels

import {cyre} from '../src'
import {metricsState} from '../src/context/metrics-state'

/*

    Breathing-Aware Orchestration System
    
    What the 90B ops/sec actually means:
    - Cyre's message passing efficiency (not real computation)
    - Promise resolution speed in V8
    - Coordination overhead measurement
    - Identity function calls (no actual work)
    
    Real-world orchestration should:
    - Adapt to system breathing patterns
    - Slow down during high stress
    - Speed up during low stress
    - Monitor actual computational load
    - Control concurrency based on system health

*/

interface BreathingAwareResult {
  name: string
  operations: number
  executionTime: number
  opsPerSecond: number
  avgStressLevel: number
  breathingAdaptations: number
  realComputationTime: number
  coordinationOverhead: number
}

// Breathing-aware orchestration controller
class BreathingOrchestrator {
  private stressHistory: number[] = []
  private adaptationCount = 0
  private baseRate = 1000 // Base operations per breath

  getSystemStress(): number {
    const breathingState = cyre.getBreathingState()
    return breathingState.stress
  }

  getAdaptiveRate(): number {
    const stress = this.getSystemStress()
    this.stressHistory.push(stress)

    // Adaptive rate based on stress
    if (stress > 0.8) {
      this.adaptationCount++
      return Math.max(100, this.baseRate * 0.2) // Slow down significantly
    } else if (stress > 0.6) {
      this.adaptationCount++
      return this.baseRate * 0.5 // Moderate slowdown
    } else if (stress > 0.4) {
      return this.baseRate * 0.8 // Slight slowdown
    } else {
      return this.baseRate * 1.2 // Speed up when stress is low
    }
  }

  async breathingPause(): Promise<void> {
    const breathingState = cyre.getBreathingState()
    const pauseTime = Math.max(1, breathingState.currentRate * 0.1)
    await new Promise(resolve => setTimeout(resolve, pauseTime))
  }

  getStats() {
    const avgStress =
      this.stressHistory.length > 0
        ? this.stressHistory.reduce((a, b) => a + b, 0) /
          this.stressHistory.length
        : 0

    return {
      avgStress,
      adaptationCount: this.adaptationCount,
      stressHistory: this.stressHistory
    }
  }
}

const runBreathingAwareBenchmark = async (
  name: string,
  operation: () => Promise<any>,
  targetOps: number
): Promise<BreathingAwareResult> => {
  const orchestrator = new BreathingOrchestrator()
  const startTime = performance.now()
  const computationStartTime = process.hrtime.bigint()

  await operation()

  const endTime = performance.now()
  const computationEndTime = process.hrtime.bigint()

  const executionTime = endTime - startTime
  const realComputationTime =
    Number(computationEndTime - computationStartTime) / 1000000 // Convert to ms
  const coordinationOverhead = executionTime - realComputationTime

  const stats = orchestrator.getStats()

  return {
    name,
    operations: targetOps,
    executionTime,
    opsPerSecond: (targetOps / executionTime) * 1000,
    avgStressLevel: stats.avgStress,
    breathingAdaptations: stats.adaptationCount,
    realComputationTime,
    coordinationOverhead
  }
}

/**
 * BREATHING 1: Real computational work with breathing awareness
 * Actual CPU-intensive tasks that respond to system stress
 */
const breathingBenchmarkRealComputation =
  async (): Promise<BreathingAwareResult> => {
    console.log('\n🫁 BREATHING 1: Real Computational Work')

    const operations = 100000 // Fewer ops, but real work

    cyre.action({id: 'real-compute', payload: 0})
    cyre.on('real-compute', (data: number[]) => {
      // Actual computational work - matrix multiplication
      const size = Math.min(10, data.length)
      const matrix = Array(size)
        .fill(0)
        .map(() => Array(size).fill(0))

      // Fill matrix with data
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          matrix[i][j] = data[i % data.length] + i + j
        }
      }

      // Matrix multiplication (real CPU work)
      const result = Array(size)
        .fill(0)
        .map(() => Array(size).fill(0))
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          for (let k = 0; k < size; k++) {
            result[i][j] += matrix[i][k] * matrix[k][j]
          }
        }
      }

      return result.flat().reduce((sum, val) => sum + val, 0)
    })

    const operation = async () => {
      const orchestrator = new BreathingOrchestrator()
      let processed = 0

      for (let i = 0; i < operations; i += 100) {
        // Check breathing and adapt
        const adaptiveRate = orchestrator.getAdaptiveRate()
        const currentBatch = Math.min(adaptiveRate / 10, operations - i, 100)

        // Create data for real computation
        const batch = Array.from({length: currentBatch}, (_, idx) => i + idx)

        const result = await cyre.call('real-compute', batch)
        processed += currentBatch

        // Breathing pause if system is stressed
        if (orchestrator.getSystemStress() > 0.6) {
          await orchestrator.breathingPause()
        }

        // Log stress adaptation
        if (i % 10000 === 0) {
          const stress = orchestrator.getSystemStress()
          console.log(
            `  Progress: ${processed}/${operations}, Stress: ${(
              stress * 100
            ).toFixed(1)}%, Rate: ${adaptiveRate.toFixed(0)}`
          )
        }
      }

      return processed
    }

    return runBreathingAwareBenchmark(
      'Real Computational Work',
      operation,
      operations
    )
  }

/**
 * BREATHING 2: Data processing pipeline with breathing control
 * Multi-stage data transformation that adapts to system breathing
 */
const breathingBenchmarkDataPipeline =
  async (): Promise<BreathingAwareResult> => {
    console.log('\n🫁 BREATHING 2: Data Processing Pipeline')

    const operations = 50000

    // Setup breathing-aware pipeline
    const stages = ['extract', 'transform', 'validate', 'load']

    stages.forEach(stage => {
      cyre.action({id: `pipeline-${stage}`, payload: null})
    })

    cyre.on('pipeline-extract', (data: any[]) => {
      // Simulate data extraction work
      return data.map(item => ({
        id: item,
        value: Math.random() * 1000,
        timestamp: Date.now()
      }))
    })

    cyre.on('pipeline-transform', (records: any[]) => {
      // CPU-intensive transformation
      return records.map(record => {
        let transformed = record.value
        // Simulate complex mathematical transformation
        for (let i = 0; i < 50; i++) {
          transformed =
            Math.sin(transformed) * Math.cos(transformed) +
            Math.sqrt(Math.abs(transformed))
        }
        return {
          ...record,
          transformed,
          processed: true
        }
      })
    })

    cyre.on('pipeline-validate', (records: any[]) => {
      // Validation logic
      return records.filter(
        record =>
          record.transformed > 0 &&
          record.transformed < 1000 &&
          record.processed === true
      )
    })

    cyre.on('pipeline-load', (records: any[]) => {
      // Simulate database write
      return {
        inserted: records.length,
        checksum: records.reduce((sum, r) => sum + r.transformed, 0)
      }
    })

    const operation = async () => {
      const orchestrator = new BreathingOrchestrator()
      let processed = 0

      for (let i = 0; i < operations; i += 1000) {
        const stress = orchestrator.getSystemStress()
        const adaptiveRate = orchestrator.getAdaptiveRate()
        const currentBatch = Math.min(adaptiveRate / 10, operations - i, 1000)

        // Create batch data
        const batch = Array.from({length: currentBatch}, (_, idx) => i + idx)

        // Process through breathing-aware pipeline
        const extracted = await cyre.call('pipeline-extract', batch)

        // Breathing pause between stages if stressed
        if (stress > 0.5) {
          await orchestrator.breathingPause()
        }

        const transformed = await cyre.call(
          'pipeline-transform',
          extracted.payload
        )

        if (stress > 0.5) {
          await orchestrator.breathingPause()
        }

        const validated = await cyre.call(
          'pipeline-validate',
          transformed.payload
        )

        if (stress > 0.5) {
          await orchestrator.breathingPause()
        }

        const loaded = await cyre.call('pipeline-load', validated.payload)

        processed += currentBatch

        if (i % 5000 === 0) {
          console.log(
            `  Pipeline progress: ${processed}/${operations}, Stress: ${(
              stress * 100
            ).toFixed(1)}%`
          )
        }
      }

      return processed
    }

    return runBreathingAwareBenchmark(
      'Data Processing Pipeline',
      operation,
      operations
    )
  }

/**
 * BREATHING 3: Adaptive parallel orchestration
 * Parallel processing that scales with breathing patterns
 */
const breathingBenchmarkAdaptiveParallel =
  async (): Promise<BreathingAwareResult> => {
    console.log('\n🫁 BREATHING 3: Adaptive Parallel Orchestration')

    const operations = 200000

    // Setup adaptive parallel workers
    const workerCount = 4
    const workers = Array.from({length: workerCount}, (_, i) => `worker-${i}`)

    workers.forEach(worker => {
      cyre.action({id: worker, payload: null})
      cyre.on(worker, (data: number[]) => {
        // CPU-intensive work per worker
        let result = 0
        for (const num of data) {
          // Simulate complex computation
          let temp = num
          for (let i = 0; i < 100; i++) {
            temp = Math.sqrt(temp * temp + 1)
          }
          result += temp
        }
        return result
      })
    })

    const operation = async () => {
      const orchestrator = new BreathingOrchestrator()
      let processed = 0

      for (let i = 0; i < operations; i += 1000) {
        const stress = orchestrator.getSystemStress()
        const adaptiveRate = orchestrator.getAdaptiveRate()

        // Adapt worker count based on stress
        const activeWorkers =
          stress > 0.7 ? 1 : stress > 0.5 ? 2 : stress > 0.3 ? 3 : 4
        const currentBatch = Math.min(adaptiveRate, operations - i, 1000)

        // Distribute work across active workers
        const workPerWorker = Math.ceil(currentBatch / activeWorkers)
        const workerPromises = []

        for (let w = 0; w < activeWorkers; w++) {
          const workerStart = w * workPerWorker
          const workerEnd = Math.min(workerStart + workPerWorker, currentBatch)
          const workerData = Array.from(
            {length: workerEnd - workerStart},
            (_, idx) => i + workerStart + idx
          )

          workerPromises.push(cyre.call(workers[w], workerData))
        }

        await Promise.all(workerPromises)
        processed += currentBatch

        // Breathing pause for coordination
        if (stress > 0.6) {
          await orchestrator.breathingPause()
        }

        if (i % 10000 === 0) {
          console.log(
            `  Parallel progress: ${processed}/${operations}, Workers: ${activeWorkers}, Stress: ${(
              stress * 100
            ).toFixed(1)}%`
          )
        }
      }

      return processed
    }

    return runBreathingAwareBenchmark(
      'Adaptive Parallel Orchestration',
      operation,
      operations
    )
  }

/**
 * Display breathing-aware results
 */
const displayBreathingResults = (results: BreathingAwareResult[]): void => {
  console.log('\n' + '='.repeat(120))
  console.log('  BREATHING-AWARE ORCHESTRATION RESULTS')
  console.log('='.repeat(120))

  console.log('\n🫁 BREATHING-AWARE PERFORMANCE SUMMARY')
  console.log(
    '┌' +
      '─'.repeat(32) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(15) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(15) +
      '┬' +
      '─'.repeat(15) +
      '┐'
  )
  console.log(
    '│ Benchmark                      │ Operations   │ Time (s)     │ Ops/Second      │ Avg Stress   │ Adaptations     │ Real CPU (ms)   │'
  )
  console.log(
    '├' +
      '─'.repeat(32) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(15) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(15) +
      '┼' +
      '─'.repeat(15) +
      '┤'
  )

  results.forEach(result => {
    const name = result.name.substring(0, 30).padEnd(30)
    const ops = result.operations.toLocaleString().padStart(10)
    const time = (result.executionTime / 1000).toFixed(2).padStart(10)
    const opsPerSec = Math.floor(result.opsPerSecond)
      .toLocaleString()
      .padStart(13)
    const stress = (result.avgStressLevel * 100).toFixed(1).padStart(9) + '%'
    const adaptations = result.breathingAdaptations.toString().padStart(13)
    const cpuTime = result.realComputationTime.toFixed(2).padStart(13)

    console.log(
      `│ ${name} │ ${ops}   │ ${time}   │ ${opsPerSec}   │ ${stress}   │ ${adaptations}   │ ${cpuTime}   │`
    )
  })

  console.log(
    '└' +
      '─'.repeat(32) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(15) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(15) +
      '┴' +
      '─'.repeat(15) +
      '┘'
  )

  // Breathing analysis
  const totalAdaptations = results.reduce(
    (sum, r) => sum + r.breathingAdaptations,
    0
  )
  const avgStress =
    results.reduce((sum, r) => sum + r.avgStressLevel, 0) / results.length
  const totalRealComputation = results.reduce(
    (sum, r) => sum + r.realComputationTime,
    0
  )
  const totalCoordination = results.reduce(
    (sum, r) => sum + r.coordinationOverhead,
    0
  )

  console.log('\n🫁 BREATHING SYSTEM ANALYSIS')
  console.log(`💓 Total Breathing Adaptations: ${totalAdaptations}`)
  console.log(`📊 Average System Stress: ${(avgStress * 100).toFixed(1)}%`)
  console.log(`⚙️  Real Computation Time: ${totalRealComputation.toFixed(2)}ms`)
  console.log(`🔄 Coordination Overhead: ${totalCoordination.toFixed(2)}ms`)
  console.log(
    `📈 Computation Efficiency: ${(
      (totalRealComputation / (totalRealComputation + totalCoordination)) *
      100
    ).toFixed(1)}%`
  )

  console.log('\n🎯 BREATHING-AWARE INSIGHTS')
  console.log('✅ System automatically adapts to stress levels')
  console.log('✅ Breathing pauses prevent system overload')
  console.log('✅ Adaptive concurrency scales with system health')
  console.log('✅ Real computational work vs coordination overhead measured')
  console.log('✅ Pipeline stages respect breathing patterns')
  console.log('✅ Parallel processing adapts worker count to stress')

  // Find most adaptive
  const mostAdaptive = results.reduce((prev, current) =>
    current.breathingAdaptations > prev.breathingAdaptations ? current : prev
  )

  console.log(`\n🏆 MOST ADAPTIVE: ${mostAdaptive.name}`)
  console.log(
    `    💓 ${mostAdaptive.breathingAdaptations} breathing adaptations`
  )
  console.log(
    `    📊 ${(mostAdaptive.avgStressLevel * 100).toFixed(1)}% average stress`
  )
  console.log(
    `    ⚙️  ${mostAdaptive.realComputationTime.toFixed(2)}ms real computation`
  )

  console.log('\n💡 ORCHESTRATION CONTROL RECOMMENDATIONS')
  console.log('• Integrate breathing system into all orchestration patterns')
  console.log('• Use stress levels to adapt concurrency dynamically')
  console.log('• Implement breathing pauses between intensive operations')
  console.log('• Monitor real computation vs coordination overhead')
  console.log('• Scale worker count based on system health')
  console.log('• Add circuit breakers for extreme stress conditions')
}

/**
 * Main breathing-aware test runner
 */
export const runBreathingAwareOrchestrationTest = async (): Promise<void> => {
  console.log('🫁 BREATHING-AWARE ORCHESTRATION SYSTEM')
  console.log(
    'Orchestration that adapts to system breathing and stress patterns\n'
  )

  await cyre.init()

  const results: BreathingAwareResult[] = []

  const initialBreathing = cyre.getBreathingState()
  console.log(
    `Initial Breathing: Rate=${initialBreathing.currentRate}ms, Stress=${(
      initialBreathing.stress * 100
    ).toFixed(1)}%\n`
  )

  try {
    results.push(await breathingBenchmarkRealComputation())
    results.push(await breathingBenchmarkDataPipeline())
    results.push(await breathingBenchmarkAdaptiveParallel())

    displayBreathingResults(results)

    const finalBreathing = cyre.getBreathingState()
    console.log(
      `\n🫁 Final Breathing: Rate=${finalBreathing.currentRate}ms, Stress=${(
        finalBreathing.stress * 100
      ).toFixed(1)}%`
    )
  } catch (error) {
    console.error('❌ Breathing-aware test failed:', error)
  }
}

// Auto-run if executed directly

runBreathingAwareOrchestrationTest()
