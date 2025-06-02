// tests/integration/payload-state-behavior.test.ts
// Comprehensive tests for payload/state separation and related behaviors

import {cyre} from '../../src'
import type {ActionPayload} from '../../src/types/core'

// Test configuration
const TEST_CONFIG = {
  iterations: 1000,
  channels: 50,
  payloadSizes: [10, 100, 1000],
  concurrency: 10
}

interface PayloadTestResults {
  changeDetection: number
  stateReactivity: number
  payloadTransformation: number
  schemaValidation: number
  conditionChecking: number
  selectorApplication: number
  payloadHistory: number
  crossChannelState: number
}

// Utility functions
const measureTime = async (fn: () => Promise<void> | void): Promise<number> => {
  const start = performance.now()
  await fn()
  return performance.now() - start
}

const generateComplexPayload = (size: number) => ({
  id: Math.random().toString(36),
  data: Array(size)
    .fill(0)
    .map(() => Math.random()),
  metadata: {
    timestamp: Date.now(),
    version: '1.0',
    tags: ['test', 'benchmark', 'payload']
  },
  nested: {
    level1: {
      level2: {
        value: Math.random() * 1000,
        items: Array(Math.min(size / 10, 10))
          .fill(0)
          .map(() => ({
            id: Math.random().toString(36),
            value: Math.random()
          }))
      }
    }
  }
})

const createUserPayload = (userId: number) => ({
  user: {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@test.com`,
    preferences: {
      theme: userId % 2 === 0 ? 'dark' : 'light',
      notifications: true,
      language: 'en'
    }
  },
  session: {
    token: `token-${userId}-${Date.now()}`,
    expires: Date.now() + 3600000,
    permissions: ['read', 'write']
  },
  activity: {
    lastLogin: Date.now() - Math.random() * 86400000,
    pageViews: Math.floor(Math.random() * 100),
    actions: Math.floor(Math.random() * 50)
  }
})

export async function runPayloadStateTests(): Promise<PayloadTestResults> {
  console.log('\n🧪 Payload/State Behavior Tests')
  console.log('================================')

  await cyre.initialize()

  const results: PayloadTestResults = {
    changeDetection: 0,
    stateReactivity: 0,
    payloadTransformation: 0,
    schemaValidation: 0,
    conditionChecking: 0,
    selectorApplication: 0,
    payloadHistory: 0,
    crossChannelState: 0
  }

  // Test 1: Change Detection Performance
  console.log('\n🔍 Testing Change Detection...')
  results.changeDetection = await measureTime(async () => {
    // Setup channels with change detection
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      cyre.action({
        id: `change-detect-${i}`,
        detectChanges: true
      })

      cyre.on(`change-detect-${i}`, (payload: ActionPayload) => {
        return {processed: payload, timestamp: Date.now()}
      })
    }

    // Test same payload (should be skipped)
    const samePayload = generateComplexPayload(100)
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      await cyre.call(`change-detect-${i}`, samePayload)
      // Second call with same payload should be skipped
      await cyre.call(`change-detect-${i}`, samePayload)
    }

    // Test different payloads (should execute)
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const channelId = `change-detect-${i % TEST_CONFIG.channels}`
      await cyre.call(channelId, generateComplexPayload(100))
    }
  })
  console.log(`Change Detection: ${results.changeDetection.toFixed(2)}ms`)

  // Test 2: State Reactivity (selector + condition + transform)
  console.log('\n⚡ Testing State Reactivity...')
  results.stateReactivity = await measureTime(async () => {
    // Setup reactive channels
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      cyre.action({
        id: `reactive-${i}`,
        selector: (state: any) => state.user,
        condition: (user: any) => user && user.id > 0,
        transform: (user: any) => ({
          userId: user.id,
          displayName: user.name,
          isActive: true,
          transformedAt: Date.now()
        }),
        detectChanges: true
      })

      cyre.on(`reactive-${i}`, (payload: ActionPayload) => {
        return {reactive: payload, channelId: i}
      })
    }

    // Execute with user payloads
    const promises = []
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const channelId = `reactive-${i % TEST_CONFIG.channels}`
      const userPayload = createUserPayload(i + 1)
      promises.push(cyre.call(channelId, userPayload))
    }

    await Promise.all(promises)
  })
  console.log(`State Reactivity: ${results.stateReactivity.toFixed(2)}ms`)

  // Test 3: Payload Transformation Chains
  console.log('\n🔄 Testing Payload Transformation...')
  results.payloadTransformation = await measureTime(async () => {
    // Setup transformation chains
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      cyre.action({
        id: `transform-${i}`,
        transform: (payload: any) => {
          // Multi-stage transformation
          const stage1 = {
            ...payload,
            stage1: {
              normalized: payload.data?.map((x: number) => x * 2) || [],
              timestamp: Date.now()
            }
          }

          const stage2 = {
            ...stage1,
            stage2: {
              aggregated: stage1.stage1.normalized.reduce(
                (sum: number, val: number) => sum + val,
                0
              ),
              count: stage1.stage1.normalized.length
            }
          }

          return {
            ...stage2,
            final: {
              average:
                stage2.stage2.count > 0
                  ? stage2.stage2.aggregated / stage2.stage2.count
                  : 0,
              processed: true,
              transformationId: `transform-${i}-${Date.now()}`
            }
          }
        }
      })

      cyre.on(`transform-${i}`, (payload: ActionPayload) => {
        return {transformed: payload}
      })
    }

    // Execute transformations
    const promises = []
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const channelId = `transform-${i % TEST_CONFIG.channels}`
      const complexPayload = generateComplexPayload(50)
      promises.push(cyre.call(channelId, complexPayload))
    }

    await Promise.all(promises)
  })
  console.log(
    `Payload Transformation: ${results.payloadTransformation.toFixed(2)}ms`
  )

  // Test 4: Schema Validation with Complex Payloads
  console.log('\n✅ Testing Schema Validation...')
  results.schemaValidation = await measureTime(async () => {
    // Complex nested schema
    const userSchema = cyre.schema.object({
      user: cyre.schema.object({
        id: cyre.schema.number().positive(),
        name: cyre.schema.string().minLength(3).maxLength(50),
        email: cyre.schema.string().email(),
        preferences: cyre.schema.object({
          theme: cyre.schema.enums('light', 'dark'),
          notifications: cyre.schema.boolean(),
          language: cyre.schema.string().len(2)
        })
      }),
      session: cyre.schema.object({
        token: cyre.schema.string().minLength(10),
        expires: cyre.schema.number(),
        permissions: cyre.schema.array(cyre.schema.string())
      }),
      activity: cyre.schema.object({
        lastLogin: cyre.schema.number(),
        pageViews: cyre.schema.number(),
        actions: cyre.schema.number()
      })
    })

    // Setup channels with schema validation
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      cyre.action({
        id: `schema-${i}`,
        schema: userSchema
      })

      cyre.on(`schema-${i}`, (payload: ActionPayload) => {
        return {validated: payload, schemaId: i}
      })
    }

    // Execute with valid payloads
    const promises = []
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const channelId = `schema-${i % TEST_CONFIG.channels}`
      const userPayload = createUserPayload(i + 1)
      promises.push(cyre.call(channelId, userPayload))
    }

    await Promise.all(promises)
  })
  console.log(`Schema Validation: ${results.schemaValidation.toFixed(2)}ms`)

  // Test 5: Condition Checking Performance
  console.log('\n🎯 Testing Condition Checking...')
  results.conditionChecking = await measureTime(async () => {
    // Setup channels with various conditions
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      cyre.action({
        id: `condition-${i}`,
        condition: (payload: any) => {
          // Complex condition logic
          if (!payload || !payload.user) return false

          const user = payload.user
          const activity = payload.activity || {}

          // Multiple condition checks
          const hasValidId = user.id > 0
          const hasValidEmail = user.email && user.email.includes('@')
          const isActiveUser = activity.pageViews > 5
          const hasRecentActivity =
            activity.lastLogin > Date.now() - 7 * 24 * 60 * 60 * 1000

          return (
            hasValidId && hasValidEmail && (isActiveUser || hasRecentActivity)
          )
        }
      })

      cyre.on(`condition-${i}`, (payload: ActionPayload) => {
        return {conditionMet: payload, channelId: i}
      })
    }

    // Execute with mixed payloads (some pass, some fail conditions)
    const promises = []
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const channelId = `condition-${i % TEST_CONFIG.channels}`
      const userPayload = createUserPayload(i + 1)

      // Modify some payloads to fail conditions
      if (i % 3 === 0) {
        userPayload.user.id = -1 // Invalid ID
      }
      if (i % 5 === 0) {
        userPayload.activity.pageViews = 1 // Low activity
        userPayload.activity.lastLogin = Date.now() - 30 * 24 * 60 * 60 * 1000 // Old activity
      }

      promises.push(cyre.call(channelId, userPayload))
    }

    await Promise.all(promises)
  })
  console.log(`Condition Checking: ${results.conditionChecking.toFixed(2)}ms`)

  // Test 6: Selector Application Performance
  console.log('\n🎪 Testing Selector Application...')
  results.selectorApplication = await measureTime(async () => {
    // Setup channels with complex selectors
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      cyre.action({
        id: `selector-${i}`,
        selector: (state: any) => {
          // Complex nested selection
          const user = state.user || {}
          const activity = state.activity || {}
          const session = state.session || {}

          return {
            profile: {
              id: user.id,
              name: user.name,
              theme: user.preferences?.theme || 'light'
            },
            stats: {
              pageViews: activity.pageViews || 0,
              actions: activity.actions || 0,
              sessionLength: session.expires ? session.expires - Date.now() : 0
            },
            computed: {
              activityScore:
                (activity.pageViews || 0) * 2 + (activity.actions || 0) * 5,
              isActive:
                (activity.lastLogin || 0) > Date.now() - 24 * 60 * 60 * 1000,
              userLevel: (activity.pageViews || 0) > 50 ? 'advanced' : 'basic'
            }
          }
        },
        detectChanges: true
      })

      cyre.on(`selector-${i}`, (payload: ActionPayload) => {
        return {selected: payload, selectorId: i}
      })
    }

    // Execute with user payloads
    const promises = []
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const channelId = `selector-${i % TEST_CONFIG.channels}`
      const userPayload = createUserPayload(i + 1)
      promises.push(cyre.call(channelId, userPayload))
    }

    await Promise.all(promises)
  })
  console.log(
    `Selector Application: ${results.selectorApplication.toFixed(2)}ms`
  )

  // Test 7: Payload History and Previous State
  console.log('\n📚 Testing Payload History...')
  results.payloadHistory = await measureTime(async () => {
    // Setup channels that track history
    for (let i = 0; i < TEST_CONFIG.channels; i++) {
      cyre.action({
        id: `history-${i}`,
        detectChanges: true
      })

      cyre.on(`history-${i}`, (payload: ActionPayload) => {
        // Get previous payload for comparison
        const previous = cyre.getPrevious(`history-${i}`)
        return {
          current: payload,
          previous: previous || null,
          hasChanged:
            !previous || JSON.stringify(payload) !== JSON.stringify(previous),
          historyId: i
        }
      })
    }

    // Execute with changing payloads
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const channelId = `history-${i % TEST_CONFIG.channels}`

      // Create evolving payloads
      const basePayload = {
        counter: Math.floor(i / 10), // Changes every 10 iterations
        data: i % 5 === 0 ? Math.random() : 'stable', // Changes occasionally
        metadata: {
          iteration: i,
          timestamp: Date.now()
        }
      }

      await cyre.call(channelId, basePayload)
    }
  })
  console.log(`Payload History: ${results.payloadHistory.toFixed(2)}ms`)

  // Test 8: Cross-Channel State Sharing
  console.log('\n🔗 Testing Cross-Channel State...')
  results.crossChannelState = await measureTime(async () => {
    // Setup source channels
    for (let i = 0; i < 10; i++) {
      cyre.action({
        id: `source-${i}`,
        transform: (payload: any) => ({
          ...payload,
          sourceId: i,
          sharedState: {
            timestamp: Date.now(),
            value: payload.value * (i + 1)
          }
        })
      })

      cyre.on(`source-${i}`, (payload: ActionPayload) => {
        // Share state with dependent channels
        const dependents = [`dependent-${i}-a`, `dependent-${i}-b`]

        dependents.forEach(async depId => {
          if (cyre.get(depId)) {
            await cyre.call(depId, {
              fromSource: i,
              sharedData: payload.sharedState,
              originalPayload: payload
            })
          }
        })

        return payload
      })
    }

    // Setup dependent channels
    for (let i = 0; i < 10; i++) {
      ;['a', 'b'].forEach(suffix => {
        cyre.action({
          id: `dependent-${i}-${suffix}`,
          condition: (payload: any) => payload.fromSource === i,
          transform: (payload: any) => ({
            ...payload,
            dependentId: `${i}-${suffix}`,
            processed: true
          })
        })

        cyre.on(`dependent-${i}-${suffix}`, (payload: ActionPayload) => {
          return {dependent: payload}
        })
      })
    }

    // Execute cross-channel operations
    const promises = []
    for (let i = 0; i < 500; i++) {
      const sourceId = `source-${i % 10}`
      promises.push(
        cyre.call(sourceId, {
          value: Math.random() * 100,
          iteration: i
        })
      )
    }

    await Promise.all(promises)
  })
  console.log(`Cross-Channel State: ${results.crossChannelState.toFixed(2)}ms`)

  return results
}

export function printPayloadTestResults(results: PayloadTestResults): void {
  console.log('\n📊 Payload/State Test Results')
  console.log('==============================')

  console.log('\nExecution Times:')
  console.log(`Change Detection: ${results.changeDetection.toFixed(2)}ms`)
  console.log(`State Reactivity: ${results.stateReactivity.toFixed(2)}ms`)
  console.log(
    `Payload Transformation: ${results.payloadTransformation.toFixed(2)}ms`
  )
  console.log(`Schema Validation: ${results.schemaValidation.toFixed(2)}ms`)
  console.log(`Condition Checking: ${results.conditionChecking.toFixed(2)}ms`)
  console.log(
    `Selector Application: ${results.selectorApplication.toFixed(2)}ms`
  )
  console.log(`Payload History: ${results.payloadHistory.toFixed(2)}ms`)
  console.log(`Cross-Channel State: ${results.crossChannelState.toFixed(2)}ms`)

  console.log('\nThroughput Analysis:')
  console.log(
    `Change Detection: ${(
      TEST_CONFIG.iterations /
      (results.changeDetection / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `State Reactivity: ${(
      TEST_CONFIG.iterations /
      (results.stateReactivity / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `Payload Transformation: ${(
      TEST_CONFIG.iterations /
      (results.payloadTransformation / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `Schema Validation: ${(
      TEST_CONFIG.iterations /
      (results.schemaValidation / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `Condition Checking: ${(
      TEST_CONFIG.iterations /
      (results.conditionChecking / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `Selector Application: ${(
      TEST_CONFIG.iterations /
      (results.selectorApplication / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `Payload History: ${(
      TEST_CONFIG.iterations /
      (results.payloadHistory / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `Cross-Channel State: ${(500 / (results.crossChannelState / 1000)).toFixed(
      0
    )} ops/s`
  )

  // Performance grades
  console.log('\nPerformance Grades:')
  const gradeChange =
    results.changeDetection < 100
      ? '🟢 A'
      : results.changeDetection < 300
      ? '🟡 B'
      : '🔴 C'
  const gradeReactive =
    results.stateReactivity < 150
      ? '🟢 A'
      : results.stateReactivity < 400
      ? '🟡 B'
      : '🔴 C'
  const gradeTransform =
    results.payloadTransformation < 200
      ? '🟢 A'
      : results.payloadTransformation < 500
      ? '🟡 B'
      : '🔴 C'
  const gradeSchema =
    results.schemaValidation < 300
      ? '🟢 A'
      : results.schemaValidation < 800
      ? '🟡 B'
      : '🔴 C'
  const gradeCondition =
    results.conditionChecking < 150
      ? '🟢 A'
      : results.conditionChecking < 400
      ? '🟡 B'
      : '🔴 C'
  const gradeSelector =
    results.selectorApplication < 200
      ? '🟢 A'
      : results.selectorApplication < 500
      ? '🟡 B'
      : '🔴 C'
  const gradeHistory =
    results.payloadHistory < 100
      ? '🟢 A'
      : results.payloadHistory < 300
      ? '🟡 B'
      : '🔴 C'
  const gradeCross =
    results.crossChannelState < 150
      ? '🟢 A'
      : results.crossChannelState < 400
      ? '🟡 B'
      : '🔴 C'

  console.log(`Change Detection: ${gradeChange}`)
  console.log(`State Reactivity: ${gradeReactive}`)
  console.log(`Payload Transformation: ${gradeTransform}`)
  console.log(`Schema Validation: ${gradeSchema}`)
  console.log(`Condition Checking: ${gradeCondition}`)
  console.log(`Selector Application: ${gradeSelector}`)
  console.log(`Payload History: ${gradeHistory}`)
  console.log(`Cross-Channel State: ${gradeCross}`)

  // Insights
  console.log('\nPayload/State Insights:')
  if (results.changeDetection > results.payloadHistory) {
    console.log('- Change detection overhead detected - consider optimization')
  }
  if (results.schemaValidation > results.conditionChecking * 2) {
    console.log('- Schema validation is significantly slower than conditions')
  }
  if (results.selectorApplication > results.stateReactivity) {
    console.log('- Selector complexity may be affecting performance')
  }
  if (results.crossChannelState > 400) {
    console.log(
      '- Cross-channel operations need optimization for high-frequency use'
    )
  }
}

// Main execution function
export async function runCompletePayloadTests(): Promise<void> {
  try {
    console.log('🧪 Starting Comprehensive Payload/State Tests...')

    const results = await runPayloadStateTests()
    printPayloadTestResults(results)

    // System health after payload stress
    console.log('\n🏥 System Health After Payload Tests:')
    const metrics = cyre.getMetricsReport()
    const breathingState = cyre.getBreathingState()

    console.log(`Total Operations: ${metrics.global.totalCalls}`)
    console.log(
      `Error Rate: ${(
        (metrics.global.totalErrors / metrics.global.totalCalls) *
        100
      ).toFixed(2)}%`
    )
    console.log(`System Stress: ${(breathingState.stress * 100).toFixed(1)}%`)
    console.log(
      `Memory Pressure: ${breathingState.isRecuperating ? 'HIGH' : 'NORMAL'}`
    )

    // Payload state statistics
    console.log('\n📊 Payload State Statistics:')
    console.log(`Active Channels: ${cyre.getMetrics().formations?.length || 0}`)
    console.log(`System Uptime: ${metrics.global.uptime}s`)
  } catch (error) {
    console.error('❌ Payload tests failed:', error)
  } finally {
    cyre.clear()
    console.log('\n🧹 Payload test cleanup complete')
  }
}

// Auto-run if executed directly
runCompletePayloadTests()
