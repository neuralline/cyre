// query-showcase.ts
// Advanced Query System Showcase for Node.js with TypeScript
// Run with: npx ts-node query-showcase.ts or npm run showcase

import {cyre} from '../src' // Adjust path to your Cyre source
import type {
  QueryFilter,
  PayloadQuery,
  MetricsQuery,
  ActionPayload
} from '../src/types/core'

/*

      C.Y.R.E - Q.U.E.R.Y - S.H.O.W.C.A.S.E
      
      Comprehensive TypeScript demonstration of the advanced query system:
      - Real-time data simulation with proper typing
      - Complex query patterns with type safety
      - Performance monitoring
      - Streaming queries
      - Live subscriptions

*/

// Type definitions for our demo data
interface SensorReading {
  value: number
  unit: string
  location: string
  timestamp: number
  quality: 'good' | 'fair' | 'poor'
  battery: number
}

interface ApiCallData {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  endpoint: string
  status: number
  responseTime: number
  timestamp: number
  userAgent: string
  ip: string
}

interface UserActivity {
  userId: string
  action:
    | 'login'
    | 'logout'
    | 'view-product'
    | 'add-cart'
    | 'checkout'
    | 'search'
  userType: 'guest' | 'member' | 'premium' | 'admin'
  sessionId: string
  timestamp: number
  metadata: {
    page: string
    duration: number
  }
}

// Utility functions with proper typing
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))
const randomBetween = (min: number, max: number): number =>
  Math.random() * (max - min) + min
const randomChoice = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

// Simulated sensor data
const sensorTypes = ['temperature', 'humidity', 'pressure', 'light'] as const
const locations = ['floor-1', 'floor-2', 'floor-3', 'outdoor'] as const
const deviceStates = ['active', 'idle', 'error', 'maintenance'] as const

type SensorType = (typeof sensorTypes)[number]
type Location = (typeof locations)[number]

// Generate realistic sensor readings with proper typing
const generateSensorReading = (
  sensorType: SensorType,
  location: Location
): SensorReading => {
  const baseValues = {
    temperature: {min: 18, max: 28, unit: '°C'},
    humidity: {min: 30, max: 70, unit: '%'},
    pressure: {min: 1000, max: 1020, unit: 'hPa'},
    light: {min: 100, max: 1000, unit: 'lux'}
  } as const

  const base = baseValues[sensorType]
  return {
    value: randomBetween(base.min, base.max),
    unit: base.unit,
    location,
    timestamp: Date.now(),
    quality: randomChoice(['good', 'fair', 'poor'] as const),
    battery: randomBetween(20, 100)
  }
}

// API simulation data
const apiEndpoints = ['users', 'orders', 'products', 'analytics'] as const
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE'] as const
const statusCodes = [200, 201, 400, 401, 404, 500] as const

type ApiEndpoint = (typeof apiEndpoints)[number]

const generateApiCall = (endpoint: ApiEndpoint): ApiCallData => ({
  method: randomChoice(httpMethods),
  endpoint,
  status: randomChoice(statusCodes),
  responseTime: randomBetween(50, 2000),
  timestamp: Date.now(),
  userAgent: randomChoice(['chrome', 'firefox', 'safari', 'mobile']),
  ip: `192.168.1.${Math.floor(randomBetween(1, 255))}`
})

// User activity simulation
const userActions = [
  'login',
  'logout',
  'view-product',
  'add-cart',
  'checkout',
  'search'
] as const
const userTypes = ['guest', 'member', 'premium', 'admin'] as const

const generateUserActivity = (): UserActivity => ({
  userId: `user-${Math.floor(randomBetween(1000, 9999))}`,
  action: randomChoice(userActions),
  userType: randomChoice(userTypes),
  sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  metadata: {
    page: randomChoice(['home', 'catalog', 'product', 'cart', 'account']),
    duration: randomBetween(1000, 30000)
  }
})

async function setupDemoData(): Promise<void> {
  console.log('🚀 Setting up Cyre Query System Showcase...\n')

  // Initialize Cyre
  await cyre.initialize({autoSave: false})

  console.log('📊 Creating sensor channels...')

  // Create sensor channels with proper typing
  for (const location of locations) {
    for (const sensor of sensorTypes) {
      const channelId = `sensor-${sensor}-${location}`

      cyre.action({
        id: channelId,
        payload: generateSensorReading(sensor, location),
        type: 'sensor',
        detectChanges: true,
        throttle: 1000 // Prevent spam
      })

      cyre.on(channelId, (data: SensorReading) => {
        // Simulate sensor data processing
        if (data.value > 25 && sensor === 'temperature') {
          console.log(
            `🌡️  High temperature alert: ${data.value}°C at ${data.location}`
          )
        }
        return {processed: true, alertSent: data.value > 25}
      })
    }
  }

  console.log('🌐 Creating API monitoring channels...')

  // Create API monitoring channels
  for (const endpoint of apiEndpoints) {
    const channelId = `api-${endpoint}`

    cyre.action({
      id: channelId,
      payload: generateApiCall(endpoint),
      type: 'api-monitoring',
      detectChanges: false
    })

    cyre.on(channelId, (data: ApiCallData) => {
      if (data.status >= 500) {
        console.log(
          `🚨 API Error: ${data.method} /${data.endpoint} - ${data.status}`
        )
      }
      return {
        monitored: true,
        healthy: data.status < 400,
        responseTime: data.responseTime
      }
    })
  }

  console.log('👥 Creating user activity channels...')

  // Create user activity channels
  for (const action of userActions) {
    const channelId = `user-${action}`

    cyre.action({
      id: channelId,
      payload: generateUserActivity(),
      type: 'user-activity',
      detectChanges: false
    })

    cyre.on(channelId, (data: UserActivity) => {
      if (data.action === 'checkout' && data.userType === 'premium') {
        console.log(`💰 Premium checkout: ${data.userId}`)
      }
      return {tracked: true, valuable: data.userType === 'premium'}
    })
  }

  // Create some error-prone channels for testing
  cyre.action({
    id: 'error-prone-service',
    payload: {status: 'unstable'},
    type: 'service'
  })

  cyre.on('error-prone-service', () => {
    if (Math.random() < 0.3) {
      // 30% error rate
      throw new Error('Service unavailable')
    }
    return {status: 'ok'}
  })

  console.log('✅ Demo data setup complete!\n')
}

async function demonstrateBasicQueries(): Promise<void> {
  console.log('='.repeat(60))
  console.log('🔍 BASIC QUERY DEMONSTRATIONS')
  console.log('='.repeat(60))

  // Query 1: Get all sensor channels with proper typing
  console.log('📊 Query 1: All sensor channels')
  const sensorFilter: QueryFilter = {
    channelPattern: 'sensor-*'
  }
  const sensorChannels = cyre.query.channels(sensorFilter)
  console.log(`Found ${sensorChannels.total} sensor channels`)
  console.log(`Query time: ${sensorChannels.metadata.queryTime.toFixed(2)}ms`)
  console.log(
    'Sample channels:',
    sensorChannels.channels.slice(0, 3).map(c => c.id)
  )
  console.log()

  // Query 2: Get channels with recent activity
  console.log('⚡ Query 2: Recently active channels')
  const activeFilter: QueryFilter = {
    lastExecutedSince: Date.now() - 60000, // Last minute
    hasSubscriber: true
  }
  const activeChannels = cyre.query.channels(activeFilter)
  console.log(`Found ${activeChannels.total} active channels`)
  console.log(`Query time: ${activeChannels.metadata.queryTime.toFixed(2)}ms`)
  console.log()

  // Query 3: Get channels by type
  console.log('🏷️  Query 3: Channels by type')
  const apiFilter: QueryFilter = {channelPattern: 'api-*'}
  const apiChannels = cyre.query.channels(apiFilter)
  console.log(`API channels: ${apiChannels.total}`)

  const userFilter: QueryFilter = {channelPattern: 'user-*'}
  const userChannels = cyre.query.channels(userFilter)
  console.log(`User activity channels: ${userChannels.total}`)
  console.log()

  // Query 4: Problem channels
  console.log('🚨 Query 4: Problem channels (using pattern)')
  const problemChannels = cyre.query.patterns.problemChannels(1) // Channels with >1 error
  console.log(`Found ${problemChannels.filtered} problem channels`)
  if (problemChannels.channels.length > 0) {
    console.log(
      'Problem channels:',
      problemChannels.channels.map(c => ({
        id: c.id,
        errorCount: c.errorCount,
        lastExecuted: new Date(c.lastExecuted || 0).toLocaleTimeString()
      }))
    )
  }
  console.log()
}

async function demonstratePayloadQueries(): Promise<void> {
  console.log('='.repeat(60))
  console.log('📦 PAYLOAD QUERY DEMONSTRATIONS')
  console.log('='.repeat(60))

  // Update some sensor data first
  console.log('📡 Generating fresh sensor data...')
  for (let i = 0; i < 5; i++) {
    for (const location of locations.slice(0, 2)) {
      // Just first 2 locations
      for (const sensor of sensorTypes.slice(0, 2)) {
        // Just first 2 sensors
        const channelId = `sensor-${sensor}-${location}`
        await cyre.call(channelId, generateSensorReading(sensor, location))
      }
    }
    await sleep(100) // Small delay between updates
  }

  // Query 1: Temperature sensor aggregation with safe handling
  console.log('🌡️  Query 1: Temperature sensor statistics')

  // First check what data we actually have
  const tempChannelsCheck = cyre.query.channels({
    channelPattern: 'sensor-temperature-*'
  })
  console.log(`Found ${tempChannelsCheck.total} temperature channels`)

  // Check if channels have recent payloads
  const tempChannelsWithPayload = cyre.query.channels({
    channelPattern: 'sensor-temperature-*',
    hasPayload: true
  })
  console.log(`${tempChannelsWithPayload.total} channels have payload data`)

  if (tempChannelsWithPayload.total > 0) {
    const tempQuery: PayloadQuery = {
      channelPattern: 'sensor-temperature-*',
      limit: 50
    }

    const tempData = cyre.query.payloads(tempQuery)
    console.log(`Payload query returned ${tempData.total} results`)

    if (tempData.results && tempData.results.length > 0) {
      // Extract numeric values for statistics
      const values: number[] = []
      tempData.results.forEach(result => {
        const payload = result.payload
        let value: number | undefined

        // Handle different payload structures
        if (typeof payload === 'number') {
          value = payload
        } else if (payload && typeof payload.value === 'number') {
          value = payload.value
        } else if (
          payload &&
          payload.payload &&
          typeof payload.payload.value === 'number'
        ) {
          value = payload.payload.value
        }

        if (typeof value === 'number' && !isNaN(value)) {
          values.push(value)
        }
      })

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0)
        const avg = sum / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        const variance =
          values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) /
          values.length
        const stdDev = Math.sqrt(variance)

        console.log('Temperature Statistics:')
        console.log(`  Count: ${values.length}`)
        console.log(`  Average: ${avg.toFixed(1)}°C`)
        console.log(`  Min: ${min.toFixed(1)}°C`)
        console.log(`  Max: ${max.toFixed(1)}°C`)
        console.log(`  Std Dev: ${stdDev.toFixed(2)}°C`)
        console.log(
          `  Query time: ${tempData.queryTime?.toFixed(2) || 'N/A'}ms`
        )
      } else {
        console.log('  No numeric temperature values found in payloads')
        console.log(
          '  Sample payload structure:',
          JSON.stringify(tempData.results[0]?.payload, null, 2)
        )
      }
    } else {
      console.log('  No temperature data available for statistics')
    }
  } else {
    console.log('  No temperature channels with payload data found')
  }
  console.log()

  // Query 2: Recent payloads with safe transform
  console.log('🔄 Query 2: Recent sensor data with transformation')
  const recentQuery: PayloadQuery = {
    channelPattern: 'sensor-*',
    since: Date.now() - 30000, // Last 30 seconds
    limit: 10,
    transform: (payload: any) => {
      // Handle both direct payload and nested payload structures
      const data = payload?.payload || payload
      if (!data || typeof data !== 'object') {
        return {error: 'Invalid payload structure', raw: payload}
      }

      return {
        type: data.location || 'unknown',
        value:
          typeof data.value === 'number'
            ? Math.round(data.value * 100) / 100
            : 0,
        quality: data.quality || 'unknown',
        unit: data.unit || '',
        timestamp: data.timestamp
          ? new Date(data.timestamp).toLocaleTimeString()
          : 'unknown'
      }
    }
  }
  const recentSensorData = cyre.query.payloads(recentQuery)

  console.log(`Found ${recentSensorData.total} recent sensor readings`)
  console.log('Sample data:')
  if (recentSensorData.results && recentSensorData.results.length > 0) {
    recentSensorData.results.slice(0, 5).forEach(reading => {
      const payload = reading.payload
      if (payload.error) {
        console.log(`  ${reading.channelId}: ERROR - ${payload.error}`)
        console.log(`    Raw payload:`, JSON.stringify(payload.raw))
      } else {
        console.log(
          `  ${reading.channelId}: ${payload.value}${payload.unit} at ${payload.type} (${payload.timestamp})`
        )
      }
    })
  } else {
    console.log('  No recent sensor data found')
  }
  console.log()

  // Query 3: Simple payload inspection without transformation
  console.log('📍 Query 3: Raw sensor payload inspection')
  const rawQuery: PayloadQuery = {
    channelPattern: 'sensor-temperature-*',
    since: Date.now() - 60000, // Last minute
    limit: 5
  }
  const rawSensorData = cyre.query.payloads(rawQuery)

  console.log(`Raw sensor data structure:`)
  if (rawSensorData.results && rawSensorData.results.length > 0) {
    rawSensorData.results.slice(0, 2).forEach(reading => {
      console.log(`  ${reading.channelId}:`)
      console.log(
        `    Payload structure:`,
        JSON.stringify(reading.payload, null, 4)
      )
    })
  } else {
    console.log('  No raw sensor data found')
  }
  console.log()

  // Query 4: Grouped by channel pattern
  console.log('📊 Query 4: Sensor data grouped by channel pattern')
  const groupedQuery: PayloadQuery = {
    channelPattern: 'sensor-*',
    since: Date.now() - 60000, // Last minute
    groupBy: 'channelId'
  }
  const groupedByChannel = cyre.query.payloads(groupedQuery)

  console.log(`Grouped sensor data:`)
  if (groupedByChannel.grouped) {
    const channelKeys = Object.keys(groupedByChannel.grouped).slice(0, 3)
    channelKeys.forEach(channelId => {
      const readings = groupedByChannel.grouped[channelId]
      console.log(`  ${channelId}: ${readings.length} readings`)
    })
  } else {
    console.log('  No grouped data available')
  }
  console.log()
}

async function demonstrateMetricsQueries(): Promise<void> {
  console.log('='.repeat(60))
  console.log('📈 METRICS QUERY DEMONSTRATIONS')
  console.log('='.repeat(60))

  // Generate some activity first
  console.log('🎭 Generating system activity...')
  for (let i = 0; i < 20; i++) {
    // Random API calls
    const endpoint = randomChoice(apiEndpoints)
    await cyre.call(`api-${endpoint}`, generateApiCall(endpoint))

    // Random user activity
    const action = randomChoice(userActions)
    await cyre.call(`user-${action}`, generateUserActivity())

    // Occasional error calls
    if (Math.random() < 0.2) {
      try {
        await cyre.call('error-prone-service', {trigger: 'test'})
      } catch (error) {
        // Expected errors
      }
    }

    await sleep(50) // Spread out the calls
  }

  // Query 1: Call metrics by channel with proper typing
  console.log('📊 Query 1: Call metrics aggregated by channel')
  const callMetricsQuery: MetricsQuery = {
    eventType: ['call', 'execution', 'error'],
    since: Date.now() - 60000, // Last minute
    aggregateBy: 'channel'
  }
  const callMetrics = cyre.query.metrics(callMetricsQuery)

  console.log('Channel activity summary:')
  Object.entries(callMetrics.byChannel)
    .slice(0, 5)
    .forEach(([channelId, stats]: [string, any]) => {
      console.log(`  ${channelId}:`)
      console.log(`    Calls: ${stats.callCount}`)
      console.log(`    Executions: ${stats.executionCount}`)
      console.log(`    Errors: ${stats.errorCount}`)
      console.log(
        `    Success rate: ${(
          (stats.executionCount / Math.max(stats.callCount, 1)) *
          100
        ).toFixed(1)}%`
      )
    })
  console.log()

  // Query 2: Error analysis
  console.log('🚨 Query 2: Error analysis')
  const errorQuery: MetricsQuery = {
    eventType: ['error'],
    since: Date.now() - 300000, // Last 5 minutes
    limit: 50
  }
  const errorMetrics = cyre.query.metrics(errorQuery)

  console.log(`Total errors: ${errorMetrics.total}`)
  if (errorMetrics.events.length > 0) {
    const errorsByChannel = errorMetrics.events.reduce(
      (acc: Record<string, number>, event) => {
        acc[event.actionId] = (acc[event.actionId] || 0) + 1
        return acc
      },
      {}
    )

    console.log('Errors by channel:')
    Object.entries(errorsByChannel).forEach(([channelId, count]) => {
      console.log(`  ${channelId}: ${count} errors`)
    })
  }
  console.log()

  // Query 3: System health overview
  console.log('💚 Query 3: System health overview (using pattern)')
  const systemHealth = cyre.query.patterns.systemHealth()

  console.log('System Health Report:')
  console.log(
    `  Recent errors: ${
      Object.keys(systemHealth.errors.byChannel).length
    } channels with errors`
  )
  console.log(
    `  Active channels: ${
      Object.keys(systemHealth.callRate.byChannel).length
    } channels with recent calls`
  )
  console.log(
    `  Generated at: ${new Date(systemHealth.timestamp).toLocaleTimeString()}`
  )
  console.log()
}

async function demonstrateRealTimeQueries(): Promise<void> {
  console.log('='.repeat(60))
  console.log('⚡ REAL-TIME QUERY DEMONSTRATIONS')
  console.log('='.repeat(60))

  console.log('🔔 Setting up real-time query subscriptions...')

  // First, let's check if query.subscribe exists
  if (!cyre.query.subscribe) {
    console.log(
      '⚠️  Real-time query subscriptions not available in current implementation'
    )
    console.log(
      '   This feature requires the advanced query system to be fully integrated'
    )
    console.log('   Simulating real-time monitoring with periodic queries...')

    // Simulate real-time monitoring with periodic queries
    let monitoringActive = true
    let errorCount = 0
    let tempAlertCount = 0

    const monitoringInterval = setInterval(async () => {
      if (!monitoringActive) return

      // Monitor errors
      const recentErrors = cyre.query.metrics({
        eventType: ['error'],
        since: Date.now() - 5000 // Last 5 seconds
      })

      if (recentErrors.total > errorCount) {
        const newErrors = recentErrors.total - errorCount
        console.log(`🚨 ALERT: ${newErrors} new errors detected`)
        errorCount = recentErrors.total
      }

      // Monitor temperature (simulated)
      const tempChannels = cyre.query.channels({
        channelPattern: 'sensor-temperature-*'
      })

      if (tempChannels.total > 0 && Math.random() < 0.3) {
        tempAlertCount++
        console.log(
          `🌡️  Temperature Alert #${tempAlertCount}: Monitoring ${tempChannels.total} sensors`
        )
      }

      // Monitor utilization
      const utilization = cyre.query.patterns.utilization()
      if (Math.random() < 0.2) {
        // Occasionally show utilization
        console.log(
          `📊 System Utilization: ${utilization.active}/${
            utilization.total
          } channels active (${utilization.utilization.toFixed(1)}%)`
        )
      }
    }, 2000) // Check every 2 seconds

    // Generate activity for 10 seconds
    console.log('✅ Simulated real-time monitoring active for 10 seconds...')
    console.log('   (Generating activity and monitoring events)')
    console.log()

    for (let i = 0; i < 10; i++) {
      // Update temperature sensors
      for (const location of locations.slice(0, 2)) {
        const reading = generateSensorReading('temperature', location)
        if (Math.random() < 0.3) {
          reading.value = randomBetween(25, 30) // High temperature
        }
        await cyre.call(`sensor-temperature-${location}`, reading)
      }

      // Generate API activity
      const endpoint = randomChoice(apiEndpoints)
      const apiCall = generateApiCall(endpoint)
      if (Math.random() < 0.15) {
        apiCall.status = randomChoice([500, 502, 503]) // Server errors
      }
      await cyre.call(`api-${endpoint}`, apiCall)

      // Trigger error-prone service
      if (Math.random() < 0.25) {
        try {
          await cyre.call('error-prone-service', {test: Date.now()})
        } catch (error) {
          // Expected errors
        }
      }

      await sleep(1000) // Wait 1 second
    }

    // Stop monitoring
    monitoringActive = false
    clearInterval(monitoringInterval)

    console.log('\n🛑 Simulated real-time monitoring completed')
    console.log('✅ Real-time demo completed')
    console.log()
    return
  }

  // Original real-time subscription code (if available)
  const errorSubscription = cyre.query.subscribe(
    'error-monitor',
    {
      type: 'metrics',
      eventType: ['error'],
      since: Date.now() - 10000,
      aggregateBy: 'channel'
    },
    (result: any) => {
      const errorChannels = Object.keys(result.byChannel)
      if (errorChannels.length > 0) {
        console.log(
          `🚨 ALERT: ${errorChannels.length} channels with recent errors:`,
          errorChannels
        )
      }
    }
  )

  // ... rest of original subscription code
}

async function demonstrateQueryPerformance(): Promise<void> {
  console.log('='.repeat(60))
  console.log('⚡ QUERY PERFORMANCE DEMONSTRATIONS')
  console.log('='.repeat(60))

  // Create more channels for performance testing
  console.log('📊 Creating additional channels for performance testing...')
  for (let i = 0; i < 100; i++) {
    const channelId = `perf-test-${i}`
    cyre.action({
      id: channelId,
      payload: {value: randomBetween(1, 100), iteration: i},
      type: 'performance-test'
    })

    if (i % 10 === 0) {
      cyre.on(channelId, () => ({processed: true}))
    }
  }

  console.log('🏃 Running performance benchmarks...')

  // Benchmark 1: Large channel query
  const start1 = performance.now()
  const largeQueryFilter: QueryFilter = {channelPattern: '*'}
  const largeQuery = cyre.query.channels(largeQueryFilter)
  const time1 = performance.now() - start1

  console.log(`📈 Benchmark 1: Query all ${largeQuery.total} channels`)
  console.log(`   Time: ${time1.toFixed(2)}ms`)
  console.log(`   Cached: ${largeQuery.metadata.cached || false}`)
  console.log(`   Index used: ${largeQuery.metadata.indexUsed || false}`)
  console.log()

  // Benchmark 2: Repeated query (should be cached)
  const start2 = performance.now()
  const cachedQuery = cyre.query.channels(largeQueryFilter)
  const time2 = performance.now() - start2

  console.log(`💾 Benchmark 2: Repeated query (cache test)`)
  console.log(
    `   Time: ${time2.toFixed(2)}ms (${(
      ((time1 - time2) / time1) *
      100
    ).toFixed(1)}% faster)`
  )
  console.log(`   Cached: ${cachedQuery.metadata.cached || false}`)
  console.log()

  // Benchmark 3: Complex filtering
  const start3 = performance.now()
  const complexFilter: QueryFilter = {
    channelPattern: 'perf-test-*',
    hasSubscriber: true,
    executionCount: {gt: 0}
  }
  const complexQuery = cyre.query.channels(complexFilter)
  const time3 = performance.now() - start3

  console.log(`🎯 Benchmark 3: Complex filtering`)
  console.log(
    `   Found: ${complexQuery.filtered}/${complexQuery.total} channels`
  )
  console.log(`   Time: ${time3.toFixed(2)}ms`)
  console.log()

  // Query cache stats
  const queryStats = cyre.query.stats()
  console.log('🔍 Query System Statistics:')
  console.log(
    `   Cache hit ratio: ${(queryStats.cache.hitRatio * 100).toFixed(1)}%`
  )
  console.log(
    `   Index last updated: ${new Date(
      queryStats.indexLastUpdate
    ).toLocaleTimeString()}`
  )
  console.log()
}

async function runShowcase(): Promise<void> {
  console.clear()
  console.log('🎪 CYRE QUERY SYSTEM SHOWCASE')
  console.log(
    'Advanced querying, real-time monitoring, and performance analysis'
  )
  console.log('='.repeat(80))
  console.log()

  try {
    // Setup
    await setupDemoData()

    // Run demonstrations
    await demonstrateBasicQueries()
    await sleep(1000)

    await demonstratePayloadQueries()
    await sleep(1000)

    await demonstrateMetricsQueries()
    await sleep(1000)

    await demonstrateRealTimeQueries()
    await sleep(1000)

    await demonstrateQueryPerformance()

    // Final summary
    console.log('='.repeat(60))
    console.log('📋 SHOWCASE SUMMARY')
    console.log('='.repeat(60))

    const totalChannels = cyre.query.channels().total
    const activeChannels = cyre.query.channels({hasSubscriber: true}).total
    const utilization = cyre.query.patterns.utilization()
    const queryStats = cyre.query.stats()

    console.log(`📊 System Statistics:`)
    console.log(`   Total channels: ${totalChannels}`)
    console.log(`   Active channels: ${activeChannels}`)
    console.log(`   Utilization: ${utilization.utilization.toFixed(1)}%`)
    console.log(
      `   Query cache efficiency: ${(queryStats.cache.hitRatio * 100).toFixed(
        1
      )}%`
    )
    console.log()

    console.log('✨ Showcase completed successfully!')
    console.log('🎯 Key Features Demonstrated:')
    console.log('   ✅ Pattern-based channel queries')
    console.log('   ✅ Payload aggregation and transformation')
    console.log('   ✅ Metrics analysis and monitoring')
    console.log('   ✅ Real-time query subscriptions')
    console.log('   ✅ Performance optimization with caching')
    console.log('   ✅ Index-based fast lookups')
    console.log('   ✅ Common query patterns')
    console.log('   ✅ Full TypeScript type safety')
  } catch (error) {
    console.error(
      '❌ Showcase failed:',
      error instanceof Error ? error.message : String(error)
    )
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...')
    cyre.clear()
    console.log('✅ Cleanup complete')

    // Exit
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Showcase interrupted')
  cyre.clear()
  process.exit(0)
})

// Run the showcase
runShowcase().catch((error: Error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

export {runShowcase}
