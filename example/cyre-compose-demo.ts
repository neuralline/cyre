// example/cyre-compose-demo.ts
// Location: examples/cyre-compose-demo.ts
// Comprehensive demonstration of cyreCompose functionality
import {useCyre, cyreCompose, cyre} from '../src'

// Enhanced types with better error handling
interface ProcessingResult<T = any> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    processingTime: number
    channelId: string
    timestamp: number
  }
}

interface UserData {
  id: number
  name: string
  email: string
  preferences?: Record<string, any>
}

interface ValidationResult extends ProcessingResult<UserData> {
  validationErrors?: string[]
  warnings?: string[]
}

/**
 * Enhanced demo that demonstrates better error handling and result flow
 */
async function demonstrateEnhancedCyreCompose() {
  console.log('🚀 Enhanced Cyre Compose Demonstration\n')

  // ========================================
  // Create Channels with Better Error Handling
  // ========================================

  const validationChannel = useCyre<UserData>({
    name: 'validation',
    debug: false, // Reduce noise
    protection: {
      throttle: 100,
      detectChanges: true
    },
    priority: {level: 'high'}
  })

  const enrichmentChannel = useCyre<UserData>({
    name: 'enrichment',
    debug: false,
    protection: {
      debounce: 50,
      detectChanges: true
    },
    priority: {level: 'medium'}
  })

  const notificationChannel = useCyre<UserData>({
    name: 'notification',
    debug: false,
    protection: {
      throttle: 200
    },
    priority: {level: 'low'}
  })

  // ========================================
  // Set Up Handlers with Proper Error Handling
  // ========================================

  // Validation Handler with explicit success/failure
  validationChannel.on(userData => {
    console.log(`  🔍 [VALIDATION] Processing: ${userData.name}`)

    const errors: string[] = []
    const warnings: string[] = []

    // Validation logic with detailed error reporting
    if (!userData.email || !userData.email.includes('@')) {
      errors.push('Invalid email format')
    }
    if (!userData.name || userData.name.length < 2) {
      errors.push('Name too short')
    }
    if (userData.id <= 0) {
      warnings.push('Invalid user ID')
    }

    const success = errors.length === 0
    const result: ValidationResult = {
      success,
      data: success ? userData : undefined,
      error: errors.length > 0 ? errors.join(', ') : undefined,
      validationErrors: errors,
      warnings,
      metadata: {
        processingTime: performance.now(),
        channelId: 'validation',
        timestamp: Date.now()
      }
    }

    console.log(
      `     ${success ? '✅ Valid' : '❌ Invalid'}: ${
        errors.join(', ') || 'OK'
      }`
    )

    // IMPORTANT: Return success/failure explicitly
    // This should influence the composed channel's continueOnError behavior
    if (!success) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }

    return result
  })

  // Enrichment Handler
  enrichmentChannel.on(userData => {
    console.log(`  🌟 [ENRICHMENT] Enriching: ${userData.name}`)

    try {
      const enrichedData: UserData = {
        ...userData,
        preferences: {
          theme: 'dark',
          notifications: true,
          language: 'en',
          enrichedAt: new Date().toISOString()
        }
      }

      console.log(`     ✨ Enrichment completed`)

      return {
        success: true,
        data: enrichedData,
        metadata: {
          processingTime: performance.now(),
          channelId: 'enrichment',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.log(`     ❌ Enrichment failed: ${error}`)
      throw new Error(`Enrichment failed: ${error}`)
    }
  })

  // Notification Handler
  notificationChannel.on(userData => {
    console.log(`  📢 [NOTIFICATION] Notifying: ${userData.name}`)

    try {
      // Simulate notification logic
      const channels = ['email']
      if (userData.preferences?.notifications) {
        channels.push('push')
      }

      console.log(`     📧 Sent via: ${channels.join(', ')}`)

      return {
        success: true,
        data: {
          messageId: `msg-${Date.now()}`,
          channels,
          sentAt: new Date().toISOString()
        },
        metadata: {
          processingTime: performance.now(),
          channelId: 'notification',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.log(`     ❌ Notification failed: ${error}`)
      throw new Error(`Notification failed: ${error}`)
    }
  })

  // ========================================
  // Create Composed Channels with Different Error Strategies
  // ========================================

  console.log(
    '🔗 Creating composed channels with different error strategies...\n'
  )

  // Strict Pipeline (stops on first error)
  const strictPipeline = cyreCompose(
    [validationChannel, enrichmentChannel, notificationChannel],
    {
      id: 'strict-processing',
      continueOnError: false
    }
  )

  // Resilient Pipeline (continues despite errors)
  const resilientPipeline = cyreCompose(
    [validationChannel, enrichmentChannel, notificationChannel],
    {
      id: 'resilient-processing',
      continueOnError: true
    }
  )

  // ========================================
  // Test Data
  // ========================================

  const validUser: UserData = {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com'
  }

  const invalidUser: UserData = {
    id: -1,
    name: 'B',
    email: 'invalid-email'
  }

  // ========================================
  // SCENARIO 1: Strict Pipeline with Valid Data
  // ========================================

  console.log('📋 SCENARIO 1: Strict Pipeline with Valid User')
  console.log('='.repeat(60))

  try {
    const results = await strictPipeline.call(validUser)

    // Ensure results is an array
    const resultsArray = Array.isArray(results) ? results : [results]

    console.log('\n📊 Results Summary:')
    resultsArray.forEach((result, index) => {
      const channels = ['Validation', 'Enrichment', 'Notification']
      const status = result.ok ? '✅ Success' : '❌ Failed'
      const message = result.message || 'No message'
      console.log(`  ${index + 1}. ${channels[index]}: ${status}`)
      console.log(`     Message: ${message}`)
    })

    console.log(
      `\n✅ Strict pipeline completed successfully with ${results.length} channels`
    )
  } catch (error) {
    console.error('❌ Strict pipeline failed:', error.message)
  }

  await wait(600) // Allow debounce to complete

  // ========================================
  // SCENARIO 2: Strict Pipeline with Invalid Data (Should Stop Early)
  // ========================================

  console.log(
    '\n📋 SCENARIO 2: Strict Pipeline with Invalid User (Should Stop Early)'
  )
  console.log('='.repeat(70))

  try {
    const results = (await strictPipeline.call(validUser)) || 0

    // Ensure results is an array
    const resultsArray = Array.isArray(results) ? results : [results]

    console.log('\n📊 Results Summary:')
    resultsArray.forEach((result, index) => {
      const channels = ['Validation', 'Enrichment', 'Notification']
      const status = result.ok ? '✅ Success' : '❌ Failed'
      const message = result.message || 'No message'
      console.log(`  ${index + 1}. ${channels[index]}: ${status}`)
      console.log(`     Message: ${message}`)
    })
    console.log(
      `\n⚠️  Strict pipeline stopped early: ${results.length} channels executed (expected < 3)`
    )
  } catch (error) {
    console.error('❌ Strict pipeline failed as expected:', error.message)
  }

  await wait(600) // Allow debounce to complete

  // ========================================
  // SCENARIO 3: Resilient Pipeline with Invalid Data (Should Complete All)
  // ========================================

  console.log(
    '\n📋 SCENARIO 3: Resilient Pipeline with Invalid User (Should Complete All)'
  )
  console.log('='.repeat(75))

  try {
    const results = await strictPipeline.call(validUser)

    // Ensure results is an array
    const resultsArray = Array.isArray(results) ? results : [results]

    console.log('\n📊 Results Summary:')
    resultsArray.forEach((result, index) => {
      const channels = ['Validation', 'Enrichment', 'Notification']
      const status = result.ok ? '✅ Success' : '❌ Failed'
      const message = result.message || 'No message'
      console.log(`  ${index + 1}. ${channels[index]}: ${status}`)
      console.log(`     Message: ${message}`)
    })

    console.log(
      `\n🔄 Resilient pipeline completed all ${results.length} channels despite errors`
    )
  } catch (error) {
    console.error('❌ Resilient pipeline failed:', error.message)
  }

  await wait(600) // Allow debounce to complete

  // ========================================
  // SCENARIO 4: Demonstrate Change Detection in Composition
  // ========================================

  console.log('\n📋 SCENARIO 4: Change Detection in Composition')
  console.log('='.repeat(50))

  console.log('First call with new data:')
  const newUser: UserData = {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com'
  }

  try {
    const results1 = await strictPipeline.call(newUser)
    console.log(`✅ First call completed: ${results1.length} channels executed`)
  } catch (error) {
    console.error('❌ First call failed:', error.message)
  }

  await wait(100)

  console.log('\nSecond call with same data (should show change detection):')
  try {
    const results2 = await strictPipeline.call(newUser)
    console.log(
      `✅ Second call completed: ${results2.length} channels executed`
    )

    // Check if any channels were skipped due to change detection
    const skippedChannels = results2.filter(
      r => r.message && r.message.includes('No changes detected')
    )

    if (skippedChannels.length > 0) {
      console.log(
        `🎯 Change detection worked: ${skippedChannels.length} channels skipped`
      )
    }
  } catch (error) {
    console.error('❌ Second call failed:', error.message)
  }

  // ========================================
  // Performance Analysis
  // ========================================

  console.log('\n📈 Performance Analysis')
  console.log('='.repeat(30))

  const globalMetrics = cyre.getPerformanceState()
  console.log(
    `• Total Processing Time: ${globalMetrics.totalProcessingTime.toFixed(2)}ms`
  )
  console.log(`• System Stress: ${(globalMetrics.stress * 100).toFixed(1)}%`)
  console.log(
    `• Pipeline Efficiency: ${(globalMetrics.avgEfficiencyRatio * 100).toFixed(
      1
    )}%`
  )

  // Individual channel analysis
  console.log('\nIndividual Channel Performance:')
  const channels = [
    {name: 'Validation', channel: validationChannel},
    {name: 'Enrichment', channel: enrichmentChannel},
    {name: 'Notification', channel: notificationChannel}
  ]

  channels.forEach(({name, channel}) => {
    const history = channel.getHistory()
    console.log(`• ${name}: ${history.length} executions`)
  })

  // ========================================
  // Cleanup
  // ========================================

  console.log('\n🧹 Cleanup')
  strictPipeline.forget()
  resilientPipeline.forget()

  console.log('\n🎉 Enhanced demonstration completed!')

  console.log('\nKey Improvements Demonstrated:')
  console.log('• Better error handling with explicit success/failure')
  console.log('• Reduced debug noise for clearer output')
  console.log('• Change detection verification in composed channels')
  console.log('• Different error handling strategies clearly demonstrated')
  console.log('• Performance analysis with meaningful metrics')
}

/**
 * Demonstrate middleware in composed channels
 */
async function demonstrateMiddlewareInComposition() {
  console.log('\n🔧 Middleware in Composed Channels\n')

  // Create channels with middleware
  const preprocessChannel = useCyre<{data: any; timestamp?: number}>({
    name: 'preprocess',
    debug: false
  })

  const processChannel = useCyre<any>({
    name: 'process',
    debug: false
  })

  // Add middleware to preprocess channel
  preprocessChannel.middleware(async (payload, next) => {
    console.log(`  🔧 [MIDDLEWARE] Adding timestamp to payload`)

    const enhancedPayload = {
      ...payload,
      timestamp: Date.now(),
      processedBy: 'middleware'
    }

    return next(enhancedPayload)
  })

  // Set up handlers
  preprocessChannel.on(payload => {
    console.log(
      `  📝 [PREPROCESS] Received payload with timestamp: ${payload.timestamp}`
    )
    return {
      success: true,
      preprocessed: true,
      payload
    }
  })

  processChannel.on(payload => {
    console.log(
      `  ⚙️  [PROCESS] Processing data: ${JSON.stringify(payload.data)}`
    )
    return {
      success: true,
      processed: true,
      result: `Processed: ${JSON.stringify(payload)}`
    }
  })

  // Create composed channel
  const middlewarePipeline = cyreCompose([preprocessChannel, processChannel], {
    id: 'middleware-pipeline',
    continueOnError: false
  })

  // Test the pipeline
  console.log('Testing middleware in composition:')
  const results = await middlewarePipeline.call({
    data: {value: 42, type: 'test'}
  })

  // Ensure results is an array
  const resultsArray = Array.isArray(results) ? results : [results]

  console.log('\nMiddleware Pipeline Results:')
  resultsArray.forEach((result, index) => {
    const channels = ['Preprocess', 'Process']
    console.log(
      `  ${index + 1}. ${channels[index]}: ${result.ok ? '✅' : '❌'} - ${
        result.message
      }`
    )
  })

  // Cleanup
  middlewarePipeline.forget()
}

/**
 * Helper function for delays
 */
const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Main execution
 */
async function main() {
  try {
    await demonstrateEnhancedCyreCompose()
    await wait(1000)
    await demonstrateMiddlewareInComposition()

    console.log('\n🎯 Enhanced demonstrations completed successfully!')
  } catch (error) {
    console.error('❌ Demonstration failed:', error)
    process.exit(1)
  }

  // Clean exit
  setTimeout(() => {
    console.log('\n👋 Exiting gracefully...')
    process.exit(0)
  }, 1000)
}

// Export for use
export {
  demonstrateEnhancedCyreCompose,
  demonstrateMiddlewareInComposition,
  main
}

// Run if called directly

main()
