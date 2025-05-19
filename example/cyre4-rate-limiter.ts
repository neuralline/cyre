// src/examples/cyre4-api-gateway.ts

import {useCyre} from '../src'

// Define request types
interface ApiRequest {
  id: string
  endpoint: string
  payload: any
  priority: 'high' | 'medium' | 'low'
  timestamp: number
}

interface ApiResponse {
  requestId: string
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

/**
 * API Gateway Service using Cyre 4.0
 *
 * Demonstrates proper response handling with Cyre 4.0 hooks
 */
const main = async () => {
  console.log('Starting Cyre 4.0 API Gateway Example')

  // Success/failure tracking
  const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    throttledRequests: 0,
    debouncedRequests: 0,
    retries: 0,
    errors: 0
  }

  const requestLog: Array<{
    id: string
    status: string
    time: number
  }> = []

  // Create channels with different protection configurations
  const highPriorityChannel = useCyre<ApiRequest>({
    name: 'highPriority',
    debug: true,
    protection: {
      throttle: 50, // Minimal throttling for critical operations
      debounce: 10 // Minimal debounce for high-priority
    },
    priority: {level: 'high'}
  })

  const normalChannel = useCyre<ApiRequest>({
    name: 'normal',
    debug: true,
    protection: {
      throttle: 200, // Standard throttle
      debounce: 100 // Standard debounce
    },
    priority: {level: 'medium'}
  })

  // Wait for initialization to complete
  console.log('Initializing channels...')
  await new Promise(resolve => setTimeout(resolve, 300))
  console.log('Channels initialized')

  // Setup request processing logic
  const processRequest = async (request: ApiRequest): Promise<ApiResponse> => {
    const startTime = Date.now()
    console.log(`Processing ${request.priority} request to ${request.endpoint}`)

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 50))

    const response: ApiResponse = {
      requestId: request.id,
      success: !request.endpoint.includes('error'),
      data: {result: `Processed ${request.endpoint}`, timestamp: Date.now()},
      processingTime: Date.now() - startTime
    }

    if (!response.success) {
      response.error = `Error processing ${request.endpoint}`
      delete response.data
    }

    requestLog.push({
      id: request.id,
      status: response.success ? 'success' : 'error',
      time: Date.now()
    })

    return response
  }

  // Register handlers
  highPriorityChannel.on(processRequest)
  normalChannel.on(processRequest)

  // Add request validation middleware
  const requestMiddleware = async (request: ApiRequest, next: any) => {
    if (!request.id || !request.endpoint) {
      return {
        ok: false,
        payload: null,
        message: 'Invalid request: Missing required fields'
      }
    }

    return next(request)
  }

  highPriorityChannel.middleware(requestMiddleware)
  normalChannel.middleware(requestMiddleware)

  /**
   * PATTERN: Correct Cyre 4.0 response handling
   * - Properly handle throttling with retry logic
   * - Handle debounced responses with polling
   * - Process response.payload only when available
   */
  const sendRequest = async (
    request: ApiRequest,
    maxRetries = 3
  ): Promise<ApiResponse | null> => {
    stats.totalRequests++
    let retries = 0
    let waitPromise: Promise<void> | null = null

    // Choose channel based on priority
    const channel =
      request.priority === 'high' ? highPriorityChannel : normalChannel

    while (retries <= maxRetries) {
      try {
        // If we had a wait promise from previous attempt, await it
        if (waitPromise) {
          await waitPromise
          waitPromise = null
        }

        console.log(
          `Sending ${request.priority} request to ${request.endpoint}`
        )
        const response = await channel.call(request)

        if (response.ok) {
          // Successfully accepted by Cyre

          if (response.message?.includes('Debounced')) {
            // CASE 1: Debounced - need to wait for execution
            stats.debouncedRequests++
            console.log(`Request debounced: ${response.message}`)

            // Extract debounce time and wait
            const match = response.message.match(/after (\d+)ms/)
            const debounceTime = match ? parseInt(match[1], 10) + 20 : 200

            // Wait for debounce period plus a buffer
            await new Promise(resolve => setTimeout(resolve, debounceTime))

            // Debounce handling doesn't give us direct access to the result
            // In a real app, you would likely implement a result tracking mechanism
            stats.successfulRequests++
            return {
              requestId: request.id,
              success: true,
              data: {
                note: 'Request was debounced, actual processing result not available'
              },
              processingTime: 0
            }
          }

          if (response.payload) {
            // CASE 2: Direct result available
            stats.successfulRequests++
            return response.payload as ApiResponse
          } else {
            // CASE 3: Accepted but no payload
            console.log(`Request accepted but no result payload available`)
            stats.successfulRequests++
            return {
              requestId: request.id,
              success: true,
              data: {note: 'Request was accepted but result not available'},
              processingTime: 0
            }
          }
        } else if (response.message?.includes('Throttled')) {
          // CASE 4: Throttled - need to retry after waiting
          stats.throttledRequests++
          retries++

          if (retries <= maxRetries) {
            // Extract wait time and add buffer
            const match = response.message.match(/Throttled: (\d+)ms/)
            const waitTime = match ? parseInt(match[1], 10) + 10 : 200

            console.log(
              `Request throttled, retry ${retries}/${maxRetries} after ${waitTime}ms`
            )
            stats.retries++

            // Set up wait promise for next loop iteration
            waitPromise = new Promise(resolve => setTimeout(resolve, waitTime))
          } else {
            // Exceed retry limit
            console.log(`Exceeded retry limit (${maxRetries})`)
            stats.errors++
            return {
              requestId: request.id,
              success: false,
              error: `Exceeded retry limit (${maxRetries})`,
              processingTime: 0
            }
          }
        } else {
          // CASE 5: Other error
          console.log(`Request failed: ${response.message}`)
          stats.errors++
          return {
            requestId: request.id,
            success: false,
            error: response.message,
            processingTime: 0
          }
        }
      } catch (error) {
        // CASE 6: Exception
        console.error(`Error processing request:`, error)
        stats.errors++
        return {
          requestId: request.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          processingTime: 0
        }
      }
    }

    // This shouldn't be reached but TypeScript needs it
    return null
  }

  // Run the examples

  // Example 1: High priority request
  console.log('\n--- Example 1: High Priority Request ---')
  const highPriorityRequest = createRequest('/api/critical-action', 'high')
  const highResult = await sendRequest(highPriorityRequest)
  console.log('High priority result:', highResult)

  // Example 2: Sequential requests with proper waits
  console.log('\n--- Example 2: Sequential Requests ---')
  const requests = [
    createRequest('/api/user/profile', 'medium'),
    createRequest('/api/data/fetch', 'medium'),
    createRequest('/api/system/status', 'high')
  ]

  // Process one at a time with proper waits
  const results = []
  for (const req of requests) {
    const result = await sendRequest(req)
    results.push(result)
    // Add small wait between requests
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  console.log(`Completed ${results.length} sequential requests`)
  results.forEach((result, i) => {
    if (result) {
      console.log(
        `- ${requests[i].endpoint} (${requests[i].priority}): ${
          result.success ? 'Success' : 'Failed'
        }`
      )
    } else {
      console.log(
        `- ${requests[i].endpoint} (${requests[i].priority}): No result`
      )
    }
  })

  // Example 3: Error handling
  console.log('\n--- Example 3: Error Handling ---')
  const errorRequest = createRequest('/api/error-endpoint', 'medium')
  const errorResult = await sendRequest(errorRequest)
  console.log('Error handling result:', errorResult)

  // Show statistics
  console.log('\n--- Final Statistics ---')
  console.log(`Total requests: ${stats.totalRequests}`)
  console.log(`Successful: ${stats.successfulRequests}`)
  console.log(`Throttled: ${stats.throttledRequests}`)
  console.log(`Debounced: ${stats.debouncedRequests}`)
  console.log(`Retries: ${stats.retries}`)
  console.log(`Errors: ${stats.errors}`)

  // Clean up
  console.log('\nCleaning up resources...')
  highPriorityChannel.forget()
  normalChannel.forget()
  console.log('Service shut down')

  setTimeout(() => process.exit(0), 100)
}

// Helper function to create test requests
function createRequest(
  endpoint: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
): ApiRequest {
  return {
    id: `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    endpoint,
    payload: {action: 'process'},
    priority,
    timestamp: Date.now()
  }
}

// Run the example
main().catch(error => {
  console.error('Error in Cyre API Gateway example:', error)
  process.exit(1)
})
