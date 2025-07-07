// example/cyre-hooks.ts

import {useCyre, cyre} from '../src'

// Simple database record types
interface SensorReading {
  deviceId: string
  temperature: number
  humidity: number
  timestamp: number
}

interface ProcessedReading extends SensorReading {
  dewPoint: number
  heatIndex: number
  processedAt: number
}

/**
 * Example: IoT Sensor Processing Service with Cyre 4.0
 *
 * This demonstrates a practical use of Cyre hooks for handling IoT sensor data
 * with appropriate protection against data floods and proper handling of the
 * timing characteristics of Cyre 4.0
 */
const main = async () => {
  console.log('Starting Cyre 4.0 IoT Sensor Processing Service')

  // In-memory database for our example
  const database: ProcessedReading[] = []

  // Create a Cyre hook for sensor data processing
  const sensorChannel = useCyre<SensorReading>(cyre, {
    name: 'sensorProcessor',
    debug: true,
    protection: {
      // Only process if data has truly changed
      detectChanges: true,
      // Group readings coming in bursts (common in IoT)
      debounce: 150
    },
    priority: {level: 'high'}
  })

  console.log(`Sensor processing channel created: ${sensorChannel.id}`)

  // Add data validation and enrichment middleware

  // Subscribe to sensor data processing
  sensorChannel.on(reading => {
    if (!reading) return {error: 'Empty reading'}

    console.log(
      `Processing reading from device ${reading.deviceId}: ${reading.temperature}°C, ${reading.humidity}%`
    )

    // Calculate derived metrics
    const dewPoint = calculateDewPoint(reading.temperature, reading.humidity)
    const heatIndex = calculateHeatIndex(reading.temperature, reading.humidity)

    // Store in database
    const processedReading: ProcessedReading = {
      ...reading,
      dewPoint,
      heatIndex,
      processedAt: Date.now()
    }

    database.push(processedReading)

    return {
      success: true,
      readingId: `${reading.deviceId}-${reading.timestamp}`,
      processedAt: processedReading.processedAt
    }
  })

  // Demonstrating Cyre 4.0 behavior with practical examples

  // Example 1: Understanding initial throttling
  console.log('\n--- Example 1: Initial Throttling Behavior ---')
  console.log(
    'Note: In Cyre 4.0, throttle protection is active from channel creation'
  )

  const reading1 = createReading('device001', 22.5, 45.2)
  console.log(`Sending initial reading from ${reading1.deviceId}`)

  const result1 = await sensorChannel.call(reading1)
  console.log('Initial reading result:', result1)

  if (!result1.ok) {
    console.log(
      '💡 Expected behavior: First call was throttled. Waiting for throttle to expire...'
    )
    await new Promise(resolve => setTimeout(resolve, 250))

    // Try again after throttle period
    console.log('Sending reading again after throttle period')
    const retryResult = await sensorChannel.call(reading1)
    console.log('Retry result:', retryResult)
  }

  // Example 2: Working with debounce protection
  console.log('\n--- Example 2: Debounce Protection Pattern ---')
  console.log('Demonstrating the best approach to handle debounce')

  // Wait to ensure no throttling from previous calls
  await new Promise(resolve => setTimeout(resolve, 250))

  // Send a sequence of updates (simulating a device sending burst readings)
  console.log('Sending 3 readings in rapid succession from device002')

  // Create array of readings with slightly different values
  const burstReadings = [
    createReading('device002', 23.1, 48.5),
    createReading('device002', 23.2, 48.7),
    createReading('device002', 23.3, 48.9)
  ]

  // Send all readings in sequence but without awaiting them individually
  const promises = burstReadings.map(reading => {
    const promise = sensorChannel.call(reading)
    return promise
  })

  // Wait for all operations to complete
  const burstResults = await Promise.all(promises)

  // Check results
  console.log('Burst readings results:')
  burstResults.forEach((result, i) => {
    console.log(
      `- Reading ${i + 1}: ${result.ok ? 'Accepted' : 'Rejected'} - ${
        result.message
      }`
    )
  })

  // Wait for debounce processing
  console.log('Waiting for debounce processing to complete...')
  await new Promise(resolve => setTimeout(resolve, 200))

  // Example 3: Invalid reading rejection
  console.log('\n--- Example 3: Invalid Reading Handling ---')

  const invalidReading = {
    deviceId: 'device003',
    temperature: 150, // Physically impossible
    humidity: 30,
    timestamp: Date.now()
  }

  console.log(
    `Sending invalid reading with temperature: ${invalidReading.temperature}°C`
  )
  const invalidResult = await sensorChannel.call(invalidReading)
  console.log('Invalid reading result:', invalidResult)

  // Example 4: Accessing database
  await new Promise(resolve => setTimeout(resolve, 250))

  console.log('\n--- Example 4: Database Results ---')
  console.log(`Database contains ${database.length} processed readings:`)

  database.forEach((record, i) => {
    console.log(
      `${i + 1}. Device: ${record.deviceId}, Temp: ${
        record.temperature
      }°C, Humidity: ${record.humidity}%, ` +
        `Dew Point: ${record.dewPoint.toFixed(
          1
        )}°C, Heat Index: ${record.heatIndex.toFixed(1)}°C`
    )
  })

  // Example 5: Check metrics
  console.log('\n--- Example 5: Channel Metrics ---')

  // Clean up
  console.log('\n--- Cleaning up ---')
  sensorChannel.forget()
  console.log('Service shut down')

  // Exit after everything is done
  setTimeout(() => process.exit(0), 100)
}

// Helper functions

function createReading(
  deviceId: string,
  temperature: number,
  humidity: number
): SensorReading {
  return {
    deviceId,
    temperature,
    humidity,
    timestamp: Date.now()
  }
}

function calculateDewPoint(temperature: number, humidity: number): number {
  // Simple dew point calculation
  const a = 17.27
  const b = 237.7
  const alpha = (a * temperature) / (b + temperature) + Math.log(humidity / 100)
  return (b * alpha) / (a - alpha)
}

function calculateHeatIndex(temperature: number, humidity: number): number {
  // Simplified heat index calculation
  return temperature + 0.05 * humidity
}

// Run the example
main().catch(error => {
  console.error('Error in Cyre IoT example:', error)
  process.exit(1)
})
