// demo/smart-home.ts
// File location: Fixed pure functional demo with corrected issues

import {cyre} from '../src'

/*
  FIXED PURE FUNCTIONAL CYRE DEMONSTRATION
  
  Fixes identified issues:
  1. Remove sensor.warning calls (use sensor.warn)
  2. Fix curry function implementation
  3. Handle duplicate listeners properly
  4. Remove unsupported 'description' field
  5. Clean up function composition
*/

console.log('🧮 Fixed Functional Cyre Demo Starting...')

// ===========================================
// FIXED FUNCTIONAL UTILITIES
// ===========================================

/**
 * Fixed curry function implementation
 */
const curry =
  <A, B, C>(fn: (a: A, b: B) => C) =>
  (a: A) =>
  (b: B) =>
    fn(a, b)

/**
 * Fixed compose function
 */
const compose =
  <T>(...fns: Array<(arg: T) => T>) =>
  (value: T): T =>
    fns.reduceRight((acc, fn) => fn(acc), value)

/**
 * Fixed range validator with proper currying
 */
const createRangeValidator =
  (min: number, max: number) =>
  (n: number): boolean =>
    n >= min && n <= max

/**
 * Fixed validators without complex currying
 */
const createValidators = () => {
  const isPositive = (n: number) => n > 0
  const isEven = (n: number) => n % 2 === 0
  const isCelsiusRange = createRangeValidator(-50, 50)
  const isAboveAbsoluteZero = (n: number) => n + 273.15 > 0

  const validateTemperature = (temp: number): number => {
    if (!isCelsiusRange(temp)) {
      throw new Error('Temperature out of range (-50°C to 50°C)')
    }
    if (!isAboveAbsoluteZero(temp)) {
      throw new Error('Temperature below absolute zero')
    }
    return temp
  }

  return {validateTemperature, isPositive, isEven, isCelsiusRange}
}

/**
 * Functional error handling with Result types
 */
const Result = {
  ok: <T>(value: T) => ({success: true as const, value}),
  err: <E>(error: E) => ({success: false as const, error}),

  map: <T, U>(
    result: {success: boolean; value?: T; error?: any},
    fn: (value: T) => U
  ) => (result.success ? Result.ok(fn(result.value!)) : result),

  unwrapOr: <T>(result: {success: boolean; value?: T}, defaultValue: T): T =>
    result.success ? result.value! : defaultValue
}

// ===========================================
// PURE FUNCTIONAL DATA PROCESSORS
// ===========================================

/**
 * Message processor (pure function)
 */
const processMessage = (message: any) => ({
  ...message,
  processed: true,
  processedAt: Date.now(),
  wordCount: message.content.split(' ').length
})

/**
 * Sensor data aggregator (pure function)
 */
const aggregateSensorData = (readings: any[]) => {
  if (readings.length === 0) {
    return {
      count: 0,
      average: 0,
      min: 0,
      max: 0,
      timestamp: Date.now()
    }
  }

  const values = readings.map(r => r.value)
  return {
    count: readings.length,
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    timestamp: Date.now()
  }
}

/**
 * Alert condition checker (pure function)
 */
const checkAlertConditions = (data: any) => {
  const alerts = []

  if (data.unit === 'celsius' && data.value > 30) {
    alerts.push({
      type: 'temperature',
      severity: 'high',
      message: 'Temperature too high'
    })
  }

  if (data.unit === 'humidity' && data.value > 80) {
    alerts.push({
      type: 'humidity',
      severity: 'medium',
      message: 'Humidity too high'
    })
  }

  if (data.quality < 0.7) {
    alerts.push({
      type: 'quality',
      severity: 'low',
      message: 'Poor sensor quality'
    })
  }

  return alerts
}

/**
 * Apply pipeline to data (pure function)
 */
const applyPipeline = <T>(data: T, pipeline: Array<(data: any) => any>): any =>
  pipeline.reduce((acc, fn) => fn(acc), data)

/**
 * Safe sensor reading with functional error handling
 */
const safeSensorReading = (
  deviceId: string,
  value: number
): {success: boolean; value?: any; error?: string} => {
  try {
    const validators = createValidators()

    if (!deviceId || deviceId.length === 0) {
      return Result.err('Device ID is required')
    }

    if (typeof value !== 'number' || isNaN(value)) {
      return Result.err('Invalid sensor value')
    }

    const validatedValue = validators.validateTemperature(value)

    return Result.ok({
      deviceId,
      value: validatedValue,
      timestamp: Date.now(),
      status: 'valid'
    })
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ===========================================
// FUNCTIONAL PIPELINES
// ===========================================

/**
 * Message processing pipeline (functional composition)
 */
const createMessagePipeline = () => [
  processMessage,
  (msg: any) => ({...msg, sanitized: msg.content.replace(/<[^>]*>/g, '')}),
  (msg: any) => ({...msg, priority: msg.wordCount > 50 ? 'high' : 'normal'})
]

/**
 * Sensor data processing pipeline (functional composition)
 */
const createSensorPipeline = () => [
  (data: any) => ({...data, normalized: true}),
  (data: any) => ({...data, alerts: checkAlertConditions(data)}),
  (data: any) => ({
    ...data,
    status: data.alerts.length > 0 ? 'alert' : 'normal'
  })
]

// ===========================================
// FIXED EVENT HANDLERS
// ===========================================

/**
 * Create message handler (higher-order function)
 */
const createMessageHandler =
  (pipeline: Array<(data: any) => any>) => async (message: any) => {
    console.log(
      `💬 Message: ${message.from} → ${message.to}: "${message.content}"`
    )

    const processed = applyPipeline(message, pipeline)
    console.log(
      `  📊 Processed: ${processed.wordCount} words, priority: ${processed.priority}`
    )

    // Functional side effect handling
    if (processed.priority === 'high') {
      try {
        await cyre.call('high-priority-message', processed)
      } catch (error) {
        console.log(
          '  ⚠️ High priority channel not available (expected in demo)'
        )
      }
    }

    return processed
  }

/**
 * Create sensor handler (higher-order function)
 */
const createSensorHandler =
  (pipeline: Array<(data: any) => any>) => async (sensorData: any) => {
    console.log(
      `📊 Sensor: ${sensorData.deviceId} @ ${sensorData.location} = ${sensorData.value}${sensorData.unit}`
    )

    const processed = applyPipeline(sensorData, pipeline)
    console.log(
      `  🔄 Status: ${processed.status}, Quality: ${Math.round(
        processed.quality * 100
      )}%`
    )

    // Functional alert handling
    if (processed.alerts.length > 0) {
      for (const alert of processed.alerts) {
        try {
          await cyre.call('sensor-alert', {
            ...alert,
            source: sensorData.deviceId
          })
        } catch (error) {
          console.log('  ⚠️ Alert channel not available (expected in demo)')
        }
      }
    }

    return processed
  }

// ===========================================
// FIXED SYSTEM SETUP (HANDLE DUPLICATES)
// ===========================================

/**
 * Setup chat system (functional) - with duplicate handling
 */
const setupChatSystem = async () => {
  console.log('💬 Setting up functional chat system...')

  // Clear any existing channels first
  cyre.forget('send-message')
  cyre.forget('high-priority-message')

  const messagePipeline = createMessagePipeline()
  const messageHandler = createMessageHandler(messagePipeline)

  // Register actions without unsupported fields
  cyre.action({
    id: 'send-message',
    throttle: 1000
  })

  cyre.action({
    id: 'high-priority-message',

    priority: {level: 'high'}
  })

  // Register handlers
  cyre.on('send-message', messageHandler)

  cyre.on('high-priority-message', async message => {
    console.log(`🚨 HIGH PRIORITY: ${message.from} - ${message.content}`)
  })

  return {
    sendMessage: async (from: string, to: string, content: string) => {
      try {
        await cyre.call('send-message', {
          from,
          to,
          content,
          timestamp: Date.now(),
          type: 'text'
        })
      } catch (error) {
        console.log(`  ⚠️ Message throttled: ${error.message}`)
      }
    }
  }
}

/**
 * Setup sensor system (functional) - with duplicate handling
 */
const setupSensorSystem = async () => {
  console.log('📊 Setting up functional sensor system...')

  // Clear existing channels
  cyre.forget('sensor-reading')
  cyre.forget('sensor-alert')
  cyre.forget('sensor-aggregation')

  const sensorPipeline = createSensorPipeline()
  const sensorHandler = createSensorHandler(sensorPipeline)

  // Create aggregation handler
  const dataBuffer: any[] = []
  const aggregationHandler = async (newData: any) => {
    dataBuffer.push(newData)
    if (dataBuffer.length > 5) dataBuffer.shift() // Keep only last 5

    if (dataBuffer.length >= 3) {
      const aggregated = aggregateSensorData(dataBuffer)
      console.log(
        `📈 Aggregated (${
          dataBuffer.length
        } samples): avg=${aggregated.average.toFixed(2)}`
      )

      try {
        await cyre.call('sensor-aggregation', aggregated)
      } catch (error) {
        // Expected if channel not ready
      }
    }
  }

  // Register actions
  cyre.action({
    id: 'sensor-reading',
    debounce: 2000
  })

  cyre.action({
    id: 'sensor-alert',

    priority: {level: 'high'}
  })

  cyre.action({
    id: 'sensor-aggregation'
  })

  // Register handlers
  cyre.on('sensor-reading', async data => {
    const processed = await sensorHandler(data)
    await aggregationHandler(processed)
  })

  cyre.on('sensor-alert', async alert => {
    console.log(
      `🚨 SENSOR ALERT: ${alert.type} - ${alert.message} (${alert.severity})`
    )
  })

  cyre.on('sensor-aggregation', async data => {
    console.log(
      `📈 Aggregation: avg=${data.average.toFixed(2)}, range=${data.min}-${
        data.max
      }`
    )
  })

  return {
    recordReading: async (
      deviceId: string,
      location: string,
      value: number,
      unit: string
    ) => {
      try {
        await cyre.call('sensor-reading', {
          deviceId,
          location,
          value,
          unit,
          timestamp: Date.now(),
          quality: 0.8 + Math.random() * 0.2
        })
      } catch (error) {
        console.log(`  ⚠️ Sensor reading debounced: ${error.message}`)
      }
    }
  }
}

/**
 * Setup analytics system (functional) - with duplicate handling
 */
const setupAnalyticsSystem = async () => {
  console.log('📈 Setting up functional analytics...')

  // Clear existing
  cyre.forget('analytics-report')

  // Functional data store
  const dataStore = {
    messages: [] as any[],
    sensors: [] as any[]
  }

  // Analytics processors
  const analyzeMessages = (messages: any[]) => ({
    totalMessages: messages.length,
    averageWordCount:
      messages.length > 0
        ? messages.reduce((sum, m) => sum + (m.wordCount || 0), 0) /
          messages.length
        : 0,
    activeUsers: new Set(messages.map(m => m.from)).size
  })

  const analyzeSensors = (readings: any[]) => ({
    totalReadings: readings.length,
    deviceCount: new Set(readings.map(r => r.deviceId)).size,
    locationCount: new Set(readings.map(r => r.location)).size,
    averageQuality:
      readings.length > 0
        ? readings.reduce((sum, r) => sum + (r.quality || 0), 0) /
          readings.length
        : 0
  })

  // Data collectors
  const collectMessage = (message: any) => {
    dataStore.messages = [...dataStore.messages, message].slice(-50)
  }

  const collectSensorData = (data: any) => {
    dataStore.sensors = [...dataStore.sensors, data].slice(-50)
  }

  // Analytics action
  cyre.action({
    id: 'analytics-report'
  })

  cyre.on('analytics-report', async () => {
    console.log('📊 Analytics Report:')

    if (dataStore.messages.length > 0) {
      const messageAnalytics = analyzeMessages(dataStore.messages)
      console.log(
        `  💬 Messages: ${messageAnalytics.totalMessages}, ` +
          `Avg words: ${messageAnalytics.averageWordCount.toFixed(1)}, ` +
          `Active users: ${messageAnalytics.activeUsers}`
      )
    }

    if (dataStore.sensors.length > 0) {
      const sensorAnalytics = analyzeSensors(dataStore.sensors)
      console.log(
        `  📊 Sensors: ${sensorAnalytics.totalReadings} readings, ` +
          `${sensorAnalytics.deviceCount} devices, ` +
          `Quality: ${Math.round(sensorAnalytics.averageQuality * 100)}%`
      )
    }
  })

  // Listen to data (avoiding duplicates by not re-registering if already exists)
  try {
    cyre.on('send-message', collectMessage)
  } catch (error) {
    // Already registered, skip
  }

  try {
    cyre.on('sensor-reading', collectSensorData)
  } catch (error) {
    // Already registered, skip
  }

  return {
    generateReport: async () => {
      await cyre.call('analytics-report')
    },
    getStats: () => ({
      messageCount: dataStore.messages.length,
      sensorCount: dataStore.sensors.length
    })
  }
}

// ===========================================
// FIXED DEMO EXECUTION
// ===========================================

/**
 * Run functional demo (fixed)
 */
const runFunctionalDemo = async () => {
  console.log('\n🧮 Starting Fixed Functional Cyre Demo...\n')

  try {
    // Initialize Cyre
    await cyre.init()

    // Setup systems functionally
    const chat = await setupChatSystem()
    const sensors = await setupSensorSystem()
    const analytics = await setupAnalyticsSystem()

    console.log('\n📋 Running demo scenarios...\n')

    // Demo 1: Functional message processing
    console.log('💬 Demo 1: Functional Message Processing')
    await chat.sendMessage('Alice', 'Bob', 'Hello there!')
    await chat.sendMessage(
      'Bob',
      'Alice',
      'Hi! This is a longer message with many words to trigger high priority processing and show the throttling mechanism.'
    )
    await chat.sendMessage('Charlie', 'Everyone', 'Short msg')

    await wait(1000)

    // Demo 2: Functional sensor processing with validation
    console.log('\n📊 Demo 2: Functional Sensor Processing')

    // Valid readings
    await sensors.recordReading('temp-001', 'living-room', 22.5, 'celsius')
    await sensors.recordReading('temp-001', 'living-room', 35.0, 'celsius') // Will trigger alert
    await sensors.recordReading('humidity-001', 'bathroom', 85, 'humidity') // Will trigger alert

    // Test functional error handling
    const safeResult1 = safeSensorReading('temp-002', 25.0)
    const safeResult2 = safeSensorReading('', 25.0) // Invalid device ID
    const safeResult3 = safeSensorReading('temp-003', NaN) // Invalid value

    console.log('🛡️  Safe sensor results:')
    console.log(
      `  Valid: ${safeResult1.success ? '✅' : '❌'} ${
        safeResult1.success ? safeResult1.value?.deviceId : safeResult1.error
      }`
    )
    console.log(
      `  Invalid ID: ${safeResult2.success ? '✅' : '❌'} ${safeResult2.error}`
    )
    console.log(
      `  Invalid value: ${safeResult3.success ? '✅' : '❌'} ${
        safeResult3.error
      }`
    )

    await wait(2000)

    // Demo 3: Fixed functional composition patterns
    console.log('\n🔄 Demo 3: Fixed Functional Composition')

    const validators = createValidators()
    const numbers = [25, -10, 100, 4, 7]

    console.log('🔢 Number validation:')
    numbers.forEach(n => {
      try {
        const result = validators.validateTemperature(n)
        console.log(`  ${n}°C: ✅ Valid`)
      } catch (error) {
        console.log(`  ${n}°C: ❌ ${error.message}`)
      }
    })

    // Demo 4: Analytics report
    console.log('\n📈 Demo 4: Functional Analytics')
    await analytics.generateReport()

    const stats = analytics.getStats()
    console.log(
      `📊 Data collected: ${stats.messageCount} messages, ${stats.sensorCount} sensor readings`
    )

    console.log('\n🎉 Fixed functional demo completed successfully!')
    console.log('\n🎯 Key functional patterns demonstrated:')
    console.log('  ✅ Pure functions for data processing')
    console.log('  ✅ Fixed function composition and pipelines')
    console.log('  ✅ Higher-order functions for handlers')
    console.log('  ✅ Immutable data structures')
    console.log('  ✅ Fixed functional error handling with Result types')
    console.log('  ✅ Proper duplicate handling')
    console.log('  ✅ Schema validation without unsupported fields')
  } catch (error) {
    console.error('❌ Demo error:', error)
  }
}

/**
 * Utility wait function (pure)
 */
const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Create interactive commands (fixed)
 */
const createFunctionalCommands = (chat: any, sensors: any, analytics: any) => ({
  // Simple message sending (no complex currying)
  sendMessage: (from: string, to: string, content: string) =>
    chat.sendMessage(from, to, content),

  // Sensor recording with validation
  recordSensor: (
    deviceId: string,
    location: string,
    value: number,
    unit: string
  ) => {
    const result = safeSensorReading(deviceId, value)
    if (result.success) {
      return sensors.recordReading(deviceId, location, value, unit)
    } else {
      console.error(`❌ Sensor validation failed: ${result.error}`)
      return Promise.reject(new Error(result.error))
    }
  },

  // Analytics
  report: analytics.generateReport,
  stats: analytics.getStats,

  // Composition examples (simplified)
  compose: {
    // Simple message processor
    processMessage: (content: string) => {
      const pipeline = createMessagePipeline()
      return applyPipeline(
        {
          content,
          from: 'test',
          to: 'test',
          timestamp: Date.now(),
          type: 'text'
        },
        pipeline
      )
    },

    // Simple sensor processor
    processSensor: (deviceId: string, value: number) => {
      const pipeline = createSensorPipeline()
      return applyPipeline(
        {
          deviceId,
          value,
          unit: 'celsius',
          location: 'test',
          timestamp: Date.now(),
          quality: 0.9
        },
        pipeline
      )
    }
  }
})

// ===========================================
// MAIN EXECUTION
// ===========================================

const main = async () => {
  try {
    await runFunctionalDemo()

    // Create interactive commands for testing
    const chat = await setupChatSystem()
    const sensors = await setupSensorSystem()
    const analytics = await setupAnalyticsSystem()

    const commands = createFunctionalCommands(chat, sensors, analytics)

    // Make available globally for interactive testing
    ;(global as any).cyreDemo = commands

    console.log('\n🎮 Interactive Commands Available:')
    console.log('- cyreDemo.sendMessage("Alice", "Bob", "Hello!")')
    console.log(
      '- cyreDemo.recordSensor("temp-123", "kitchen", 25.5, "celsius")'
    )
    console.log('- cyreDemo.report()')
    console.log('- cyreDemo.stats()')
    console.log('- cyreDemo.compose.processMessage("This is a test message")')
    console.log('\n')
  } catch (error) {
    console.error('❌ Main execution failed:', error)
    process.exit(1)
  }
}

// Auto-run if this file is executed directly

main()
