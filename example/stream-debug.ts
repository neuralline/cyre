// examples/test-stream-fixed.ts
// Test streams after the Cyre payload fix

import {cyre} from '../src'

console.log('🧪 Testing Streams After Cyre Fix')
cyre.init()

/**
 * Test 1: Manual Interval (should start with 0 now)
 */
async function testFixedInterval() {
  console.log('\n📋 Test 1: Fixed Interval (should start with 0)')

  return new Promise<void>(resolve => {
    const streamId = 'fixed-interval'
    const values: number[] = []
    let counter = 0
    let intervalId: NodeJS.Timeout | null = null
    let emissionCount = 0
    const maxEmissions = 5

    cyre.action({id: streamId, type: 'stream'})
    cyre.on(streamId, (value: number) => {
      console.log(`  📨 Received: ${value} (${typeof value})`)
      values.push(value)
      return {handled: true}
    })

    const emit = async () => {
      if (emissionCount >= maxEmissions) {
        if (intervalId) clearInterval(intervalId)
        console.log(`  ✅ Final values: [${values.join(', ')}]`)
        console.log(`  ✅ Starts with 0? ${values[0] === 0 ? 'YES' : 'NO'}`)
        resolve()
        return
      }

      console.log(`  📤 Emitting: ${counter}`)
      await cyre.call(streamId, counter)
      counter++
      emissionCount++
    }

    // Start immediately
    emit().then(() => {
      if (emissionCount < maxEmissions) {
        intervalId = setInterval(emit, 100)
      }
    })

    setTimeout(() => {
      if (intervalId) clearInterval(intervalId)
      resolve()
    }, 1000)
  })
}

/**
 * Test 2: Manual Timer (undefined issue)
 */
async function testFixedTimer() {
  console.log('\n📋 Test 2: Fixed Timer (undefined test)')

  return new Promise<void>(resolve => {
    const streamId = 'fixed-timer'

    cyre.action({id: streamId, type: 'stream'})
    cyre.on(streamId, value => {
      console.log(`  📨 Timer received: ${value} (${typeof value})`)
      console.log(`  ✅ Is undefined? ${value === undefined ? 'YES' : 'NO'}`)
      console.log(`  ✅ Is null? ${value === null ? 'YES' : 'NO'}`)
      resolve()
      return {handled: true}
    })

    setTimeout(async () => {
      console.log('  📤 Emitting undefined...')
      await cyre.call(streamId, undefined)
    }, 100)
  })
}

/**
 * Test 3: Stream Factory Functions (if they work now)
 */
async function testStreamFactories() {
  console.log('\n📋 Test 3: Stream Factory Functions')

  try {
    const {interval, timer, of} = require('../src/stream')

    // Test interval function
    console.log('  🔄 Testing interval factory...')
    const intervalValues: number[] = []

    const intervalStream = interval(100)
    const subscription = intervalStream.take(3).subscribe({
      next: (value: number) => {
        console.log(`  📨 Interval factory: ${value} (${typeof value})`)
        intervalValues.push(value)
      },
      complete: () => {
        console.log(`  ✅ Interval values: [${intervalValues.join(', ')}]`)
        console.log(
          `  ✅ Starts with 0? ${intervalValues[0] === 0 ? 'YES' : 'NO'}`
        )
      }
    })

    // Wait for interval emissions
    await new Promise(resolve => setTimeout(resolve, 500))
    subscription.unsubscribe()

    // Test timer function
    console.log('  ⏱️  Testing timer factory...')

    const timerStream = timer(200)
    timerStream.subscribe({
      next: value => {
        console.log(`  📨 Timer factory: ${value} (${typeof value})`)
        console.log(`  ✅ Is undefined? ${value === undefined ? 'YES' : 'NO'}`)
      },
      complete: () => {
        console.log('  ✅ Timer completed')
      }
    })

    await new Promise(resolve => setTimeout(resolve, 300))

    // Test of function
    console.log('  📦 Testing of factory...')

    const ofValues: number[] = []
    const ofStream = of(1, 2, 3)

    ofStream.subscribe({
      next: (value: number) => {
        console.log(`  📨 Of factory: ${value} (${typeof value})`)
        ofValues.push(value)
      },
      complete: () => {
        console.log(`  ✅ Of values: [${ofValues.join(', ')}]`)
      }
    })

    await new Promise(resolve => setTimeout(resolve, 100))
  } catch (error) {
    console.log('  ❌ Stream factory error:', error.message)
  }
}

/**
 * Test 4: Full Stream Example
 */
async function testFullStreamExample() {
  console.log('\n📋 Test 4: Full Stream Example')

  try {
    const {interval} = require('../src/stream')

    const results: any[] = []

    // Create interval stream with processing
    const stream = interval(50)
      .take(5)
      .map((x: number) => {
        console.log(`  🔄 Processing: ${x}`)
        if (x === 3) {
          console.log(`  ⚠️  Throwing error for: ${x}`)
          throw new Error('Test error')
        }
        return x * 2
      })
      .catchError(() => {
        console.log(`  🔧 Caught error, returning -1`)
        return -1
      })

    stream.subscribe({
      next: (value: any) => {
        console.log(`  📨 Final result: ${value}`)
        results.push(value)
      },
      complete: () => {
        console.log(`  ✅ Stream completed`)
        console.log(`  ✅ Final results: [${results.join(', ')}]`)
        console.log(`  ✅ Expected: [0, 2, 4, -1, 8] or similar`)
      }
    })

    await new Promise(resolve => setTimeout(resolve, 500))
  } catch (error) {
    console.log('  ❌ Full example error:', error.message)
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testFixedInterval()
    await testFixedTimer()
    await testStreamFactories()
    await testFullStreamExample()

    console.log('\n🎉 All stream tests completed!')
  } catch (error) {
    console.error('\n💥 Stream test failed:', error)
  } finally {
    cyre.clear()
    console.log('✅ Tests complete!')
    process.exit(0)
  }
}

runTests().catch(console.error)
