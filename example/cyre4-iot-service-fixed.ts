// src/examples/working-iot-direct-api.ts

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
 * FIXED: IoT Sensor Processing Service with useCyre Hook
 *
 * This version uses the corrected useCyre hook that properly integrates
 * with the core CYRE middleware system
 */
const main = async () => {
  console.log('Starting FIXED IoT Sensor Processing Service (useCyre Hook)')

  // In-memory database for our example
  const database: ProcessedReading[] = []

  // Create a Cyre hook for sensor data processing
  const sensorChannel = useCyre<SensorReading>({
    name: 'sensorProcessor',
    debug: true,
    protection: {
      // Only process if data has truly changed
      detectChanges: true,
      // Group readings coming in bursts (common in IoT)
      debounce: 50,
      // Allow at most one reading per 100ms per device
      throttle: 100
    },
    priority: {level: 'high'}
  })

  console.log(`Sensor processing channel created: ${sensorChannel.id}`)

  // FIXED: Add data validation and enrichment middleware using the corrected approach
  sensorChannel.middleware(async (reading, next) => {
    console.log(
      `[MIDDLEWARE] Validating reading from device ${reading.deviceId}`
    )

    // Validate readings
    if (
      !reading.deviceId ||
      reading.temperature === undefined ||
      reading.humidity === undefined
    ) {
      console.log('[MIDDLEWARE] Validation failed: Missing required fields')
      return {
        ok: false,
        payload: null,
        message: 'Invalid reading: Missing required fields'
      }
    }

    // Check for physically impossible values
    if (
      reading.temperature < -100 ||
      reading.temperature > 100 ||
      reading.humidity < 0 ||
      reading.humidity > 100
    ) {
      console.log('[MIDDLEWARE] Validation failed: Values out of bounds')
      return {
        ok: false,
        payload: null,
        message: 'Invalid reading: Values out of physical bounds'
      }
    }

    // Add timestamp if missing
    const processedReading = {
      ...reading,
      timestamp: reading.timestamp || Date.now()
    }

    console.log('[MIDDLEWARE] Validation passed, calling next')

    // Call next with the processed payload
    const result = await next(processedReading)

    // Return the result from next
    return result
  })

  // Subscribe to sensor data processing
  const subscription = sensorChannel.on(async reading => {
    if (!reading) {
      console.log('[HANDLER] Error: Empty reading')
      return {error: 'Empty reading'}
    }

    console.log(
      `[HANDLER] Processing reading from device ${reading.deviceId}: ${reading.temperature}°C, ${reading.humidity}%`
    )

    try {
      // Calculate derived metrics
      const dewPoint = calculateDewPoint(reading.temperature, reading.humidity)
      const heatIndex = calculateHeatIndex(
        reading.temperature,
        reading.humidity
      )

      // Store in database
      const processedReading: ProcessedReading = {
        ...reading,
        dewPoint,
        heatIndex,
        processedAt: Date.now()
      }

      database.push(processedReading)

      console.log(
        `[HANDLER] Successfully stored reading. Database now has ${database.length} entries`
      )

      return {
        success: true,
        readingId: `${reading.deviceId}-${reading.timestamp}`,
        processedAt: processedReading.processedAt
      }
    } catch (error) {
      console.error('[HANDLER] Processing error:', error)
      return {error: 'Processing failed'}
    }
  })

  // Wait a moment for initialization
  await new Promise(resolve => setTimeout(resolve, 100))

  // Test 1: Valid reading
  console.log('\n--- Test 1: Valid Reading ---')
  const reading1 = createReading('device001', 22.5, 45.2)
  console.log(`Sending valid reading from ${reading1.deviceId}`)
  const result1 = await sensorChannel.call(reading1)
  console.log('Result:', result1)

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 100))

  // Test 2: Invalid reading (out of bounds)
  console.log('\n--- Test 2: Invalid Reading ---')
  const invalidReading = createReading('device002', 150, 30) // Temperature too high
  console.log(
    `Sending invalid reading with temperature: ${invalidReading.temperature}°C`
  )
  const result2 = await sensorChannel.call(invalidReading)
  console.log('Result:', result2)

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 100))

  // Test 3: Another valid reading
  console.log('\n--- Test 3: Another Valid Reading ---')
  const reading3 = createReading('device003', 25.0, 55.0)
  console.log(`Sending valid reading from ${reading3.deviceId}`)
  const result3 = await sensorChannel.call(reading3)
  console.log('Result:', result3)

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 100))

  // Test 4: Duplicate reading (should be filtered by change detection)
  console.log('\n--- Test 4: Duplicate Reading (Change Detection) ---')
  console.log(`Sending same reading again from ${reading3.deviceId}`)
  const result4 = await sensorChannel.call(reading3)
  console.log('Result:', result4)

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 100))

  // Test 5: Rapid burst (throttle test)
  console.log('\n--- Test 5: Rapid Burst (Throttle Test) ---')
  const burstResults = []
  for (let i = 0; i < 3; i++) {
    const reading = createReading('device004', 20 + i, 50 + i)
    console.log(`Sending burst reading ${i + 1}`)
    const result = await sensorChannel.call(reading)
    burstResults.push(result)
    console.log(
      `Burst ${i + 1} result:`,
      result.ok ? 'Accepted' : `Rejected: ${result.message}`
    )
  }

  // Wait for any debounced processing
  await new Promise(resolve => setTimeout(resolve, 100))

  // Show final results
  console.log('\n--- Final Results ---')
  console.log(`Database contains ${database.length} processed readings:`)

  if (database.length > 0) {
    database.forEach((record, i) => {
      console.log(
        `${i + 1}. Device: ${record.deviceId}, Temp: ${
          record.temperature
        }°C, ` +
          `Humidity: ${record.humidity}%, Dew Point: ${record.dewPoint.toFixed(
            1
          )}°C, ` +
          `Heat Index: ${record.heatIndex.toFixed(1)}°C`
      )
    })
  } else {
    console.log('❌ No readings were processed')
  }

  // Check metrics and history using the hook
  console.log('\n--- Hook Metrics and History ---')
  const metrics = sensorChannel.metrics()
  console.log(`Channel active formations: ${metrics.activeFormations}`)
  console.log(`System stress: ${metrics.breathing.stress.toFixed(3)}`)

  const history = sensorChannel.getHistory()
  console.log(`Processing history: ${history.length} entries`)
  if (history.length > 0) {
    console.log('Recent operations:')
    history.slice(0, 5).forEach((entry, i) => {
      console.log(
        `${i + 1}. Device: ${entry.payload.deviceId}, Success: ${
          entry.response.ok
        }`
      )
    })
  }

  // Clean up
  console.log('\n--- Cleaning up ---')
  subscription.unsubscribe()
  sensorChannel.forget()
  console.log('Service shut down')

  // Summary
  console.log('\n--- SUMMARY ---')
  console.log(`✅ Total readings processed: ${database.length}`)
  console.log(`✅ Total operations in history: ${history.length}`)
  console.log(
    `✅ Hook-based service completed ${
      database.length > 0 ? 'successfully' : 'with issues'
    }`
  )

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
  // Magnus formula for dew point calculation
  const a = 17.27
  const b = 237.7
  const alpha = (a * temperature) / (b + temperature) + Math.log(humidity / 100)
  return (b * alpha) / (a - alpha)
}

function calculateHeatIndex(temperature: number, humidity: number): number {
  // Simplified heat index calculation for moderate temperatures
  if (temperature < 27) return temperature

  // Basic heat index approximation
  return (
    temperature +
    0.5 * (temperature + 61.0 + (temperature - 68.0) * 1.2 + humidity * 0.094)
  )
}

// Run the fixed hook example
main().catch(error => {
  console.error('Error in FIXED Hook IoT example:', error)
  process.exit(1)
})
