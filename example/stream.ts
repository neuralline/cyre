// example/stream.ts
// Comprehensive examples for Cyre Stream system in Node.js environment

import {
  createStream,
  of,
  interval,
  timer,
  merge,
  operators
} from '../src/stream'
import {cyre} from '../src'

/*

      C.Y.R.E - S.T.R.E.A.M - E.X.A.M.P.L.E.S
      
      Comprehensive Node.js examples demonstrating:
      - Basic stream creation and subscription
      - Operator composition and chaining
      - Error handling and resource management
      - Integration with Cyre's protection mechanisms
      - Real-world use cases and patterns

*/

// Initialize Cyre system
cyre.init()

/**
 * Example 1: Basic Stream Creation and Subscription
 */
async function basicStreamExample(): Promise<void> {
  console.log('\n=== Basic Stream Example ===')

  // Create a simple stream
  const stream = createStream<number>({
    id: 'basic-stream',
    debug: true
  })

  // Subscribe to emissions
  const subscription = stream.subscribe({
    next: value => console.log(`Received: ${value}`),
    error: error => console.error(`Error: ${error.message}`),
    complete: () => console.log('Stream completed')
  })

  // Emit some values
  await stream.next(1)
  await stream.next(2)
  await stream.next(3)

  // Complete the stream
  stream.complete()

  // Cleanup
  subscription.unsubscribe()
}

/**
 * Example 2: Factory Functions
 */
async function factoryFunctionsExample(): Promise<void> {
  console.log('\n=== Factory Functions Example ===')

  // Create stream from static values
  const staticStream = of(1, 2, 3, 4, 5)

  staticStream.subscribe({
    next: value => console.log(`Static stream value: ${value}`),
    complete: () => console.log('Static stream completed')
  })

  // Wait a bit for async emissions
  await new Promise(resolve => setTimeout(resolve, 100))

  // Create interval stream (emits incrementing numbers)
  console.log('Starting interval stream...')
  const intervalStream = interval(500) // Every 500ms

  const intervalSub = intervalStream
    .take(5) // Only take 5 values
    .subscribe({
      next: value => console.log(`Interval value: ${value}`),
      complete: () => console.log('Interval stream completed')
    })

  // Let it run for a bit
  await new Promise(resolve => setTimeout(resolve, 3000))
  intervalSub.unsubscribe()

  // Timer stream (emits once after delay)
  console.log('Starting timer stream...')
  const timerStream = timer(1000) // After 1 second

  timerStream.subscribe({
    next: () => console.log('Timer fired!'),
    complete: () => console.log('Timer completed')
  })

  await new Promise(resolve => setTimeout(resolve, 1500))
}

/**
 * Example 3: Transformation Operators
 */
async function transformationOperatorsExample(): Promise<void> {
  console.log('\n=== Transformation Operators Example ===')

  const source = createStream<number>()

  // Chain multiple operators
  const transformed = source
    .map(x => x * 2) // Double each value
    .filter(x => x > 5) // Only values greater than 5
    .map(x => `Value: ${x}`) // Convert to string
    .take(3) // Take only first 3 that pass

  transformed.subscribe({
    next: value => console.log(`Transformed: ${value}`),
    complete: () => console.log('Transformation completed')
  })

  // Emit test values
  for (const value of [1, 2, 3, 4, 5, 6, 7, 8]) {
    await source.next(value)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

/**
 * Example 4: Timing Operators with Cyre Integration
 */
async function timingOperatorsExample(): Promise<void> {
  console.log('\n=== Timing Operators Example ===')

  const source = createStream<string>()

  // Debounce using Cyre's built-in protection
  const debounced = source.debounce(300)

  debounced.subscribe({
    next: value => console.log(`Debounced: ${value}`),
    complete: () => console.log('Debounced stream completed')
  })

  // Simulate rapid user input
  console.log('Simulating rapid input...')
  const inputs = ['a', 'ab', 'abc', 'abcd', 'abcde']

  for (const input of inputs) {
    await source.next(input)
    await new Promise(resolve => setTimeout(resolve, 100)) // Rapid input
  }

  // Wait for debounce to complete
  await new Promise(resolve => setTimeout(resolve, 500))
  source.complete()
}

/**
 * Example 5: Error Handling
 */
async function errorHandlingExample(): Promise<void> {
  console.log('\n=== Error Handling Example ===')

  const source = createStream<number>()

  // Stream that might error
  const processed = source
    .map(x => {
      if (x === 3) throw new Error('Number 3 is not allowed!')
      return x * 2
    })
    .catchError(error => {
      console.log(`Caught error: ${error.message}, using fallback value`)
      return -1
    })

  processed.subscribe({
    next: value => console.log(`Processed: ${value}`),
    error: error => console.error(`Unexpected error: ${error.message}`),
    complete: () => console.log('Error handling completed')
  })

  // Emit values including the problematic one
  for (const value of [1, 2, 3, 4, 5]) {
    await source.next(value)
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  source.complete()
}

/**
 * Example 6: Stream Combination
 */
async function streamCombinationExample(): Promise<void> {
  console.log('\n=== Stream Combination Example ===')

  // Create two source streams
  const stream1 = createStream<string>()
  const stream2 = createStream<number>()

  // Merge streams
  const merged = stream1.merge(stream2)

  merged.subscribe({
    next: value => console.log(`Merged: ${value}`),
    complete: () => console.log('Merged stream completed')
  })

  // Zip streams together
  const zipped = stream1.zip(stream2)

  zipped.subscribe({
    next: ([str, num]) => console.log(`Zipped: [${str}, ${num}]`),
    complete: () => console.log('Zipped stream completed')
  })

  // Emit to both streams
  await stream1.next('hello')
  await stream2.next(1)

  await stream1.next('world')
  await stream2.next(2)

  await stream1.next('!')
  await stream2.next(3)

  // Complete both streams
  stream1.complete()
  stream2.complete()

  await new Promise(resolve => setTimeout(resolve, 100))
}

/**
 * Example 7: Advanced Operators
 */
async function advancedOperatorsExample(): Promise<void> {
  console.log('\n=== Advanced Operators Example ===')

  const source = createStream<number>()

  // Using pipe for functional composition
  const processed = source.pipe(
    stream => stream.map(x => x * 2),
    stream => stream.filter(x => x % 4 === 0),
    stream => stream.distinctUntilChanged(),
    stream => stream.take(5)
  )

  processed.subscribe({
    next: value => console.log(`Piped result: ${value}`),
    complete: () => console.log('Advanced operators completed')
  })

  // Emit sequence
  const sequence = [1, 2, 2, 3, 4, 4, 5, 6, 7, 8, 8, 9, 10]
  for (const value of sequence) {
    await source.next(value)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  source.complete()
}

/**
 * Example 8: Real-world Use Case - Data Processing Pipeline
 */
async function dataProcessingPipelineExample(): Promise<void> {
  console.log('\n=== Data Processing Pipeline Example ===')

  // Simulate incoming data stream
  const dataStream = createStream<{
    id: number
    value: string
    timestamp: number
  }>()

  // Processing pipeline
  const processedData = dataStream
    .filter(data => data.value.length > 0) // Filter empty values
    .map(data => ({
      ...data,
      processed: true,
      normalizedValue: data.value.toLowerCase().trim()
    }))
    .debounce(200) // Debounce rapid updates
    .distinctUntilChanged() // Skip duplicates

  // Subscribe to processed data
  processedData.subscribe({
    next: data => {
      console.log(`Processed data:`, {
        id: data.id,
        original: data.value,
        normalized: data.normalizedValue,
        timestamp: new Date(data.timestamp).toISOString()
      })
    },
    error: error => console.error(`Processing error: ${error.message}`),
    complete: () => console.log('Data processing completed')
  })

  // Simulate incoming data
  const testData = [
    {id: 1, value: 'Hello World', timestamp: Date.now()},
    {id: 2, value: '  TEST  ', timestamp: Date.now() + 50},
    {id: 3, value: '', timestamp: Date.now() + 100}, // Will be filtered
    {id: 4, value: 'Final Item', timestamp: Date.now() + 150}
  ]

  for (const data of testData) {
    await dataStream.next(data)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Wait for debounce
  await new Promise(resolve => setTimeout(resolve, 300))
  dataStream.complete()
}

/**
 * Example 9: Memory Management and Cleanup
 */
async function memoryManagementExample(): Promise<void> {
  console.log('\n=== Memory Management Example ===')

  // Create stream with explicit cleanup
  const stream = createStream<number>({
    id: 'cleanup-demo',
    debug: true
  })

  // Track subscriptions for proper cleanup
  const subscriptions = []

  // Multiple subscribers
  subscriptions.push(
    stream.subscribe(value => console.log(`Subscriber 1: ${value}`))
  )

  subscriptions.push(
    stream.subscribe(value => console.log(`Subscriber 2: ${value * 2}`))
  )

  // Emit some values
  await stream.next(1)
  await stream.next(2)

  // Demonstrate proper cleanup
  console.log('Cleaning up subscriptions...')
  subscriptions.forEach(sub => sub.unsubscribe())

  // Stream should handle emissions to unsubscribed observers gracefully
  await stream.next(3) // This might not be logged

  stream.complete()
  console.log('Memory management example completed')
}

/**
 * Example 10: Integration with Cyre System
 */
async function cyreIntegrationExample(): Promise<void> {
  console.log('\n=== Cyre Integration Example ===')

  // Stream that integrates with Cyre's action system
  const stream = createStream<{action: string; payload: any}>({
    id: 'cyre-integration',
    debug: false
  })

  // Process stream data through Cyre actions
  stream
    .map(data => data.payload)
    .filter(payload => payload != null)
    .subscribe({
      next: async payload => {
        // Use Cyre's call system for further processing
        try {
          await cyre.call('process-stream-data', payload)
        } catch (error) {
          console.error('Failed to process through Cyre:', error)
        }
      }
    })

  // Set up Cyre action to handle stream data
  cyre.action({
    id: 'process-stream-data',
    throttle: 100, // Use Cyre's built-in throttling
    detectChanges: true
  })

  cyre.on('process-stream-data', payload => {
    console.log('Processed through Cyre:', payload)
    return {processed: true, timestamp: Date.now()}
  })

  // Send data through the stream
  await stream.next({action: 'update', payload: {value: 1}})
  await stream.next({action: 'update', payload: {value: 2}})
  await stream.next({action: 'update', payload: null}) // Will be filtered
  await stream.next({action: 'update', payload: {value: 3}})

  await new Promise(resolve => setTimeout(resolve, 200))
  stream.complete()
}

/**
 * Run all examples
 */
async function runAllExamples(): Promise<void> {
  console.log('Starting Cyre Stream Examples...\n')

  try {
    await basicStreamExample()
    await factoryFunctionsExample()
    await transformationOperatorsExample()
    await timingOperatorsExample()
    await errorHandlingExample()
    await streamCombinationExample()
    await advancedOperatorsExample()
    await dataProcessingPipelineExample()
    await memoryManagementExample()
    await cyreIntegrationExample()

    console.log('\n=== All Examples Completed Successfully ===')
  } catch (error) {
    console.error('Example failed:', error)
  } finally {
    // Cleanup Cyre system
    console.log('\nCleaning up Cyre system...')
    cyre.clear()
  }
}

// Export for use in other files
export {
  basicStreamExample,
  factoryFunctionsExample,
  transformationOperatorsExample,
  timingOperatorsExample,
  errorHandlingExample,
  streamCombinationExample,
  advancedOperatorsExample,
  dataProcessingPipelineExample,
  memoryManagementExample,
  cyreIntegrationExample,
  runAllExamples
}

// Run examples if this file is executed directly

runAllExamples().catch(console.error)
