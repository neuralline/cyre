// demo/buffer-payload.ts
// Simplified buffer state benchmark

import {bufferState} from '../src/context/buffer-state'
import {payloadState} from '../src/context/payload-state'

/**
 * Test the simplified buffer state performance
 */
export const benchmarkSimplifiedBuffer = () => {
  console.log('⚡ Simplified Buffer State Benchmark\n')

  const operations = 1000000
  const channelCount = 1000

  // Test 1: Ultra-fast set operations
  console.log('📊 Set Performance:')

  // Raw Map (control)
  const rawMap = new Map<string, any>()
  console.time('Raw Map Set')
  for (let i = 0; i < operations; i++) {
    rawMap.set(`channel-${i % channelCount}`, {id: i, value: `test-${i}`})
  }
  console.timeEnd('Raw Map Set')

  // Simplified buffer state
  console.time('Buffer Set')
  for (let i = 0; i < operations; i++) {
    bufferState.set(`channel-${i % channelCount}`, {id: i, value: `test-${i}`})
  }
  console.timeEnd('Buffer Set')

  // Payload state (comparison)
  console.time('Payload Set')
  for (let i = 0; i < operations; i++) {
    payloadState.setReq(`channel-${i % channelCount}`, {
      id: i,
      value: `test-${i}`
    })
  }
  console.timeEnd('Payload Set')

  console.log('\n📊 Get Performance:')

  // Raw Map get
  console.time('Raw Map Get')
  for (let i = 0; i < operations; i++) {
    rawMap.get(`channel-${i % channelCount}`)
  }
  console.timeEnd('Raw Map Get')

  // Buffer get
  console.time('Buffer Get')
  for (let i = 0; i < operations; i++) {
    bufferState.get(`channel-${i % channelCount}`)
  }
  console.timeEnd('Buffer Get')

  // Payload get
  console.time('Payload Get')
  for (let i = 0; i < operations; i++) {
    payloadState.getReq(`channel-${i % channelCount}`)
  }
  console.timeEnd('Payload Get')

  console.log('\n📊 Append Performance:')

  // Test append operations
  console.time('Buffer Append')
  for (let i = 0; i < 10000; i++) {
    bufferState.append(`append-${i % 100}`, {id: i, value: `test-${i}`})
  }
  console.timeEnd('Buffer Append')

  // Test specialized operations
  console.log('\n📊 Specialized Operations:')

  console.time('Buffer Forget')
  for (let i = 0; i < 10000; i++) {
    bufferState.forget(`channel-${i}`)
  }
  console.timeEnd('Buffer Forget')

  console.time('Buffer Has')
  for (let i = 0; i < 100000; i++) {
    bufferState.has(`channel-${i % channelCount}`)
  }
  console.timeEnd('Buffer Has')

  // Cleanup
  bufferState.clear()
  payloadState.clear()
  rawMap.clear()

  console.log('\n🎯 Expected Results:')
  console.log('✅ Buffer Set should be ~80-90% of Raw Map performance')
  console.log('✅ Buffer Get should be ~80-90% of Raw Map performance')
  console.log(
    '✅ Buffer should be significantly faster than Payload for simple operations'
  )
  console.log('✅ Append should be reasonably fast for batching use cases')
}

/**
 * Test real-world usage patterns
 */
export const benchmarkRealWorldUsage = () => {
  console.log('\n🌍 Real-World Usage Patterns\n')

  // Pattern 1: Debounce simulation
  console.log('📊 Debounce Pattern:')
  console.time('Debounce Simulation')
  for (let i = 0; i < 100000; i++) {
    const channelId = `debounce-${i % 50}`
    bufferState.set(channelId, {timestamp: Date.now(), value: i})
    // Simulate rapid calls overwriting previous
  }
  console.timeEnd('Debounce Simulation')

  // Pattern 2: Buffer and flush
  console.log('📊 Buffer & Flush Pattern:')
  console.time('Buffer & Flush')
  for (let i = 0; i < 50000; i++) {
    const channelId = `buffer-${i % 10}`
    bufferState.append(channelId, {batch: i, data: `item-${i}`})

    // Simulate periodic flush
    if (i % 1000 === 0) {
      for (let j = 0; j < 10; j++) {
        const data = bufferState.get(`buffer-${j}`)
        bufferState.forget(`buffer-${j}`)
      }
    }
  }
  console.timeEnd('Buffer & Flush')

  // Pattern 3: Throttle simulation
  console.log('📊 Throttle Pattern:')
  console.time('Throttle Simulation')
  for (let i = 0; i < 100000; i++) {
    const channelId = `throttle-${i % 20}`

    // Check if exists (throttle check)
    if (!bufferState.has(channelId)) {
      bufferState.set(channelId, {timestamp: Date.now(), value: i})
    }

    // Simulate periodic cleanup
    if (i % 5000 === 0) {
      for (let j = 0; j < 20; j++) {
        bufferState.forget(`throttle-${j}`)
      }
    }
  }
  console.timeEnd('Throttle Simulation')

  // Cleanup
  bufferState.clear()

  console.log('\n🎯 Real-world patterns should show:')
  console.log('✅ Debounce: Ultra-fast overwrite operations')
  console.log('✅ Buffer & Flush: Efficient append and batch retrieval')
  console.log('✅ Throttle: Fast existence checks and cleanup')
}

/**
 * Memory efficiency test
 */
export const testMemoryEfficiency = () => {
  console.log('\n💾 Memory Efficiency Test\n')

  const testSize = 50000

  // Force garbage collection
  if (global.gc) {
    global.gc()
  }

  // Test buffer state memory
  const bufferMemBefore = process.memoryUsage().heapUsed
  for (let i = 0; i < testSize; i++) {
    bufferState.set(`test-${i}`, {
      id: i,
      data: `test-data-${i}`,
      timestamp: Date.now()
    })
  }
  const bufferMemAfter = process.memoryUsage().heapUsed
  const bufferMemUsage = bufferMemAfter - bufferMemBefore

  console.log(
    `🟢 Buffer Memory: ${(bufferMemUsage / 1024 / 1024).toFixed(2)} MB`
  )
  console.log(`🟢 Per Entry: ${(bufferMemUsage / testSize).toFixed(2)} bytes`)

  // Test raw Map memory for comparison
  if (global.gc) {
    global.gc()
  }

  const rawMapMemBefore = process.memoryUsage().heapUsed
  const rawMap = new Map()
  for (let i = 0; i < testSize; i++) {
    rawMap.set(`test-${i}`, {
      id: i,
      data: `test-data-${i}`,
      timestamp: Date.now()
    })
  }
  const rawMapMemAfter = process.memoryUsage().heapUsed
  const rawMapMemUsage = rawMapMemAfter - rawMapMemBefore

  console.log(
    `🔶 Raw Map Memory: ${(rawMapMemUsage / 1024 / 1024).toFixed(2)} MB`
  )
  console.log(`🔶 Per Entry: ${(rawMapMemUsage / testSize).toFixed(2)} bytes`)

  console.log(
    `\n💾 Memory Overhead: ${((bufferMemUsage / rawMapMemUsage) * 100).toFixed(
      1
    )}%`
  )
  console.log(`🎯 Should be close to 100% (minimal overhead)`)

  // Test timestamps usage
  console.log('\n⏰ Timestamp Usage:')
  const sampleEntries = ['test-0', 'test-1000', 'test-2000']

  // Cleanup
  bufferState.clear()
  rawMap.clear()
}

export const runFullSimplifiedBenchmark = () => {
  benchmarkSimplifiedBuffer()
  benchmarkRealWorldUsage()
  testMemoryEfficiency()
}

export default {
  benchmarkSimplifiedBuffer,
  benchmarkRealWorldUsage,
  testMemoryEfficiency,
  runFullSimplifiedBenchmark
}
runFullSimplifiedBenchmark()
