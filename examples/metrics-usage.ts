// examples/metrics-usage.ts
// Updated examples using the new unified metrics system

import {cyre} from '../src'
import {sensor} from '../src/metrics'

/*

      C.Y.R.E - M.E.T.R.I.C.S - U.S.A.G.E - U.P.D.A.T.E.D
      
      Updated examples for unified metrics system:
      - Clear distinction between log types and event types
      - Log types: critical, error, warning, info, success
      - Event types: call, execution, throttle, debounce, skip, blocked
      - Comprehensive demonstration of new API

*/

async function demonstrateUnifiedMetricsSystem() {
  console.log('🚀 CYRE Unified Metrics System Demonstration')
  console.log('=' + '='.repeat(50))

  // Initialize Cyre with new metrics system
  await cyre.initialize()
  cyre.clear()

  // Set up test channels with various configurations
  console.log('\n📋 Setting up test channels...')

  // Fast, reliable channel
  cyre.action({
    id: 'fast-channel',
    throttle: 50
  })
  cyre.on('fast-channel', payload => {
    // Log success for completed processing
    sensor.success('fast-channel', 'on-handler', {
      processed: true,
      payload: payload
    })
    return {processed: payload, timestamp: Date.now()}
  })

  // Slow channel with errors and debouncing
  cyre.action({
    id: 'slow-channel',
    debounce: 100
  })
  cyre.on('slow-channel', payload => {
    // Simulate slow processing with potential errors
    const delay = Math.random() * 200

    if (Math.random() < 0.1) {
      // Log error (log type) when processing fails
      sensor.error('slow-channel', 'Random processing error', 'on-handler')
      throw new Error('Random processing error')
    }

    // Log info about processing time
    if (delay > 150) {
      sensor.warning('slow-channel', 'Slow processing detected', 'on-handler')
    }

    return {processed: payload, delay}
  })

  // High-traffic channel with validation
  cyre.action({
    id: 'high-traffic-channel',
    detectChanges: true,
    required: true
  })
  cyre.on('high-traffic-channel', payload => {
    if (!payload || payload.value > 100) {
      // Log critical error for validation failures
      sensor.critical(
        'high-traffic-channel',
        'Validation failed: value too high',
        'validation'
      )
      throw new Error('Value too high')
    }

    // Log info for successful processing
    sensor.info('high-traffic-channel', 'processing', {
      value: payload.value,
      result: payload.value * 2
    })

    return {result: payload.value * 2}
  })

  // Critical system channel
  cyre.action({
    id: 'critical-system',
    priority: {level: 'critical'},
    required: true
  })
  cyre.on('critical-system', payload => {
    if (!payload.systemCheck) {
      // Log critical system failure
      sensor.critical(
        'critical-system',
        'System check failed',
        'system-validation'
      )
      throw new Error('System check failed')
    }

    // Log success for system check
    sensor.success('critical-system', 'system-check', {
      status: 'healthy',
      timestamp: Date.now()
    })

    return {status: 'ok', timestamp: Date.now()}
  })

  console.log('✅ Test channels configured')

  // ========================================
  // 1. DEMONSTRATE LOG TYPES VS EVENT TYPES
  // ========================================
  console.log('\n📝 1. LOG TYPES vs EVENT TYPES DEMONSTRATION')
  console.log('-'.repeat(50))

  console.log('Making calls to demonstrate different logging scenarios...')

  // This will generate:
  // - call event (automatically by system)
  // - execution event (automatically by system)
  // - success log (manually by handler)
  await cyre.call('fast-channel', {data: 'test-1'})

  // This might generate:
  // - call event
  // - debounce event (if called rapidly)
  // - execution event
  // - warning log (if slow) OR error log (if fails)
  await cyre.call('slow-channel', {data: 'test-1'})
  await cyre.call('slow-channel', {data: 'test-2'}) // Might be debounced

  // This will generate:
  // - call event
  // - skip event (if detectChanges and no change)
  // - critical log (if validation fails)
  try {
    await cyre.call('high-traffic-channel', {value: 150}) // Will fail validation
  } catch (error) {
    console.log('Expected validation error logged as critical')
  }

  console.log('\n📊 Event vs Log Type Summary:')
  console.log('Event Types (system-generated):')
  console.log('  • call - when cyre.call() is invoked')
  console.log('  • execution - when handler completes')
  console.log('  • throttle - when call is throttled')
  console.log('  • debounce - when call is debounced')
  console.log('  • skip - when change detection skips call')
  console.log('  • blocked - when call is blocked by protection')
  console.log('')
  console.log('Log Types (manually recorded):')
  console.log('  • critical - system failures, validation errors')
  console.log('  • error - processing errors, exceptions')
  console.log('  • warning - performance issues, degradation')
  console.log('  • info - general information, processing notes')
  console.log('  • success - successful operations, completions')

  // ========================================
  // 2. BASIC HEALTH CHECK
  // ========================================
  console.log('\n🏥 2. HEALTH CHECK WITH NEW SYSTEM')
  console.log('-'.repeat(40))

  const health = cyre.metrics.healthCheck()
  console.log(`System health: ${health.status} (${health.score}/100)`)

  // ========================================
  // 3. GENERATE VARIED ACTIVITY
  // ========================================
  console.log('\n🔄 3. GENERATING VARIED ACTIVITY')
  console.log('-'.repeat(35))

  for (let i = 0; i < 30; i++) {
    // Fast channel calls (some will be throttled)
    await cyre.call('fast-channel', {data: `batch-${i}`})

    // Slow channel calls (some will be debounced)
    if (i % 2 === 0) {
      await cyre.call('slow-channel', {data: `slow-${i}`})
    }

    // High traffic with mix of valid/invalid
    if (i % 5 === 0) {
      try {
        const value = Math.floor(Math.random() * 200) // Some will exceed 100
        await cyre.call('high-traffic-channel', {value})
      } catch (error) {
        // Expected for values > 100
      }
    }

    // Critical system checks
    if (i % 10 === 0) {
      try {
        await cyre.call('critical-system', {
          systemCheck: Math.random() > 0.2 // 80% success rate
        })
      } catch (error) {
        // Expected 20% failure rate
      }
    }

    // Small delay to allow protections to work
    if (i % 3 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  console.log('✅ Activity generation completed')

  // ========================================
  // 4. COMPREHENSIVE METRICS REPORT
  // ========================================
  console.log('\n📊 4. UNIFIED METRICS REPORT')
  console.log('-'.repeat(35))

  // Generate report with new system
  cyre.metrics.report()

  // ========================================
  // 5. CHANNEL-SPECIFIC ANALYSIS
  // ========================================
  console.log('\n🔍 5. CHANNEL ANALYSIS')
  console.log('-'.repeat(25))

  console.log('Analyzing each channel with new system:')
  cyre.metrics.analyzeChannel('fast-channel')
  cyre.metrics.analyzeChannel('slow-channel')
  cyre.metrics.analyzeChannel('high-traffic-channel')
  cyre.metrics.analyzeChannel('critical-system')

  // ========================================
  // 6. DEVELOPMENT TOOLS
  // ========================================
  console.log('\n🛠️  6. SIMPLIFIED DEV TOOLS')
  console.log('-'.repeat(30))

  // Quick diagnostic
  cyre.dev.diagnose()

  // Channel comparison
  console.log('\nComparing channel performance:')
  cyre.dev.compareChannels([
    'fast-channel',
    'slow-channel',
    'high-traffic-channel'
  ])

  // ========================================
  // 7. STRESS TESTING
  // ========================================
  console.log('\n🧪 7. STRESS TESTING')
  console.log('-'.repeat(25))

  console.log('Running stress test on fast-channel...')
  const stressResults = await cyre.dev.stressTest('fast-channel', 50, 3)

  console.log(
    `Stress test completed: ${stressResults.successRate * 100}% success rate`
  )

  // ========================================
  // 8. LIVE MONITORING DEMO
  // ========================================
  console.log('\n📡 8. LIVE MONITORING (10 seconds)')
  console.log('-'.repeat(40))

  const stopMonitoring = cyre.metrics.startLiveMonitoring(3000)

  // Generate activity during monitoring
  const activityInterval = setInterval(async () => {
    await cyre.call('fast-channel', {monitoring: true, timestamp: Date.now()})

    // Occasionally cause issues to demonstrate alerting
    if (Math.random() < 0.3) {
      try {
        await cyre.call('high-traffic-channel', {value: 250}) // Will fail
      } catch (error) {
        // Expected
      }
    }
  }, 800)

  // Stop monitoring after 10 seconds
  setTimeout(() => {
    clearInterval(activityInterval)
    stopMonitoring()
    continueAdvancedDemo()
  }, 10000)
}

async function continueAdvancedDemo() {
  // ========================================
  // 9. METRIC WATCHING
  // ========================================
  console.log('\n👀 9. METRIC WATCHING (15 seconds)')
  console.log('-'.repeat(35))

  // Watch success rate with threshold
  const stopWatching = cyre.metrics.watchMetric('successRate', 0.85)

  // Generate varied activity to trigger metric changes
  let callCounter = 0
  const variedActivity = setInterval(async () => {
    callCounter++

    // Mix of successful and failing calls
    await cyre.call('fast-channel', {data: `watch-${callCounter}`})

    if (callCounter % 4 === 0) {
      try {
        // This will sometimes fail and affect success rate
        await cyre.call('high-traffic-channel', {
          value: Math.random() > 0.5 ? 50 : 150 // 50% failure rate
        })
      } catch (error) {
        // Expected failures
      }
    }
  }, 1000)

  setTimeout(() => {
    clearInterval(variedActivity)
    stopWatching()
    finalizeDemo()
  }, 15000)
}

function finalizeDemo() {
  // ========================================
  // 10. ADVANCED ANALYSIS
  // ========================================
  console.log('\n🔬 10. ADVANCED ANALYSIS')
  console.log('-'.repeat(30))

  // Performance snapshot
  const snapshot = cyre.metrics.snapshot()

  // Export raw data
  const analysis = cyre.metrics.exportData()
  console.log(`\nRaw analysis summary:`)
  console.log(`  • Total channels: ${analysis.channels.length}`)
  console.log(`  • Total alerts: ${analysis.alerts.length}`)
  console.log(`  • System health: ${analysis.health.overall}`)
  console.log(`  • Recommendations: ${analysis.recommendations.length}`)

  // ========================================
  // 11. CHANNEL INSPECTION
  // ========================================
  console.log('\n🔍 11. DETAILED CHANNEL INSPECTION')
  console.log('-'.repeat(40))

  console.log('Inspecting slow-channel configuration and performance:')
  cyre.dev.inspect('slow-channel')

  // ========================================
  // 12. FINAL HEALTH CHECK
  // ========================================
  console.log('\n🏁 12. FINAL SYSTEM STATUS')
  console.log('-'.repeat(30))

  const finalHealth = cyre.metrics.healthCheck()
  cyre.dev.overview()

  console.log('\n🎉 UNIFIED METRICS DEMONSTRATION COMPLETED!')
  console.log('=' + '='.repeat(50))

  // Show usage patterns
  showUsagePatterns()
}

function showUsagePatterns() {
  console.log('\n📚 USAGE PATTERNS FOR NEW SYSTEM')
  console.log('=' + '='.repeat(40))

  console.log('\n✅ New unified metrics system provides:')
  console.log('   • Single source of truth for all metrics')
  console.log('   • Clear separation between log types and event types')
  console.log('   • Simplified API with better performance')
  console.log('   • Enhanced development tools')
  console.log('   • Memory efficient with automatic cleanup')
  console.log('   • Type-safe interfaces throughout')
}

// Run the demonstration
demonstrateUnifiedMetricsSystem().catch(console.error)
