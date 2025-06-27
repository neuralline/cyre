// examples/comprehensive-data-flow.ts
// Comprehensive example showing Cyre's data flow with response logging

import {cyre} from '../src'

/*

    C.Y.R.E - C.O.M.P.R.E.H.E.N.S.I.V.E - E.X.A.M.P.L.E
    
    Demonstrates complete data flow:
    - Input payload → Processing → Response data
    - Response data storage and retrieval
    - Industry-standard patterns
    - Performance implications

*/

interface ApiRequest {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, any>
  body?: any
}

interface ApiResponse {
  status: number
  data: any
  headers: Record<string, string>
  timestamp: number
  duration: number
}

interface UserProfile {
  id: string
  name: string
  email: string
  preferences: Record<string, any>
}

interface ProcessingResult {
  input: any
  output: any
  metadata: {
    processingTime: number
    transformations: string[]
    validationPassed: boolean
  }
}

// Utility for clean logging
const logSection = (title: string) => {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📋 ${title}`)
  console.log('='.repeat(60))
}

const logResult = (label: string, data: any) => {
  console.log(`\n${label}:`)
  console.log(JSON.stringify(data, null, 2))
}

async function runComprehensiveExample() {
  await cyre.init()

  logSection('CYRE DATA FLOW ANALYSIS')

  // =============================================================================
  // EXAMPLE 1: API Request/Response Pattern (Industry Standard)
  // =============================================================================

  logSection('Example 1: API Request/Response Pattern')

  // Register API handler that returns response data
  cyre.action({
    id: 'api-call',
    debounce: 200,
    required: true,
    schema: cyre.schema.object({
      endpoint: cyre.schema.string().minLength(1),
      method: cyre.schema.enums('GET', 'POST', 'PUT', 'DELETE'),
      params: cyre.schema.any().optional(),
      body: cyre.schema.any().optional()
    })
  })

  cyre.on('api-call', (request: ApiRequest): ApiResponse => {
    const start = Date.now()

    // Simulate API processing
    const mockData = {
      users: [
        {id: '1', name: 'John Doe', email: 'john@example.com'},
        {id: '2', name: 'Jane Smith', email: 'jane@example.com'}
      ]
    }

    const response: ApiResponse = {
      status: 200,
      data: mockData,
      headers: {'content-type': 'application/json'},
      timestamp: Date.now(),
      duration: Date.now() - start
    }

    console.log(`🌐 API Call: ${request.method} ${request.endpoint}`)
    console.log(`📊 Response: ${response.status} (${response.duration}ms)`)

    return response
  })

  // Test API calls
  const apiRequest: ApiRequest = {
    endpoint: '/api/users',
    method: 'GET',
    params: {page: 1, limit: 10}
  }

  const apiResult = await cyre.call('api-call', apiRequest)
  logResult('API Call Result', {
    success: apiResult.ok,
    inputPayload: apiRequest,
    responseData: apiResult.payload,
    metadata: apiResult.metadata
  })

  // =============================================================================
  // EXAMPLE 2: Data Processing Pipeline
  // =============================================================================

  logSection('Example 2: Data Processing Pipeline')

  cyre.action({
    id: 'process-user-data',
    transform: (input: any) => ({
      ...input,
      processedAt: Date.now(),
      normalized: {
        name: input.name?.toLowerCase().trim(),
        email: input.email?.toLowerCase().trim(),
        domain: input.email?.split('@')[1]
      }
    }),
    condition: (data: any) => data.email && data.name,
    required: 'non-empty'
  })

  cyre.on('process-user-data', (userData: any): ProcessingResult => {
    const start = Date.now()

    const processed = {
      id: `user-${Date.now()}`,
      profile: {
        displayName: userData.normalized.name
          .split(' ')
          .map((n: string) => n.charAt(0).toUpperCase() + n.slice(1))
          .join(' '),
        email: userData.normalized.email,
        domain: userData.normalized.domain,
        verified: userData.normalized.domain === 'company.com'
      },
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en'
      }
    }

    const result: ProcessingResult = {
      input: userData,
      output: processed,
      metadata: {
        processingTime: Date.now() - start,
        transformations: ['normalization', 'validation', 'enrichment'],
        validationPassed: true
      }
    }

    console.log(`👤 Processed user: ${processed.profile.displayName}`)
    console.log(`✅ Domain verified: ${processed.profile.verified}`)

    return result
  })

  const userData = {
    name: '  John DOE  ',
    email: '  JOHN@company.COM  ',
    role: 'developer'
  }

  const processResult = await cyre.call('process-user-data', userData)
  logResult('Processing Result', {
    success: processResult.ok,
    inputPayload: userData,
    processedData: processResult.payload,
    transformationMetadata: processResult.metadata
  })

  // =============================================================================
  // EXAMPLE 3: Event Sourcing Pattern
  // =============================================================================

  logSection('Example 3: Event Sourcing Pattern')

  // Event store simulation
  const eventStore: any[] = []

  cyre.action({
    id: 'handle-user-event',
    required: true
  })

  cyre.on('handle-user-event', (event: any) => {
    const enrichedEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      version: 1,
      metadata: {
        source: 'user-action',
        processed: true
      }
    }

    // Store event
    eventStore.push(enrichedEvent)

    console.log(`📝 Event stored: ${event.type} for user ${event.userId}`)
    console.log(`📊 Total events: ${eventStore.length}`)

    return {
      eventStored: true,
      eventId: enrichedEvent.id,
      totalEvents: eventStore.length,
      event: enrichedEvent
    }
  })

  const userEvents = [
    {type: 'user.created', userId: 'user-123', data: {name: 'John'}},
    {type: 'user.updated', userId: 'user-123', data: {email: 'john@new.com'}},
    {
      type: 'user.deleted',
      userId: 'user-123',
      data: {reason: 'account-closure'}
    }
  ]

  const eventResults = []
  for (const event of userEvents) {
    const result = await cyre.call('handle-user-event', event)
    eventResults.push(result)
    await new Promise(resolve => setTimeout(resolve, 50)) // Small delay
  }

  logResult('Event Sourcing Results', {
    eventsProcessed: eventResults.length,
    finalEventStore: eventStore,
    lastEventResult: eventResults[eventResults.length - 1]
  })

  // =============================================================================
  // EXAMPLE 4: Real-time Data Aggregation
  // =============================================================================

  logSection('Example 4: Real-time Data Aggregation')

  const aggregationState = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastUpdated: Date.now()
  }

  cyre.action({
    id: 'aggregate-metrics',
    detectChanges: true
  })

  cyre.on('aggregate-metrics', (metrics: any) => {
    // Update aggregation
    aggregationState.totalRequests++

    if (metrics.success) {
      aggregationState.successfulRequests++
    } else {
      aggregationState.failedRequests++
    }

    // Calculate running average
    aggregationState.averageResponseTime =
      (aggregationState.averageResponseTime *
        (aggregationState.totalRequests - 1) +
        metrics.responseTime) /
      aggregationState.totalRequests

    aggregationState.lastUpdated = Date.now()

    const successRate =
      (aggregationState.successfulRequests / aggregationState.totalRequests) *
      100

    console.log(`📈 Metrics updated: ${successRate.toFixed(1)}% success rate`)
    console.log(
      `⏱️  Average response: ${aggregationState.averageResponseTime.toFixed(
        2
      )}ms`
    )

    return {
      current: {...aggregationState},
      successRate: successRate,
      trend:
        successRate > 95
          ? 'excellent'
          : successRate > 90
          ? 'good'
          : 'needs-attention'
    }
  })

  // Simulate metric collection
  const metricData = [
    {success: true, responseTime: 150},
    {success: true, responseTime: 200},
    {success: false, responseTime: 5000},
    {success: true, responseTime: 175},
    {success: true, responseTime: 125}
  ]

  const aggregationResults = []
  for (const metric of metricData) {
    const result = await cyre.call('aggregate-metrics', metric)
    aggregationResults.push(result)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  logResult('Aggregation Results', {
    finalState: aggregationState,
    lastResult: aggregationResults[aggregationResults.length - 1]
  })

  // =============================================================================
  // DATA FLOW ANALYSIS
  // =============================================================================

  logSection('DATA FLOW ANALYSIS')

  console.log(`
🔄 CYRE DATA FLOW PATTERNS OBSERVED:

1. INPUT → PROCESSING → OUTPUT
   ├─ Input Payload: User-provided data
   ├─ Processing: Transformations, validations, business logic
   └─ Output Response: Processed result from .on() handler

2. RESPONSE DATA VALUE:
   ├─ Contains processed/enriched data
   ├─ Includes computed results and metadata
   ├─ Often more valuable than original input
   └─ Represents the "state after processing"

3. STORAGE IMPLICATIONS:
   ├─ Input Payload: Needed for change detection, debugging
   ├─ Response Data: Valuable for caching, state management
   ├─ Both serve different purposes in the system
   └─ Storage decision depends on use case

4. INDUSTRY STANDARDS:
   ├─ Redux: Stores both actions and state
   ├─ Event Sourcing: Stores events and snapshots
   ├─ CQRS: Separates commands and queries
   └─ REST APIs: Request/response pattern
  `)

  // =============================================================================
  // PERFORMANCE COMPARISON
  // =============================================================================

  logSection('PERFORMANCE IMPACT ANALYSIS')

  const performanceMetrics = {
    inputStorage: {size: 0, operations: 0},
    responseStorage: {size: 0, operations: 0},
    bothStorage: {size: 0, operations: 0}
  }

  // Simulate storage operations
  const testData = {id: 'test', data: 'x'.repeat(1000)} // 1KB data

  console.time('Input Only Storage')
  for (let i = 0; i < 1000; i++) {
    // Simulate storing only input
    performanceMetrics.inputStorage.size += JSON.stringify(testData).length
    performanceMetrics.inputStorage.operations++
  }
  console.timeEnd('Input Only Storage')

  console.time('Response Only Storage')
  for (let i = 0; i < 1000; i++) {
    // Simulate storing only response
    const response = {...testData, processed: true, timestamp: Date.now()}
    performanceMetrics.responseStorage.size += JSON.stringify(response).length
    performanceMetrics.responseStorage.operations++
  }
  console.timeEnd('Response Only Storage')

  console.time('Both Input and Response Storage')
  for (let i = 0; i < 1000; i++) {
    // Simulate storing both
    const response = {...testData, processed: true, timestamp: Date.now()}
    performanceMetrics.bothStorage.size +=
      JSON.stringify(testData).length + JSON.stringify(response).length
    performanceMetrics.bothStorage.operations++
  }
  console.timeEnd('Both Input and Response Storage')

  logResult('Performance Analysis', {
    inputOnly: {
      size: `${(performanceMetrics.inputStorage.size / 1024).toFixed(2)} KB`,
      memoryEfficiency: 'High',
      debugCapability: 'Limited',
      stateRecovery: 'Poor'
    },
    responseOnly: {
      size: `${(performanceMetrics.responseStorage.size / 1024).toFixed(2)} KB`,
      memoryEfficiency: 'Medium',
      debugCapability: 'Good',
      stateRecovery: 'Excellent'
    },
    bothInputAndResponse: {
      size: `${(performanceMetrics.bothStorage.size / 1024).toFixed(2)} KB`,
      memoryEfficiency: 'Lower',
      debugCapability: 'Excellent',
      stateRecovery: 'Perfect'
    }
  })

  // =============================================================================
  // RECOMMENDATIONS
  // =============================================================================

  logSection('RECOMMENDATIONS')

  console.log(`
🎯 STORAGE STRATEGY RECOMMENDATIONS:

1. DUAL STORAGE APPROACH (RECOMMENDED):
   ├─ Store input payload for change detection & debugging
   ├─ Store response data for state management & caching
   ├─ Use TTL/cleanup strategies for memory management
   └─ Configurable per channel based on needs

2. ENHANCED RESPONSE STRUCTURE:
   ├─ Include original input reference
   ├─ Add processing metadata
   ├─ Timestamp and versioning
   └─ Clear success/error indicators

3. PAYLOAD STORE ENHANCEMENTS:
   ├─ Separate input and output stores
   ├─ Add response data storage methods
   ├─ Implement cleanup policies
   └─ Add query capabilities for both

4. INDUSTRY ALIGNMENT:
   ├─ Follow Redux pattern: actions + state
   ├─ Event sourcing: events + projections
   ├─ CQRS: commands + queries
   └─ REST: request + response logging
  `)

  console.log(`\n✅ Example completed successfully!`)
  console.log(
    `📊 Demonstrated ${eventStore.length} events, ${aggregationState.totalRequests} metrics`
  )
}

// Export for use
export {runComprehensiveExample}

// Run if executed directly

runComprehensiveExample().catch(console.error)
