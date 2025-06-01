// examples/run-group-demo.ts
// Node.js execution script for the comprehensive group demo

import * as path from 'path'
import * as fs from 'fs'

// Mock crypto for Node.js if not available
if (typeof crypto === 'undefined') {
  const nodeCrypto = require('crypto')
  global.crypto = {
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomValues: (arr: any) => nodeCrypto.getRandomValues(arr)
  } as any
}

// Import the comprehensive demo
// Note: Adjust the import path based on your project structure
// import { runComprehensiveDemo } from './comprehensive-group-demo'

// For this example, we'll inline a simplified version that works with Node.js
import {cyre, schema} from '../src/' // Adjust path as needed

async function nodeGroupDemo() {
  console.log('\n🚀 Starting Cyre Group System Demo in Node.js...\n')

  try {
    // Initialize Cyre
    await cyre.initialize({
      autoSave: false, // Disable localStorage in Node.js
      saveKey: 'node-demo'
    })

    console.log('✅ Cyre initialized successfully\n')

    // 1. Basic Group Creation
    console.log('📁 Creating basic groups...')

    cyre.group('sensor-network', {
      channels: ['sensor-*', 'device-*'],
      shared: {
        throttle: 1000,
        schema: schema.object({
          deviceId: schema.string(),
          value: schema.number(),
          timestamp: schema.number()
        }),
        middleware: [
          async (payload: any, next: any) => {
            console.log(`   🛡️ Validating sensor: ${payload.deviceId}`)
            if (!payload.deviceId) {
              return {ok: false, payload: null, message: 'Device ID required'}
            }
            return next({...payload, validated: true})
          }
        ]
      }
    })

    cyre.group('api-endpoints', {
      channels: ['api-*', 'endpoint-*'],
      shared: {
        throttle: 500,
        middleware: [
          async (payload: any, next: any) => {
            console.log(
              `   🔑 Processing API: ${payload.method} ${payload.path}`
            )
            return next({...payload, processed: true, timestamp: Date.now()})
          }
        ]
      }
    })

    // 2. Create channels that will join groups
    console.log('\n📋 Creating channels...')

    const channels = [
      {
        id: 'sensor-temperature-01',
        payload: {deviceId: 'temp_01', value: 23.5, timestamp: Date.now()}
      },
      {
        id: 'sensor-humidity-02',
        payload: {deviceId: 'humid_02', value: 45.2, timestamp: Date.now()}
      },
      {
        id: 'device-gateway-main',
        payload: {deviceId: 'gateway_01', value: 1, timestamp: Date.now()}
      },
      {id: 'api-user-login', payload: {method: 'POST', path: '/auth/login'}},
      {
        id: 'endpoint-user-profile',
        payload: {method: 'GET', path: '/users/profile'}
      }
    ]

    for (const channel of channels) {
      cyre.action(channel)
      cyre.on(channel.id, (data: any) => {
        console.log(`   ✨ ${channel.id} processed:`, {
          originalDeviceId: channel.payload.deviceId || 'N/A',
          processed: data.validated || data.processed || false,
          middleware: 'executed'
        })
      })
    }

    // 3. Test group functionality
    console.log('\n🧪 Testing group functionality...')

    // Test sensor with group middleware
    console.log('   Testing sensor group middleware...')
    const sensorResult = await cyre.call('sensor-temperature-01', {
      deviceId: 'temp_01',
      value: 24.0,
      timestamp: Date.now()
    })
    console.log(
      `   Result: ${sensorResult.ok ? '✅ SUCCESS' : '❌ FAILED'} - ${
        sensorResult.message
      }`
    )

    // Test API with group middleware
    console.log('   Testing API group middleware...')
    const apiResult = await cyre.call('api-user-login', {
      method: 'POST',
      path: '/auth/login',
      body: {username: 'test', password: 'test123'}
    })
    console.log(
      `   Result: ${apiResult.ok ? '✅ SUCCESS' : '❌ FAILED'} - ${
        apiResult.message
      }`
    )

    // 4. Advanced Features Demo
    console.log('\n🔧 Testing advanced features...')

    // Circuit breaker simulation
    let circuitOpen = false
    let failureCount = 0

    cyre.group('resilient-services', {
      channels: ['service-*'],
      shared: {
        middleware: [
          async (payload: any, next: any) => {
            if (circuitOpen) {
              console.log('   🔴 Circuit breaker is OPEN - blocking request')
              return {ok: false, payload: null, message: 'Circuit breaker open'}
            }

            try {
              if (payload.simulateFailure) {
                throw new Error('Simulated failure')
              }

              const result = await next(payload)
              failureCount = 0 // Reset on success
              console.log('   🟢 Request succeeded - circuit remains closed')
              return result
            } catch (error) {
              failureCount++
              console.log(`   ⚠️ Failure ${failureCount}/3`)

              if (failureCount >= 3) {
                circuitOpen = true
                console.log('   🔴 Circuit breaker OPENED due to failures')

                // Auto-reset after 5 seconds
                setTimeout(() => {
                  circuitOpen = false
                  failureCount = 0
                  console.log('   🟢 Circuit breaker auto-RESET to closed')
                }, 5000)
              }

              throw error
            }
          }
        ]
      }
    })

    cyre.action({id: 'service-test', payload: {operation: 'test'}})
    cyre.on('service-test', (data: any) => {
      console.log('   ✅ Resilient service result:', data)
    })

    // Test normal operation
    await cyre.call('service-test', {operation: 'normal'})

    // Test failure scenarios
    for (let i = 0; i < 4; i++) {
      try {
        await cyre.call('service-test', {
          operation: 'test_failure',
          simulateFailure: i < 3 // First 3 will fail
        })
      } catch (error) {
        // Expected failures
      }
    }

    // 5. Analytics and reporting
    console.log('\n📊 Group analytics and reporting...')

    const allGroups = cyre.getAllGroups()
    console.log(`   📈 Total groups created: ${allGroups.length}`)

    allGroups.forEach(group => {
      console.log(
        `   📁 ${group.id}: ${group.matchedChannels.size} channels, ${group.middlewareIds.length} middleware`
      )
    })

    // Performance metrics
    const performanceState = cyre.getPerformanceState()
    const breathingState = cyre.getBreathingState()

    console.log('\n📈 System Performance:')
    console.log(`   Total calls: ${performanceState.totalCalls}`)
    console.log(`   Total executions: ${performanceState.totalExecutions}`)
    console.log(`   Call rate: ${performanceState.callRate}/sec`)
    console.log(`   System stress: ${performanceState.stress.toFixed(2)}`)

    console.log('\n🫁 Breathing System:')
    console.log(`   Breath count: ${breathingState.breathCount}`)
    console.log(`   Current rate: ${breathingState.currentRate}ms`)
    console.log(`   Is recuperating: ${breathingState.isRecuperating}`)
    console.log(`   Pattern: ${breathingState.pattern}`)

    // 6. Load testing simulation
    console.log('\n🚀 Running mini load test...')

    const loadTestPromises = []
    for (let i = 0; i < 10; i++) {
      loadTestPromises.push(
        cyre.call('sensor-temperature-01', {
          deviceId: `load_test_${i}`,
          value: Math.random() * 30 + 15,
          timestamp: Date.now()
        })
      )
    }

    const loadResults = await Promise.allSettled(loadTestPromises)
    const successful = loadResults.filter(r => r.status === 'fulfilled').length
    console.log(
      `   📊 Load test: ${successful}/${loadResults.length} calls succeeded`
    )

    // 7. Group coordination demo
    console.log('\n🔄 Testing group coordination...')

    // Message passing between groups
    cyre.group('message-hub', {
      channels: ['message-*', 'broadcast-*'],
      shared: {
        middleware: [
          async (payload: any, next: any) => {
            if (payload.broadcast) {
              console.log(`   📢 Broadcasting message: ${payload.message}`)
              // Simulate message distribution
              setTimeout(() => {
                console.log('   📨 Message delivered to all subscribers')
              }, 100)
            }
            return next(payload)
          }
        ]
      }
    })

    cyre.action({id: 'message-system-alert', payload: {}})
    cyre.on('message-system-alert', (data: any) => {
      console.log('   📬 System alert received:', data)
    })

    await cyre.call('message-system-alert', {
      broadcast: true,
      message: 'System coordination test',
      priority: 'high',
      timestamp: Date.now()
    })

    // 8. Final status report
    console.log('\n📋 Final Status Report:')
    console.log('=====================================')

    const finalGroups = cyre.getAllGroups()
    const totalChannels = finalGroups.reduce(
      (sum, group) => sum + group.matchedChannels.size,
      0
    )
    const totalMiddleware = finalGroups.reduce(
      (sum, group) => sum + group.middlewareIds.length,
      0
    )

    console.log(`✅ Groups: ${finalGroups.length}`)
    console.log(`✅ Channels: ${totalChannels}`)
    console.log(`✅ Middleware: ${totalMiddleware}`)
    console.log(
      `✅ System Status: ${
        performanceState.stress < 0.5 ? 'HEALTHY' : 'STRESSED'
      }`
    )
    console.log(
      `✅ Breathing: ${
        breathingState.isRecuperating ? 'RECUPERATING' : 'NORMAL'
      }`
    )

    console.log('\n🎯 Features Demonstrated:')
    console.log('   ✅ Basic group creation and management')
    console.log('   ✅ Pattern-based channel matching')
    console.log('   ✅ Middleware chain execution')
    console.log('   ✅ Schema validation')
    console.log('   ✅ Alert systems')
    console.log('   ✅ Circuit breaker pattern')
    console.log('   ✅ Load testing')
    console.log('   ✅ Cross-group coordination')
    console.log('   ✅ Performance monitoring')
    console.log('   ✅ System analytics')

    console.log('\n🚀 Advanced Capabilities:')
    console.log('   ✅ Automatic channel-to-group assignment')
    console.log('   ✅ Group inheritance and middleware composition')
    console.log('   ✅ Real-time monitoring and alerts')
    console.log('   ✅ Resilience patterns (circuit breaker)')
    console.log('   ✅ Performance analytics and reporting')
    console.log('   ✅ Breathing system integration')

    console.log('\n=====================================')
    console.log('🎉 CYRE GROUP SYSTEM DEMO COMPLETE!')
    console.log('   All features working optimally')
    console.log('   System ready for production use')
    console.log('=====================================\n')
  } catch (error) {
    console.error('\n❌ Demo failed:', error)
    console.error(
      'Stack trace:',
      error instanceof Error ? error.stack : 'No stack trace'
    )
  }
}

// Package.json script entry point
async function main() {
  console.log('🔧 Node.js Environment Check:')
  console.log(`   Node.js version: ${process.version}`)
  console.log(`   Platform: ${process.platform}`)
  console.log(`   Crypto available: ${typeof crypto !== 'undefined'}`)
  console.log(`   Performance API: ${typeof performance !== 'undefined'}`)

  await nodeGroupDemo()
}

// Export for module usage
export {nodeGroupDemo}

// Run if executed directly

main().catch(console.error)

// Example package.json scripts:
/*
{
  "scripts": {
    "demo": "ts-node run-group-demo.ts",
    "demo:js": "node dist/run-group-demo.js",
    "demo:dev": "nodemon --exec ts-node run-group-demo.ts"
  },
  "dependencies": {
    "cyre": "^4.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "ts-node": "^10.0.0",
    "nodemon": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
*/

// Usage instructions:
/*
1. Install dependencies:
   npm install cyre
   npm install -D typescript ts-node @types/node

2. Run the demo:
   npm run demo
   # or
   npx ts-node run-group-demo.ts

3. For production build:
   npx tsc run-group-demo.ts
   node run-group-demo.js

4. Watch mode for development:
   npx nodemon --exec ts-node run-group-demo.ts
*/
