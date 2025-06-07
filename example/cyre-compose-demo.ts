// example/cyre-compose-demo-updated.ts
// Updated demo compatible with core action/talent pipeline
// Uses direct properties instead of nested protection object

import {useCyre, cyreCompose, cyre, useBranch} from '../src'
import type {CyreComposedResponse} from '../src/hooks/use-group'

// Enhanced types for demonstration
interface UserData {
  id: number
  name: string
  email: string
  preferences?: Record<string, any>
}

interface ValidationResult {
  valid: boolean
  data?: UserData
  errors?: string[]
  warnings?: string[]
  metadata?: {
    processingTime: number
    channelId: string
    timestamp: number
  }
}

/**
 * Updated demo using core system aligned hooks
 */
async function demonstrateUpdatedCyreCompose() {
  console.log('🚀 Updated Cyre Compose Demonstration (Core System Aligned)\n')

  // ========================================
  // Create Channels with Core System Properties
  // ========================================

  console.log('📝 Creating channels with core system configuration...')

  // Validation channel - using direct properties (not nested protection)
  const validationChannel = useCyre<UserData>({
    name: 'validation',
    debug: true,
    // Core system properties (direct, not in protection object)
    throttle: 100, // Direct property, not protection.throttle
    detectChanges: true, // Direct property, not protection.detectChanges
    priority: {level: 'high'}, // Direct property
    required: true // Payload is required
  })

  // Enrichment channel with debounce
  const enrichmentChannel = useCyre<UserData>({
    name: 'enrichment',
    debug: true,
    // Core system properties
    debounce: 150, // Direct property
    maxWait: 500, // Works with debounce
    detectChanges: true,
    priority: {level: 'medium'},
    // Core system talent functions
    transform: (userData: UserData) => {
      console.log(
        `  🔧 [ENRICHMENT] Transforming user data for: ${userData.name}`
      )
      return {
        ...userData,
        preferences: {
          ...userData.preferences,
          enriched: true,
          enrichedAt: Date.now()
        }
      }
    }
  })

  // Notification channel with condition talent
  const notificationChannel = useCyre<UserData>({
    name: 'notification',
    debug: true,
    throttle: 200,
    priority: {level: 'low'},
    // Core system condition talent
    condition: (userData: UserData) => {
      const shouldNotify = userData.email && userData.email.includes('@')
      console.log(
        `  🔔 [NOTIFICATION] Should notify ${userData.name}: ${shouldNotify}`
      )
      return shouldNotify
    }
  })

  console.log('✅ Channels created with core system configuration')

  // ========================================
  // Set Up Event Handlers
  // ========================================

  console.log('\n🔧 Setting up event handlers...')

  // Validation handler
  validationChannel.on((userData: UserData) => {
    console.log(
      `  🔍 [VALIDATION] Processing: ${userData.name} (${userData.email})`
    )

    const errors: string[] = []
    const warnings: string[] = []

    // Validation logic
    if (!userData.email || !userData.email.includes('@')) {
      errors.push('Invalid email format')
    }
    if (!userData.name || userData.name.length < 2) {
      errors.push('Name too short')
    }
    if (userData.id <= 0) {
      warnings.push('Invalid user ID')
    }

    const isValid = errors.length === 0
    const result: ValidationResult = {
      valid: isValid,
      data: isValid ? userData : undefined,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        processingTime: performance.now(),
        channelId: 'validation',
        timestamp: Date.now()
      }
    }

    console.log(
      `     ${isValid ? '✅' : '❌'} Validation ${
        isValid ? 'passed' : 'failed'
      }`
    )
    if (errors.length > 0) console.log(`     Errors: ${errors.join(', ')}`)
    if (warnings.length > 0)
      console.log(`     Warnings: ${warnings.join(', ')}`)

    return {
      ok: isValid,
      payload: result,
      message: isValid
        ? 'Validation passed'
        : `Validation failed: ${errors.join(', ')}`
    }
  })

  // Enrichment handler (transform happens in talent pipeline)
  enrichmentChannel.on((userData: UserData) => {
    console.log(`  🔧 [ENRICHMENT] Enriching data for: ${userData.name}`)

    // Additional enrichment beyond transform talent
    const enrichedData = {
      ...userData,
      preferences: {
        ...userData.preferences,
        processingStep: 'enrichment',
        handlerTimestamp: Date.now()
      }
    }

    return {
      ok: true,
      payload: enrichedData,
      message: `Data enriched for ${userData.name}`
    }
  })

  // Notification handler (condition talent filters execution)
  notificationChannel.on((userData: UserData) => {
    console.log(
      `  🔔 [NOTIFICATION] Sending notification to: ${userData.email}`
    )

    // Simulate notification sending
    const notificationId = `notif-${Date.now()}`

    return {
      ok: true,
      payload: {
        notificationId,
        recipient: userData.email,
        sentAt: Date.now(),
        type: 'user_processing_complete'
      },
      message: `Notification sent to ${userData.email}`
    }
  })

  console.log('✅ Event handlers configured')

  // ========================================
  // Create Compositions
  // ========================================

  console.log('\n🔗 Creating composed channels...')

  // Strict pipeline - stops on first error
  const strictPipeline = cyreCompose(
    [validationChannel, enrichmentChannel, notificationChannel],
    {
      id: 'strict-user-pipeline',
      debug: true,
      strategy: 'sequential', // Execute in order
      failFast: true, // Stop on first error
      continueOnError: false, // Don't continue on errors
      collectDetailedMetrics: true
    }
  )

  // Resilient pipeline - continues despite errors
  const resilientPipeline = cyreCompose(
    [validationChannel, enrichmentChannel, notificationChannel],
    {
      id: 'resilient-user-pipeline',
      debug: true,
      strategy: 'parallel', // Execute in parallel
      continueOnError: true, // Continue on errors
      failFast: false, // Don't stop on errors
      timeout: 5000, // 5 second timeout
      collectDetailedMetrics: true
    }
  )

  console.log('✅ Composed channels created')

  // ========================================
  // Test Data
  // ========================================

  const validUser: UserData = {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    preferences: {theme: 'dark', notifications: true}
  }

  const invalidUser: UserData = {
    id: -1,
    name: 'B',
    email: 'invalid-email',
    preferences: {}
  }

  // ========================================
  // SCENARIO 1: Strict Pipeline with Valid User
  // ========================================

  console.log('\n📋 SCENARIO 1: Strict Pipeline with Valid User')
  console.log('============================================================')

  try {
    const result1 = await strictPipeline.call(validUser)

    console.log('\n📊 Results Summary:')

    if (Array.isArray(result1.payload)) {
      result1.payload.forEach(
        (channelResult: CyreComposedResponse, index: number) => {
          const status = channelResult.ok ? '✅' : '❌'
          const timing = channelResult.timing
            ? ` (${channelResult.timing.executionTime.toFixed(2)}ms)`
            : ''

          console.log(
            `  ${index + 1}. ${channelResult.channelName}: ${status} ${
              channelResult.ok ? 'Success' : 'Failed'
            }${timing}`
          )
          console.log(`     Message: ${channelResult.message}`)
          if (channelResult.skipped) console.log('     Status: Skipped')
        }
      )
    }

    const successCount = Array.isArray(result1.payload)
      ? result1.payload.filter((r: CyreComposedResponse) => r.ok).length
      : 0

    console.log(
      `✅ Strict pipeline completed successfully with ${successCount} channels`
    )
  } catch (error) {
    console.log(`❌ Strict pipeline failed: ${error}`)
  }

  // ========================================
  // SCENARIO 2: Strict Pipeline with Invalid User
  // ========================================

  console.log(
    '\n📋 SCENARIO 2: Strict Pipeline with Invalid User (Should Stop Early)'
  )
  console.log(
    '======================================================================'
  )

  try {
    const result2 = await strictPipeline.call(invalidUser)

    console.log('\n📊 Results Summary:')

    if (Array.isArray(result2.payload)) {
      result2.payload.forEach(
        (channelResult: CyreComposedResponse, index: number) => {
          const status = channelResult.ok ? '✅' : '❌'
          const skipped = channelResult.skipped ? ' (Skipped)' : ''
          const timing = channelResult.timing
            ? ` (${channelResult.timing.executionTime.toFixed(2)}ms)`
            : ''

          console.log(
            `  ${index + 1}. ${channelResult.channelName}: ${status} ${
              channelResult.ok ? 'Success' : 'Failed'
            }${skipped}${timing}`
          )
          console.log(`     Message: ${channelResult.message}`)
        }
      )
    }

    const executedCount = Array.isArray(result2.payload)
      ? result2.payload.filter((r: CyreComposedResponse) => !r.skipped).length
      : 0

    console.log(
      `⚠️  Strict pipeline stopped early: ${executedCount} channels executed (expected < 3)`
    )
  } catch (error) {
    console.log(`❌ Strict pipeline error: ${error}`)
  }

  // ========================================
  // SCENARIO 3: Resilient Pipeline with Invalid User
  // ========================================

  console.log(
    '\n📋 SCENARIO 3: Resilient Pipeline with Invalid User (Should Complete All)'
  )
  console.log(
    '==========================================================================='
  )

  try {
    const result3 = await resilientPipeline.call(invalidUser)

    console.log('\n📊 Results Summary:')

    if (Array.isArray(result3.payload)) {
      result3.payload.forEach(
        (channelResult: CyreComposedResponse, index: number) => {
          const status = channelResult.ok ? '✅' : '❌'
          const timing = channelResult.timing
            ? ` (${channelResult.timing.executionTime.toFixed(2)}ms)`
            : ''

          console.log(
            `  ${index + 1}. ${channelResult.channelName}: ${status} ${
              channelResult.ok ? 'Success' : 'Failed'
            }${timing}`
          )
          console.log(`     Message: ${channelResult.message}`)
          if (channelResult.originalError) {
            console.log(`     Error: ${channelResult.originalError}`)
          }
        }
      )
    }

    const completedCount = Array.isArray(result3.payload)
      ? result3.payload.length
      : 0

    console.log(
      `🔄 Resilient pipeline completed all ${completedCount} channels despite errors`
    )
  } catch (error) {
    console.log(`❌ Resilient pipeline error: ${error}`)
  }

  // ========================================
  // SCENARIO 4: Change Detection Test
  // ========================================

  console.log('\n📋 SCENARIO 4: Change Detection in Composition')
  console.log('==================================================')

  try {
    // First call with new data
    console.log('First call with new data:')
    const result4a = await resilientPipeline.call(validUser)
    const executedCount1 = Array.isArray(result4a.payload)
      ? result4a.payload.length
      : 0
    console.log(`✅ First call completed: ${executedCount1} channels executed`)

    // Second call with same data (should trigger change detection)
    console.log('\nSecond call with same data (should show change detection):')
    const result4b = await resilientPipeline.call(validUser)
    const executedCount2 = Array.isArray(result4b.payload)
      ? result4b.payload.length
      : 0
    console.log(`✅ Second call completed: ${executedCount2} channels executed`)

    // Show change detection effects
    if (Array.isArray(result4b.payload)) {
      const throttledChannels = result4b.payload.filter(
        (r: CyreComposedResponse) =>
          r.message?.includes('throttle') || r.message?.includes('change')
      )

      if (throttledChannels.length > 0) {
        console.log('🔄 Change detection/throttling effects:')
        throttledChannels.forEach(channel => {
          console.log(`  - ${channel.channelName}: ${channel.message}`)
        })
      }
    }
  } catch (error) {
    console.log(`❌ Change detection test failed: ${error}`)
  }

  // ========================================
  // SCENARIO 5: Cross-Branch Composition
  // ========================================

  console.log('\n📋 SCENARIO 5: Cross-Branch Composition')
  console.log('==========================================')

  try {
    // Create a processing branch
    const processingBranch = useBranch(cyre, {
      id: 'processing-branch',
      path: 'processing'
    })

    // Create channel in branch
    const branchProcessorChannel = useCyre(processingBranch, {
      name: 'branch-processor',
      debug: true,
      priority: {level: 'medium', maxRetries: 3, timeout: 5000},
      transform: (userData: UserData) => ({
        ...userData,
        processedInBranch: true,
        branchPath: processingBranch.path
      })
    })

    // Set up branch channel handler
    branchProcessorChannel.on((userData: UserData) => {
      console.log(`  🌳 [BRANCH] Processing in branch: ${userData.name}`)
      return {
        ok: true,
        payload: userData,
        message: `Processed in branch: ${processingBranch.path}`
      }
    })

    // Create cross-branch composition
    const crossBranchComposition = cyreCompose(
      [
        validationChannel, // Main instance
        branchProcessorChannel, // Branch instance
        enrichmentChannel // Main instance
      ],
      {
        id: 'cross-branch-pipeline',
        debug: true,
        strategy: 'sequential',
        continueOnError: true,
        collectDetailedMetrics: true
      }
    )

    console.log('🌳 Executing cross-branch composition...')
    const result5 = await crossBranchComposition.call(validUser)

    console.log('\n📊 Cross-Branch Results:')
    if (Array.isArray(result5.payload)) {
      result5.payload.forEach(
        (channelResult: CyreComposedResponse, index: number) => {
          const status = channelResult.ok ? '✅' : '❌'
          const location = channelResult.channelId.includes('/processing/')
            ? '🌳 Branch'
            : '🔧 Main'
          const timing = channelResult.timing
            ? ` (${channelResult.timing.executionTime.toFixed(2)}ms)`
            : ''

          console.log(
            `  ${index + 1}. ${location} ${
              channelResult.channelName
            }: ${status} ${channelResult.ok ? 'Success' : 'Failed'}${timing}`
          )
          console.log(`     Channel ID: ${channelResult.channelId}`)
          console.log(`     Message: ${channelResult.message}`)
        }
      )
    }
  } catch (error) {
    console.log(`❌ Cross-branch composition failed: ${error}`)
  }

  // ========================================
  // Performance Analysis
  // ========================================

  console.log('\n📈 Performance Analysis')
  console.log('==============================')

  try {
    // Get system performance stats
    const systemHealth = cyre.getSystemHealth()
    const performanceState = cyre.getPerformanceState()

    // Calculate metrics
    const totalTime = performance.now()
    const systemStress = performanceState.stress * 100

    console.log(`• Total Processing Time: ${totalTime.toFixed(2)}ms`)
    console.log(`• System Stress: ${systemStress.toFixed(1)}%`)

    // Get channel stats
    console.log('\nIndividual Channel Performance:')

    const channels = [validationChannel, enrichmentChannel, notificationChannel]
    channels.forEach(channel => {
      try {
        const stats = channel.getStats()
        console.log(`• ${channel.name}:`)
        console.log(`  - Total Calls: ${stats.totalCalls}`)
        console.log(
          `  - Avg Execution: ${stats.averageExecutionTime.toFixed(2)}ms`
        )
        console.log(
          `  - Success Rate: ${(stats.successRate * 100).toFixed(1)}%`
        )
      } catch (error) {
        console.log(`• ${channel.name}: Stats unavailable`)
      }
    })

    console.log('\n✅ Demonstration completed successfully!')
    console.log(
      'Core system integration: ✅ All hooks aligned with action/talent pipeline'
    )
  } catch (error) {
    console.log(`❌ Performance analysis failed: ${error}`)
  }
}

// Export for testing
export {demonstrateUpdatedCyreCompose}

// Run demonstration
demonstrateUpdatedCyreCompose().catch(console.error)
