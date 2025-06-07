// demo/cyre-compose-cross-branch-test.ts
// Test cyreCompose with channels from main instance and different branches
// Demonstrates cross-branch composition capabilities with detailed logging

import {cyre, useCyre, cyreCompose, createBranch} from '../src'
import type {
  CyreComposedResponse,
  CompositionOptions
} from '../src/hooks/cyre-compose'
import type {ActionPayload, CyreResponse} from '../src/types/core'
import type {Branch} from '../src/types/branch'

/**
 * Test suite for cyreCompose cross-branch functionality
 * Tests multiple scenarios with detailed logging and performance metrics
 */

// ===========================================
// SCENARIO 1: Main Instance Channels
// ===========================================

/**
 * Create multiple channels on main cyre instance and compose them
 */
async function testMainInstanceComposition(): Promise<void> {
  console.log('\n🔧 SCENARIO 1: Main Instance Channel Composition')
  console.log('================================================')

  // Create channels on main instance
  const tempSensor = useCyre('temp-sensor', {
    action: (payload?: ActionPayload) => {
      const temperature = 20 + Math.random() * 10
      console.log(`🌡️  Temperature sensor: ${temperature.toFixed(1)}°C`)
      return {
        ok: true,
        payload: {temperature, unit: 'celsius', timestamp: Date.now()},
        message: `Temperature reading: ${temperature.toFixed(1)}°C`
      }
    }
  })

  const humiditySensor = useCyre('humidity-sensor', {
    action: (payload?: ActionPayload) => {
      const humidity = 40 + Math.random() * 30
      console.log(`💧 Humidity sensor: ${humidity.toFixed(1)}%`)
      return {
        ok: true,
        payload: {humidity, unit: 'percent', timestamp: Date.now()},
        message: `Humidity reading: ${humidity.toFixed(1)}%`
      }
    }
  })

  const pressureSensor = useCyre('pressure-sensor', {
    action: (payload?: ActionPayload) => {
      const pressure = 1013 + Math.random() * 50 - 25
      console.log(`📊 Pressure sensor: ${pressure.toFixed(1)} hPa`)
      return {
        ok: true,
        payload: {pressure, unit: 'hPa', timestamp: Date.now()},
        message: `Pressure reading: ${pressure.toFixed(1)} hPa`
      }
    }
  })

  console.log('✅ Created main instance channels:', {
    tempSensor: tempSensor.id,
    humiditySensor: humiditySensor.id,
    pressureSensor: pressureSensor.id
  })

  // Compose main instance channels
  const mainComposition = cyreCompose(
    [tempSensor, humiditySensor, pressureSensor],
    {
      id: 'main-environmental-sensors',
      debug: true,
      collectDetailedMetrics: true,
      timeout: 5000
    }
  )

  console.log('\n🔗 Executing main instance composition...')
  const mainResult = await mainComposition.call({
    trigger: 'environmental-check'
  })

  console.log('\n📊 Main Composition Results:')
  console.log('Overall result:', {
    ok: mainResult.ok,
    message: mainResult.message,
    executionTime: mainResult.metadata?.executionTime
  })

  if (Array.isArray(mainResult.payload)) {
    mainResult.payload.forEach(
      (result: CyreComposedResponse, index: number) => {
        console.log(`\n  Channel ${index + 1}:`, {
          channelId: result.channelId,
          channelName: result.channelName,
          executionOrder: result.executionOrder,
          ok: result.ok,
          message: result.message,
          timing: result.timing,
          payload: result.payload
        })
      }
    )
  }
}

// ===========================================
// SCENARIO 2: Cross-Branch Composition
// ===========================================

/**
 * Create branches and compose channels from different branches
 */
async function testCrossBranchComposition(): Promise<void> {
  console.log('\n🌳 SCENARIO 2: Cross-Branch Channel Composition')
  console.log('=================================================')

  // Create building-systems branch
  const buildingBranch = createBranch(cyre, {
    id: 'building-systems',
    pathSegment: 'building',
    maxDepth: 3
  })

  // Create vehicle-fleet branch
  const vehicleBranch = createBranch(cyre, {
    id: 'vehicle-fleet',
    pathSegment: 'vehicles',
    maxDepth: 3
  })

  console.log('✅ Created branches:', {
    building: {id: buildingBranch.id, path: buildingBranch.path},
    vehicle: {id: vehicleBranch.id, path: vehicleBranch.path}
  })

  // Create channels in building branch
  const hvacChannel = useCyre(
    'hvac-system',
    {
      action: (payload?: ActionPayload) => {
        const temp = 22 + Math.random() * 4
        const power = 800 + Math.random() * 400
        console.log(
          `🏢 HVAC System: ${temp.toFixed(1)}°C, ${power.toFixed(0)}W`
        )
        return {
          ok: true,
          payload: {
            systemType: 'hvac',
            temperature: temp,
            powerConsumption: power,
            efficiency: 0.85 + Math.random() * 0.1,
            timestamp: Date.now()
          },
          message: `HVAC running at ${temp.toFixed(1)}°C`
        }
      }
    },
    buildingBranch
  )

  const lightingChannel = useCyre(
    'lighting-system',
    {
      action: (payload?: ActionPayload) => {
        const brightness = 50 + Math.random() * 50
        const power = 200 + Math.random() * 100
        console.log(
          `💡 Lighting System: ${brightness.toFixed(0)}%, ${power.toFixed(0)}W`
        )
        return {
          ok: true,
          payload: {
            systemType: 'lighting',
            brightness: brightness,
            powerConsumption: power,
            zonesActive: Math.floor(Math.random() * 10) + 1,
            timestamp: Date.now()
          },
          message: `Lighting at ${brightness.toFixed(0)}% brightness`
        }
      }
    },
    buildingBranch
  )

  // Create channels in vehicle branch
  const busFleetChannel = useCyre(
    'bus-fleet',
    {
      action: (payload?: ActionPayload) => {
        const activeVehicles = Math.floor(Math.random() * 8) + 2
        const avgSpeed = 25 + Math.random() * 20
        console.log(
          `🚌 Bus Fleet: ${activeVehicles} vehicles, avg ${avgSpeed.toFixed(
            1
          )} km/h`
        )
        return {
          ok: true,
          payload: {
            fleetType: 'bus',
            activeVehicles: activeVehicles,
            averageSpeed: avgSpeed,
            fuelEfficiency: 12 + Math.random() * 3,
            routesActive: Math.floor(Math.random() * 6) + 1,
            timestamp: Date.now()
          },
          message: `${activeVehicles} buses active`
        }
      }
    },
    vehicleBranch
  )

  const deliveryFleetChannel = useCyre(
    'delivery-fleet',
    {
      action: (payload?: ActionPayload) => {
        const activeDeliveries = Math.floor(Math.random() * 15) + 5
        const avgDeliveryTime = 25 + Math.random() * 15
        console.log(
          `📦 Delivery Fleet: ${activeDeliveries} deliveries, ${avgDeliveryTime.toFixed(
            1
          )}min avg`
        )
        return {
          ok: true,
          payload: {
            fleetType: 'delivery',
            activeDeliveries: activeDeliveries,
            averageDeliveryTime: avgDeliveryTime,
            packagesInTransit: Math.floor(Math.random() * 50) + 20,
            efficiency: 0.75 + Math.random() * 0.2,
            timestamp: Date.now()
          },
          message: `${activeDeliveries} deliveries in progress`
        }
      }
    },
    vehicleBranch
  )

  console.log('\n✅ Created branch channels:', {
    building: [hvacChannel.id, lightingChannel.id],
    vehicle: [busFleetChannel.id, deliveryFleetChannel.id]
  })

  // Cross-branch composition
  const crossBranchComposition = cyreCompose(
    [hvacChannel, lightingChannel, busFleetChannel, deliveryFleetChannel],
    {
      id: 'smart-city-systems',
      debug: true,
      collectDetailedMetrics: true,
      continueOnError: true,
      timeout: 8000
    }
  )

  console.log('\n🔗 Executing cross-branch composition...')
  const crossResult = await crossBranchComposition.call({
    trigger: 'city-status-check',
    requestId: crypto.randomUUID()
  })

  console.log('\n📊 Cross-Branch Composition Results:')
  console.log('Overall result:', {
    ok: crossResult.ok,
    message: crossResult.message,
    executionTime: crossResult.metadata?.executionTime,
    source: crossResult.metadata?.source
  })

  if (Array.isArray(crossResult.payload)) {
    crossResult.payload.forEach(
      (result: CyreComposedResponse, index: number) => {
        const branchInfo = result.channelId.includes('/building/')
          ? '🏢 Building'
          : result.channelId.includes('/vehicles/')
          ? '🚗 Vehicle'
          : '🔧 Main'

        console.log(`\n  ${branchInfo} Channel ${index + 1}:`, {
          channelId: result.channelId,
          channelName: result.channelName,
          executionOrder: result.executionOrder,
          ok: result.ok,
          message: result.message,
          timing: result.timing,
          payload: result.payload
        })
      }
    )
  }
}

// ===========================================
// SCENARIO 3: Mixed Composition (Main + Branches)
// ===========================================

/**
 * Compose channels from main instance AND branches together
 */
async function testMixedComposition(): Promise<void> {
  console.log('\n🔀 SCENARIO 3: Mixed Main+Branch Composition')
  console.log('===============================================')

  // Create security branch
  const securityBranch = createBranch(cyre, {
    id: 'security-systems',
    pathSegment: 'security',
    maxDepth: 2
  })

  console.log('✅ Created security branch:', {
    id: securityBranch.id,
    path: securityBranch.path
  })

  // Main instance emergency channel
  const emergencyChannel = useCyre('emergency-dispatch', {
    action: (payload?: ActionPayload) => {
      const alertLevel = Math.floor(Math.random() * 5) + 1
      const responseTime = 3 + Math.random() * 7
      console.log(
        `🚨 Emergency Dispatch: Level ${alertLevel}, ${responseTime.toFixed(
          1
        )}min response`
      )
      return {
        ok: true,
        payload: {
          alertLevel: alertLevel,
          responseTime: responseTime,
          unitsAvailable: Math.floor(Math.random() * 10) + 5,
          activeIncidents: Math.floor(Math.random() * 3),
          timestamp: Date.now()
        },
        message: `Emergency level ${alertLevel} - ${responseTime.toFixed(
          1
        )}min response`
      }
    }
  })

  // Security branch camera system
  const cameraChannel = useCyre(
    'camera-network',
    {
      action: (payload?: ActionPayload) => {
        const activeCameras = Math.floor(Math.random() * 50) + 100
        const anomalies = Math.floor(Math.random() * 3)
        console.log(
          `📹 Camera Network: ${activeCameras} active, ${anomalies} anomalies`
        )
        return {
          ok: true,
          payload: {
            activeCameras: activeCameras,
            anomaliesDetected: anomalies,
            coverage: 0.85 + Math.random() * 0.1,
            aiAnalysisActive: true,
            timestamp: Date.now()
          },
          message: `${activeCameras} cameras monitoring`
        }
      }
    },
    securityBranch
  )

  // Security branch access control
  const accessChannel = useCyre(
    'access-control',
    {
      action: (payload?: ActionPayload) => {
        const accessAttempts = Math.floor(Math.random() * 20) + 10
        const deniedAccess = Math.floor(Math.random() * 3)
        console.log(
          `🔐 Access Control: ${accessAttempts} attempts, ${deniedAccess} denied`
        )
        return {
          ok: true,
          payload: {
            accessAttempts: accessAttempts,
            deniedAccess: deniedAccess,
            securityLevel: 'medium',
            badgeReaders: 45,
            timestamp: Date.now()
          },
          message: `${accessAttempts} access attempts processed`
        }
      }
    },
    securityBranch
  )

  console.log('\n✅ Created mixed channels:', {
    main: [emergencyChannel.id],
    security: [cameraChannel.id, accessChannel.id]
  })

  // Mixed composition: main + branch channels
  const mixedComposition = cyreCompose(
    [
      emergencyChannel, // Main instance
      cameraChannel, // Security branch
      accessChannel // Security branch
    ],
    {
      id: 'city-security-integration',
      debug: true,
      collectDetailedMetrics: true,
      continueOnError: true,
      priority: 'high'
    }
  )

  console.log('\n🔗 Executing mixed composition...')
  const mixedResult = await mixedComposition.call({
    trigger: 'security-status-check',
    priority: 'high',
    requestedBy: 'city-operations-center'
  })

  console.log('\n📊 Mixed Composition Results:')
  console.log('Overall result:', {
    ok: mixedResult.ok,
    message: mixedResult.message,
    executionTime: mixedResult.metadata?.executionTime,
    priority: mixedResult.metadata?.priority
  })

  if (Array.isArray(mixedResult.payload)) {
    mixedResult.payload.forEach(
      (result: CyreComposedResponse, index: number) => {
        const sourceType = result.channelId.includes('/security/')
          ? '🛡️  Security Branch'
          : '🔧 Main Instance'

        console.log(`\n  ${sourceType} Channel ${index + 1}:`, {
          channelId: result.channelId,
          channelName: result.channelName,
          executionOrder: result.executionOrder,
          ok: result.ok,
          message: result.message,
          timing: result.timing,
          originalError: result.originalError,
          payload: result.payload
        })
      }
    )
  }
}

// ===========================================
// SCENARIO 4: Error Handling Across Branches
// ===========================================

/**
 * Test error handling when channels from different branches fail
 */
async function testErrorHandlingAcrossBranches(): Promise<void> {
  console.log('\n⚠️  SCENARIO 4: Cross-Branch Error Handling')
  console.log('===========================================')

  // Create test branch
  const testBranch = createBranch(cyre, {
    id: 'error-test-branch',
    pathSegment: 'test-errors'
  })

  // Reliable main channel
  const reliableChannel = useCyre('reliable-main', {
    action: (payload?: ActionPayload) => {
      console.log('✅ Reliable channel executing successfully')
      return {
        ok: true,
        payload: {status: 'success', data: 'reliable-data'},
        message: 'Reliable channel executed'
      }
    }
  })

  // Failing branch channel
  const failingChannel = useCyre(
    'failing-branch',
    {
      action: (payload?: ActionPayload) => {
        console.log('❌ Failing channel simulating error')
        throw new Error('Simulated branch channel failure')
      }
    },
    testBranch
  )

  // Sometimes failing branch channel
  const unstableChannel = useCyre(
    'unstable-branch',
    {
      action: (payload?: ActionPayload) => {
        const shouldFail = Math.random() < 0.5
        if (shouldFail) {
          console.log('❌ Unstable channel failing')
          throw new Error('Random failure in unstable channel')
        } else {
          console.log('✅ Unstable channel succeeding')
          return {
            ok: true,
            payload: {status: 'success', attempt: Date.now()},
            message: 'Unstable channel succeeded this time'
          }
        }
      }
    },
    testBranch
  )

  console.log('\n✅ Created error test channels:', {
    main: [reliableChannel.id],
    testBranch: [failingChannel.id, unstableChannel.id]
  })

  // Error handling composition
  const errorTestComposition = cyreCompose(
    [reliableChannel, failingChannel, unstableChannel],
    {
      id: 'error-handling-test',
      debug: true,
      continueOnError: true, // Keep going despite errors
      collectDetailedMetrics: true
    }
  )

  console.log('\n🔗 Executing error handling test...')
  const errorResult = await errorTestComposition.call({
    trigger: 'error-resilience-test'
  })

  console.log('\n📊 Error Handling Results:')
  console.log('Overall result:', {
    ok: errorResult.ok,
    message: errorResult.message,
    executionTime: errorResult.metadata?.executionTime
  })

  if (Array.isArray(errorResult.payload)) {
    errorResult.payload.forEach(
      (result: CyreComposedResponse, index: number) => {
        const sourceType = result.channelId.includes('/test-errors/')
          ? '🧪 Test Branch'
          : '🔧 Main Instance'
        const status = result.ok ? '✅' : '❌'

        console.log(`\n  ${status} ${sourceType} Channel ${index + 1}:`, {
          channelId: result.channelId,
          channelName: result.channelName,
          executionOrder: result.executionOrder,
          ok: result.ok,
          message: result.message,
          skipped: result.skipped,
          originalError: result.originalError,
          timing: result.timing
        })
      }
    )
  }
}

// ===========================================
// MAIN TEST RUNNER
// ===========================================

/**
 * Run all cyreCompose cross-branch test scenarios
 */
export async function runCyreComposeCrossBranchTests(): Promise<void> {
  console.log('🚀 Starting cyreCompose Cross-Branch Tests')
  console.log('==========================================')

  const startTime = performance.now()

  try {
    // Run all scenarios
    await testMainInstanceComposition()
    await testCrossBranchComposition()
    await testMixedComposition()
    await testErrorHandlingAcrossBranches()

    const totalTime = performance.now() - startTime

    console.log('\n🎉 All Tests Completed Successfully!')
    console.log('===================================')
    console.log(`Total execution time: ${totalTime.toFixed(2)}ms`)

    // System state summary
    const systemHealth = cyre.getSystemHealth()
    const performanceState = cyre.getPerformanceState()

    console.log('\n📊 Final System State:')
    console.log('System Health:', systemHealth)
    console.log('Performance State:', {
      callRate: performanceState.callRate,
      totalCalls: performanceState.totalCalls,
      stress: `${Math.round(performanceState.stress * 100)}%`
    })
  } catch (error) {
    console.error('❌ Test execution failed:', error)
    throw error
  }
}

runCyreComposeCrossBranchTests().catch(console.error)
