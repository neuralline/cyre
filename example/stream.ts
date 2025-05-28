// Usage Examples for Cyre Stream System

import { cyre, Stream, operators } from 'cyre'

// Basic Stream Creation and Usage
const basicExample = () => {
  // Create a stream
  const numberStream = Stream.create<number>()

  // Subscribe to stream
  const subscription = numberStream.subscribe({
    next: value => console.log('Received:', value),
    error: error => console.error('Error:', error),
    complete: () => console.log('Stream completed')
  })

  // Emit values
  numberStream.next(1)
  numberStream.next(2)
  numberStream.next(3)
  numberStream.complete()

  // Clean up
  subscription.unsubscribe()
}

// Using Factory Functions
const factoryExample = () => {
  // Create from values
  const staticStream = Stream.of(1, 2, 3, 4, 5)
  
  // Create from array
  const arrayStream = Stream.from([10, 20, 30])
  
  // Create interval stream
  const intervalStream = Stream.interval(1000) // Emits 0, 1, 2... every second
  
  // Create timer stream
  const timerStream = Stream.timer(5000) // Emits once after 5 seconds
}

// Stream Transformation with Operators
const transformationExample = () => {
  const dataStream = Stream.create<number>()

  const processedStream = dataStream.pipe(
    operators.map(x => x * 2),           // Double the values
    operators.filter(x => x > 10),       // Keep only values > 10
    operators.take(5),                   // Take first 5 values
    operators.distinctUntilChanged(),    // Remove consecutive duplicates
    operators.debounce(300)              // Debounce rapid emissions
  )

  processedStream.subscribe(value => 
    console.log('Processed value:', value)
  )

  // Emit test data
  dataStream.next(3)  // 6, filtered out
  dataStream.next(8)  // 16, passes
  dataStream.next(12) // 24, passes
  dataStream.next(12) // 24, filtered by distinctUntilChanged
  dataStream.next(15) // 30, passes
}

// Using Cyre's Built-in Protections
const protectionExample = () => {
  const clickStream = Stream.create<MouseEvent>()

  // Use Cyre's built-in throttle and debounce
  const controlledStream = clickStream.pipe(
    operators.throttle(1000),  // Max 1 per second
    operators.debounce(300),   // Wait 300ms after last click
    operators.map(event => ({ x: event.clientX, y: event.clientY }))
  )

  controlledStream.subscribe(coords =>
    console.log('Click at:', coords)
  )
}

// Stream Combination
const combinationExample = () => {
  const stream1 = Stream.interval(1000).pipe(operators.map(x => `A${x}`))
  const stream2 = Stream.interval(1500).pipe(operators.map(x => `B${x}`))

  // Merge streams
  const merged = stream1.merge(stream2)
  merged.subscribe(value => console.log('Merged:', value))

  // Zip streams
  const zipped = stream1.zip(stream2, (a, b) => `${a}-${b}`)
  zipped.subscribe(value => console.log('Zipped:', value))

  // Combine latest
  const combined = Stream.combineLatest(stream1, stream2)
  combined.subscribe(([a, b]) => console.log('Combined:', a, b))
}

// Error Handling
const errorHandlingExample = () => {
  const riskyStream = Stream.create<number>()

  const safeStream = riskyStream.pipe(
    operators.map(x => {
      if (x < 0) throw new Error('Negative number!')
      return x * 2
    }),
    operators.catchError((error, value) => {
      console.warn('Caught error:', error.message, 'for value:', value)
      return 0 // Fallback value
    }),
    operators.retry(3) // Retry up to 3 times
  )

  safeStream.subscribe(value => console.log('Safe value:', value))

  riskyStream.next(5)   // OK: 10
  riskyStream.next(-1)  // Error caught, returns 0
  riskyStream.next(3)   // OK: 6
}

// Advanced Operators
const advancedExample = () => {
  const sourceStream = Stream.create<string>()

  const advancedStream = sourceStream.pipe(
    operators.bufferCount(3),           // Collect 3 items into arrays
    operators.map(batch => batch.join(',')), // Join arrays
    operators.scan((acc, current) => `${acc}|${current}`, ''), // Accumulate
    operators.sample(2000),             // Sample every 2 seconds
    operators.distinctUntilChanged(),   // Remove consecutive duplicates
    operators.share()                   // Share among multiple subscribers
  )

  // Multiple subscribers
  advancedStream.subscribe(value => console.log('Sub 1:', value))
  advancedStream.subscribe(value => console.log('Sub 2:', value))

  // Emit data
  sourceStream.next('A')
  sourceStream.next('B')
  sourceStream.next('C') // Will buffer and emit as "A,B,C"
}

// Integration with Cyre Actions
const cyreIntegrationExample = () => {
  // Set up Cyre action
  cyre.action({
    id: 'user-action',
    throttle: 500,
    debounce: 200
  })

  cyre.on('user-action', (data) => {
    console.log('Cyre action executed:', data)
    return { processed: true, timestamp: Date.now() }
  })

  // Create stream that triggers Cyre actions
  const userStream = Stream.create<any>()

  userStream.subscribe(async (data) => {
    // Call Cyre action from stream
    const result = await cyre.call('user-action', data)
    console.log('Cyre result:', result)
  })

  // Emit data
  userStream.next({ userId: 123, action: 'click' })
}

// Real-world Example: Search with Autocomplete
const searchExample = () => {
  const searchInput = document.querySelector('#search') as HTMLInputElement
  const searchStream = Stream.create<string>()

  // Set up search stream processing
  const searchResults = searchStream.pipe(
    operators.map(query => query.trim()),
    operators.filter(query => query.length > 2),
    operators.distinctUntilChanged(),
    operators.debounce(300), // Wait for user to stop typing
    operators.switchMap(query => 
      // Switch to new search, canceling previous
      Stream.create<string[]>().tap(async (stream) => {
        try {
          const response = await fetch(`/api/search?q=${query}`)
          const results = await response.json()
          stream.next(results)
          stream.complete()
        } catch (error) {
          stream.error(error instanceof Error ? error : new Error(String(error)))
        }
      })
    ),
    operators.catchError((error) => {
      console.error('Search failed:', error)
      return [] // Return empty results on error
    })
  )

  // Display results
  searchResults.subscribe(results => {
    const resultsDiv = document.querySelector('#search-results')
    if (resultsDiv) {
      resultsDiv.innerHTML = results.map(item => `<div>${item}</div>`).join('')
    }
  })

  // Connect input to stream
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      searchStream.next(target.value)
    })
  }
}

// Real-world Example: WebSocket Data Stream
const websocketExample = () => {
  const wsStream = Stream.create<any>()
  const ws = new WebSocket('wss://api.example.com/live-data')

  // Set up WebSocket integration
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      wsStream.next(data)
    } catch (error) {
      wsStream.error(new Error('Invalid JSON received'))
    }
  }

  ws.onerror = (error) => {
    wsStream.error(new Error('WebSocket error'))
  }

  ws.onclose = () => {
    wsStream.complete()
  }

  // Process WebSocket data
  const processedData = wsStream.pipe(
    operators.filter(data => data.type === 'price_update'),
    operators.map(data => ({
      symbol: data.symbol,
      price: parseFloat(data.price),
      timestamp: Date.now()
    })),
    operators.bufferTime(1000), // Batch updates every second
    operators.filter(batch => batch.length > 0),
    operators.map(batch => ({
      updates: batch,
      count: batch.length,
      avgPrice: batch.reduce((sum, item) => sum + item.price, 0) / batch.length
    }))
  )

  processedData.subscribe(batch => {
    console.log(`Processed ${batch.count} price updates, avg: ${batch.avgPrice}`)
    // Update UI, save to database, etc.
  })
}

// React Integration Example
const reactIntegrationExample = () => {
  // This would be inside a React component
  const useStreamState = <T>(stream: Stream<T>, initialValue: T) => {
    const [value, setValue] = React.useState<T>(initialValue)
    
    React.useEffect(() => {
      const subscription = stream.subscribe({
        next: setValue,
        error: (error) => console.error('Stream error:', error)
      })
      
      return () => subscription.unsubscribe()
    }, [stream])
    
    return value
  }

  // Usage in component
  const MyComponent = () => {
    const dataStream = React.useMemo(() => Stream.interval(1000), [])
    const currentValue = useStreamState(dataStream, 0)
    
    return <div>Current value: {currentValue}</div>
  }
}

// Performance Monitoring with Streams
const performanceExample = () => {
  const performanceStream = Stream.create<PerformanceEntry>()

  // Monitor performance entries
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach(entry => {
      performanceStream.next(entry)
    })
  })

  observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] })

  // Process performance data
  const performanceAnalysis = performanceStream.pipe(
    operators.filter(entry => entry.entryType === 'measure'),
    operators.bufferTime(5000), // Collect 5 seconds worth of data
    operators.map(entries => ({
      count: entries.length,
      avgDuration: entries.reduce((sum, entry) => sum + entry.duration, 0) / entries.length,
      maxDuration: Math.max(...entries.map(entry => entry.duration)),
      minDuration: Math.min(...entries.map(entry => entry.duration))
    })),
    operators.filter(stats => stats.count > 0)
  )

  performanceAnalysis.subscribe(stats => {
    console.log('Performance Stats:', stats)
    
    // Alert if performance degrades
    if (stats.avgDuration > 100) {
      console.warn('Performance degradation detected!')
    }
  })
}

// Custom Operator Example
const customOperatorExample = () => {
  // Create a custom operator
  const takeEveryNth = <T>(n: number): operators.StreamOperator<T, T> => (source) => {
    const result = Stream.create<T>()
    let count = 0

    const subscription = source.subscribe({
      next: (value) => {
        count++
        if (count % n === 0) {
          result.next(value)
        }
      },
      error: (error) => result.error(error),
      complete: () => result.complete()
    })

    // Clean up subscription when result stream completes
    const originalComplete = result.complete
    result.complete = () => {
      subscription.unsubscribe()
      originalComplete.call(result)
    }

    return result
  }

  // Use custom operator
  const numberStream = Stream.interval(100)
  const everyFifthNumber = numberStream.pipe(
    takeEveryNth(5), // Take every 5th number
    operators.take(10) // Take first 10 results
  )

  everyFifthNumber.subscribe(value => 
    console.log('Every 5th number:', value)
  )
}

// Memory Management Example
const memoryManagementExample = () => {
  const createManagedStream = <T>() => {
    const stream = Stream.create<T>()
    const subscriptions = new Set<{ unsubscribe(): void }>()

    // Override subscribe to track subscriptions
    const originalSubscribe = stream.subscribe.bind(stream)
    stream.subscribe = (observer) => {
      const subscription = originalSubscribe(observer)
      subscriptions.add(subscription)
      
      // Override unsubscribe to remove from tracking
      const originalUnsubscribe = subscription.unsubscribe
      subscription.unsubscribe = () => {
        subscriptions.delete(subscription)
        originalUnsubscribe.call(subscription)
      }
      
      return subscription
    }

    // Add cleanup method
    const cleanup = () => {
      subscriptions.forEach(sub => sub.unsubscribe())
      subscriptions.clear()
      stream.complete()
    }

    return { stream, cleanup, subscriptionCount: () => subscriptions.size }
  }

  // Usage
  const { stream, cleanup, subscriptionCount } = createManagedStream<number>()
  
  const sub1 = stream.subscribe(value => console.log('Sub 1:', value))
  const sub2 = stream.subscribe(value => console.log('Sub 2:', value))
  
  console.log('Active subscriptions:', subscriptionCount()) // 2
  
  // Clean up all subscriptions
  cleanup()
  console.log('Active subscriptions:', subscriptionCount()) // 0
}

// Export examples for documentation
export {
  basicExample,
  factoryExample,
  transformationExample,
  protectionExample,
  combinationExample,
  errorHandlingExample,
  advancedExample,
  cyreIntegrationExample,
  searchExample,
  websocketExample,
  reactIntegrationExample,
  performanceExample,
  customOperatorExample,
  memoryManagementExample
}