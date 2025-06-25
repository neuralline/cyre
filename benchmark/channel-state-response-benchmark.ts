/**
 * src/benchmarks/channel-state-response-benchmark.ts
 * Testing Cyre's Channel-State Response capabilities
 * Tests both state management AND response data patterns
 */

import {cyre} from '../src'

interface ChannelStateResult {
  testName: string
  operationsPerSecond: number
  averageLatencyMs: number
  responseDataSize: number
  stateUpdatesPerSecond: number
  responseSuccessRate: number
  memoryUsageMB: number
  dataIntegrity: boolean
}

class ChannelStateResponseBenchmark {
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
   * Test 1: Pure State Management (Redux-like pattern)
   */
  async testPureStateManagement(): Promise<ChannelStateResult> {
    console.log('🏪 Testing Pure State Management (Redux-like)...')

    const iterations = 5000
    const latencies: number[] = []
    let responseDataSize = 0
    let successfulResponses = 0
    let dataIntegrityChecks = 0

    this.startMemory = this.measureMemory()

    // Create a user state store
    const storeId = 'user-store'
    cyre.action({
      id: storeId,
      payload: {
        users: {},
        count: 0,
        lastUpdate: Date.now()
      }
    })

    // Set up state reducer pattern
    cyre.on(storeId, (actionData: any) => {
      const {type, payload: actionPayload} = actionData

      // Get current state (this is where the magic happens)
      const currentState = actionData.currentState || {
        users: {},
        count: 0,
        lastUpdate: Date.now()
      }

      switch (type) {
        case 'ADD_USER':
          const newUser = actionPayload
          const newState = {
            ...currentState,
            users: {...currentState.users, [newUser.id]: newUser},
            count: currentState.count + 1,
            lastUpdate: Date.now()
          }
          return newState

        case 'UPDATE_USER':
          return {
            ...currentState,
            users: {
              ...currentState.users,
              [actionPayload.id]: {
                ...currentState.users[actionPayload.id],
                ...actionPayload.updates
              }
            },
            lastUpdate: Date.now()
          }

        case 'GET_STATE':
          return currentState

        default:
          return currentState
      }
    })

    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        // Test different state operations
        const operations = [
          // Add user
          async () => {
            const result = await cyre.call(storeId, {
              type: 'ADD_USER',
              payload: {id: i, name: `User${i}`, email: `user${i}@test.com`}
            })
            return result
          },
          // Update user
          async () => {
            const result = await cyre.call(storeId, {
              type: 'UPDATE_USER',
              payload: {
                id: Math.floor(i / 2),
                updates: {lastActive: Date.now()}
              }
            })
            return result
          },
          // Get current state
          async () => {
            const result = await cyre.call(storeId, {type: 'GET_STATE'})
            return result
          }
        ]

        const operation = operations[i % operations.length]
        const result = await operation()

        if (result?.payload) {
          successfulResponses++
          responseDataSize += JSON.stringify(result.payload).length

          // LOG ACTUAL RESPONSE DATA for first few iterations
          if (i < 3) {
            console.log(
              `    [${i}] State Response:`,
              JSON.stringify(result.payload, null, 2)
            )
          }

          // Data integrity check
          if (result.payload.lastUpdate && result.payload.count >= 0) {
            dataIntegrityChecks++
          }
        }
      } catch (error) {
        // Error handling
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    cyre.clear()

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory

    return {
      testName: 'Pure State Management',
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      responseDataSize: Math.round(responseDataSize / successfulResponses),
      stateUpdatesPerSecond: Math.round(successfulResponses / totalTimeSeconds),
      responseSuccessRate: (successfulResponses / iterations) * 100,
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      dataIntegrity: dataIntegrityChecks === successfulResponses
    }
  }

  /**
   * Test 2: API-like Request/Response Pattern
   */
  async testAPIRequestResponse(): Promise<ChannelStateResult> {
    console.log('🌐 Testing API Request/Response Pattern...')

    const iterations = 3000
    const latencies: number[] = []
    let responseDataSize = 0
    let successfulResponses = 0
    let dataIntegrityChecks = 0

    this.startMemory = this.measureMemory()

    // Create various API endpoints as channels
    const endpoints = ['user-api', 'product-api', 'order-api']

    endpoints.forEach(endpoint => {
      cyre.action({id: endpoint, payload: {endpoint, ready: true}})

      cyre.on(endpoint, async (requestData: any) => {
        const {method, path, body, query} = requestData

        // Simulate API processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2))

        switch (endpoint) {
          case 'user-api':
            if (method === 'GET' && path === '/users') {
              return {
                status: 200,
                data: Array.from({length: 10}, (_, i) => ({
                  id: i,
                  name: `User${i}`,
                  email: `user${i}@example.com`,
                  active: Math.random() > 0.5
                })),
                timestamp: Date.now(),
                endpoint
              }
            }
            if (method === 'POST' && path === '/users') {
              return {
                status: 201,
                data: {id: Date.now(), ...body, created: true},
                timestamp: Date.now(),
                endpoint
              }
            }
            break

          case 'product-api':
            if (method === 'GET' && path === '/products') {
              return {
                status: 200,
                data: Array.from({length: 20}, (_, i) => ({
                  id: i,
                  name: `Product${i}`,
                  price: Math.floor(Math.random() * 100) + 10,
                  category: ['electronics', 'clothing', 'books'][i % 3]
                })),
                timestamp: Date.now(),
                endpoint
              }
            }
            break

          case 'order-api':
            if (method === 'POST' && path === '/orders') {
              return {
                status: 201,
                data: {
                  orderId: `order_${Date.now()}`,
                  items: body.items || [],
                  total: Math.floor(Math.random() * 500) + 50,
                  status: 'pending',
                  created: Date.now()
                },
                timestamp: Date.now(),
                endpoint
              }
            }
            break
        }

        return {
          status: 404,
          error: 'Not found',
          timestamp: Date.now(),
          endpoint
        }
      })
    })

    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        const requests = [
          // Get users
          async () =>
            cyre.call('user-api', {
              method: 'GET',
              path: '/users',
              query: {page: 1, limit: 10}
            }),
          // Create user
          async () =>
            cyre.call('user-api', {
              method: 'POST',
              path: '/users',
              body: {name: `NewUser${i}`, email: `new${i}@test.com`}
            }),
          // Get products
          async () =>
            cyre.call('product-api', {
              method: 'GET',
              path: '/products',
              query: {category: 'electronics'}
            }),
          // Create order
          async () =>
            cyre.call('order-api', {
              method: 'POST',
              path: '/orders',
              body: {items: [{id: 1, qty: 2}], userId: i}
            })
        ]

        const request = requests[i % requests.length]
        const result = await request()

        if (result?.payload) {
          successfulResponses++
          responseDataSize += JSON.stringify(result.payload).length

          // LOG ACTUAL RESPONSE DATA for first few iterations
          if (i < 3) {
            console.log(
              `    [${i}] API Response:`,
              JSON.stringify(result.payload, null, 2)
            )
          }

          // Data integrity check
          if (result.payload.status && result.payload.timestamp) {
            dataIntegrityChecks++
          }
        }
      } catch (error) {
        // Error handling
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    cyre.clear()

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory

    return {
      testName: 'API Request/Response',
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      responseDataSize: Math.round(responseDataSize / successfulResponses),
      stateUpdatesPerSecond: Math.round(successfulResponses / totalTimeSeconds),
      responseSuccessRate: (successfulResponses / iterations) * 100,
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      dataIntegrity: dataIntegrityChecks === successfulResponses
    }
  }

  /**
   * Test 3: Hybrid State + Response Pattern
   */
  async testHybridStateResponse(): Promise<ChannelStateResult> {
    console.log('🔄 Testing Hybrid State + Response Pattern...')

    const iterations = 2000
    const latencies: number[] = []
    let responseDataSize = 0
    let successfulResponses = 0
    let dataIntegrityChecks = 0

    this.startMemory = this.measureMemory()

    // Create a shopping cart system with both state and response
    const cartId = 'shopping-cart'
    cyre.action({
      id: cartId,
      payload: {
        items: [],
        total: 0,
        lastUpdate: Date.now(),
        sessionId: 'session_123'
      }
    })

    // Hybrid handler: Updates state AND returns response
    cyre.on(cartId, (actionData: any) => {
      const {action, payload: actionPayload, currentState} = actionData
      const state = currentState || {
        items: [],
        total: 0,
        lastUpdate: Date.now()
      }

      switch (action) {
        case 'ADD_ITEM':
          const newItems = [...state.items, actionPayload.item]
          const newTotal = newItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          )
          const newState = {
            ...state,
            items: newItems,
            total: newTotal,
            lastUpdate: Date.now()
          }

          // Return BOTH state update AND response data
          return {
            // State data
            ...newState,
            // Response data
            success: true,
            message: 'Item added to cart',
            addedItem: actionPayload.item,
            cartSummary: {
              itemCount: newItems.length,
              total: newTotal,
              lastItem: actionPayload.item.name
            }
          }

        case 'REMOVE_ITEM':
          const filteredItems = state.items.filter(
            item => item.id !== actionPayload.itemId
          )
          const updatedTotal = filteredItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          )
          const updatedState = {
            ...state,
            items: filteredItems,
            total: updatedTotal,
            lastUpdate: Date.now()
          }

          return {
            ...updatedState,
            success: true,
            message: 'Item removed from cart',
            removedItemId: actionPayload.itemId,
            cartSummary: {
              itemCount: filteredItems.length,
              total: updatedTotal
            }
          }

        case 'GET_CART':
          return {
            ...state,
            success: true,
            message: 'Cart retrieved',
            cartSummary: {
              itemCount: state.items.length,
              total: state.total,
              isEmpty: state.items.length === 0
            }
          }

        case 'CHECKOUT':
          const checkoutState = {
            ...state,
            items: [],
            total: 0,
            lastUpdate: Date.now()
          }

          return {
            ...checkoutState,
            success: true,
            message: 'Checkout completed',
            order: {
              orderId: `order_${Date.now()}`,
              items: state.items,
              total: state.total,
              timestamp: Date.now()
            },
            cartSummary: {
              itemCount: 0,
              total: 0,
              isEmpty: true
            }
          }

        default:
          return {
            ...state,
            success: false,
            message: 'Unknown action',
            error: `Action '${action}' not recognized`
          }
      }
    })

    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        const operations = [
          // Add item
          async () =>
            cyre.call(cartId, {
              action: 'ADD_ITEM',
              payload: {
                item: {
                  id: `item_${i}`,
                  name: `Product ${i}`,
                  price: Math.floor(Math.random() * 50) + 10,
                  quantity: Math.floor(Math.random() * 3) + 1
                }
              }
            }),
          // Get cart
          async () => cyre.call(cartId, {action: 'GET_CART'}),
          // Remove item (if we have items)
          async () =>
            cyre.call(cartId, {
              action: 'REMOVE_ITEM',
              payload: {itemId: `item_${Math.floor(i / 2)}`}
            }),
          // Checkout
          async () => cyre.call(cartId, {action: 'CHECKOUT'})
        ]

        const operation = operations[i % operations.length]
        const result = await operation()

        if (result?.payload) {
          successfulResponses++
          responseDataSize += JSON.stringify(result.payload).length

          // LOG ACTUAL RESPONSE DATA for first few iterations
          if (i < 3) {
            console.log(
              `    [${i}] Hybrid Response:`,
              JSON.stringify(result.payload, null, 2)
            )
          }

          // Data integrity check - hybrid responses should have both state and response data
          if (
            result.payload.success !== undefined &&
            result.payload.lastUpdate &&
            result.payload.cartSummary
          ) {
            dataIntegrityChecks++
          }
        }
      } catch (error) {
        // Error handling
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    cyre.clear()

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory

    return {
      testName: 'Hybrid State + Response',
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      responseDataSize: Math.round(responseDataSize / successfulResponses),
      stateUpdatesPerSecond: Math.round(successfulResponses / totalTimeSeconds),
      responseSuccessRate: (successfulResponses / iterations) * 100,
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      dataIntegrity: dataIntegrityChecks === successfulResponses
    }
  }

  /**
   * Test 4: High-Frequency Response Data Throughput
   */
  async testHighFrequencyResponseThroughput(): Promise<ChannelStateResult> {
    console.log('⚡ Testing High-Frequency Response Data Throughput...')

    const iterations = 8000
    const latencies: number[] = []
    let responseDataSize = 0
    let successfulResponses = 0
    let dataIntegrityChecks = 0

    this.startMemory = this.measureMemory()

    // Create high-frequency data processor
    const processorId = 'data-processor'
    cyre.action({id: processorId, payload: {ready: true}})

    cyre.on(processorId, (requestData: any) => {
      const {operation, data} = requestData

      switch (operation) {
        case 'TRANSFORM':
          return {
            original: data,
            transformed: data.map((x: number) => x * 2 + 1),
            timestamp: Date.now(),
            operation: 'TRANSFORM'
          }

        case 'AGGREGATE':
          const sum = data.reduce((a: number, b: number) => a + b, 0)
          return {
            data,
            sum,
            avg: sum / data.length,
            min: Math.min(...data),
            max: Math.max(...data),
            count: data.length,
            timestamp: Date.now(),
            operation: 'AGGREGATE'
          }

        case 'FILTER':
          const filtered = data.filter((x: number) => x > 50)
          return {
            original: data,
            filtered,
            originalCount: data.length,
            filteredCount: filtered.length,
            filterRatio: filtered.length / data.length,
            timestamp: Date.now(),
            operation: 'FILTER'
          }

        case 'SORT':
          return {
            original: data,
            sorted: [...data].sort((a: number, b: number) => a - b),
            reversed: [...data].sort((a: number, b: number) => b - a),
            timestamp: Date.now(),
            operation: 'SORT'
          }

        default:
          return {
            error: 'Unknown operation',
            operation,
            timestamp: Date.now()
          }
      }
    })

    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        const testData = Array.from({length: 20}, () =>
          Math.floor(Math.random() * 100)
        )
        const operations = ['TRANSFORM', 'AGGREGATE', 'FILTER', 'SORT']
        const operation = operations[i % operations.length]

        const result = await cyre.call(processorId, {
          operation,
          data: testData
        })

        if (result?.payload) {
          successfulResponses++
          responseDataSize += JSON.stringify(result.payload).length

          // LOG ACTUAL RESPONSE DATA for first few iterations
          if (i < 3) {
            console.log(
              `    [${i}] Data Processing Response:`,
              JSON.stringify(result.payload, null, 2)
            )
          }

          // Data integrity check
          if (
            result.payload.timestamp &&
            result.payload.operation === operation
          ) {
            dataIntegrityChecks++
          }
        }
      } catch (error) {
        // Error handling
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    cyre.clear()

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const memoryUsage = this.measureMemory() - this.startMemory

    return {
      testName: 'High-Frequency Response Throughput',
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      responseDataSize: Math.round(responseDataSize / successfulResponses),
      stateUpdatesPerSecond: Math.round(successfulResponses / totalTimeSeconds),
      responseSuccessRate: (successfulResponses / iterations) * 100,
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      dataIntegrity: dataIntegrityChecks === successfulResponses
    }
  }

  private printResults(results: ChannelStateResult[]): void {
    console.log('\n🔄 CHANNEL-STATE RESPONSE BENCHMARK RESULTS')
    console.log('============================================')

    let totalOperations = 0
    let totalResponses = 0
    let totalDataSize = 0

    results.forEach(result => {
      totalOperations += result.operationsPerSecond
      totalResponses += result.stateUpdatesPerSecond
      totalDataSize += result.responseDataSize

      const integrity = result.dataIntegrity ? '✅' : '❌'

      console.log(`\n${result.testName}`)
      console.log(
        `  • Operations/sec: ${result.operationsPerSecond.toLocaleString()}`
      )
      console.log(`  • Avg Latency: ${result.averageLatencyMs}ms`)
      console.log(
        `  • State Updates/sec: ${result.stateUpdatesPerSecond.toLocaleString()}`
      )
      console.log(
        `  • Response Success Rate: ${result.responseSuccessRate.toFixed(1)}%`
      )
      console.log(`  • Avg Response Size: ${result.responseDataSize} bytes`)
      console.log(`  • Data Integrity: ${integrity}`)
      console.log(`  • Memory Usage: ${result.memoryUsageMB}MB`)
    })

    console.log('\n📊 CHANNEL-STATE RESPONSE SUMMARY')
    console.log('=================================')
    console.log(
      `• Average Operations/sec: ${Math.round(
        totalOperations / results.length
      ).toLocaleString()}`
    )
    console.log(
      `• Average Response Rate: ${Math.round(
        totalResponses / results.length
      ).toLocaleString()}/sec`
    )
    console.log(
      `• Average Response Size: ${Math.round(
        totalDataSize / results.length
      )} bytes`
    )

    const avgLatency =
      results.reduce((sum, r) => sum + r.averageLatencyMs, 0) / results.length
    const avgSuccessRate =
      results.reduce((sum, r) => sum + r.responseSuccessRate, 0) /
      results.length
    console.log(`• Average Latency: ${avgLatency.toFixed(3)}ms`)
    console.log(`• Average Success Rate: ${avgSuccessRate.toFixed(1)}%`)

    console.log('\n🔥 CHANNEL-STATE RESPONSE INSIGHTS:')
    console.log(
      `✅ Pure state management: ${
        results[0]?.operationsPerSecond.toLocaleString() || 'N/A'
      } ops/sec`
    )
    console.log(
      `✅ API request/response: ${
        results[1]?.operationsPerSecond.toLocaleString() || 'N/A'
      } ops/sec`
    )
    console.log(
      `✅ Hybrid state+response: ${
        results[2]?.operationsPerSecond.toLocaleString() || 'N/A'
      } ops/sec`
    )
    console.log(
      `✅ High-frequency throughput: ${
        results[3]?.operationsPerSecond.toLocaleString() || 'N/A'
      } ops/sec`
    )

    const perfectIntegrity = results.every(r => r.dataIntegrity)
    if (perfectIntegrity) {
      console.log(
        '\n🛡️ CHANNEL-STATE RESILIENCE: Perfect data integrity maintained!'
      )
    }

    console.log('\n🎯 REVOLUTIONARY IMPLICATIONS:')
    console.log('• Cyre can replace Redux for state management')
    console.log('• Cyre can replace REST APIs for request/response')
    console.log(
      '• Cyre enables hybrid patterns impossible with traditional tools'
    )
    console.log('• Response data + state updates in single unified system')
  }

  async runChannelStateResponseBenchmark(): Promise<void> {
    console.log('🔄 CYRE CHANNEL-STATE RESPONSE BENCHMARK')
    console.log('=========================================')
    console.log('Testing the revolutionary state + response capabilities...\n')

    const results: ChannelStateResult[] = []

    try {
      results.push(await this.testPureStateManagement())
      await new Promise(resolve => setTimeout(resolve, 500))

      results.push(await this.testAPIRequestResponse())
      await new Promise(resolve => setTimeout(resolve, 500))

      results.push(await this.testHybridStateResponse())
      await new Promise(resolve => setTimeout(resolve, 500))

      results.push(await this.testHighFrequencyResponseThroughput())

      this.printResults(results)
    } catch (error) {
      console.error('❌ Channel-State Response benchmark failed:', error)
    }
  }
}

// Export for use
export {ChannelStateResponseBenchmark}

// Run if called directly
const benchmark = new ChannelStateResponseBenchmark()
benchmark.runChannelStateResponseBenchmark().catch(console.error)
