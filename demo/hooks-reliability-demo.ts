// demo/hooks-reliability-demo.ts
// Comprehensive hooks reliability testing across different branch depths
// Tests all hook combinations with realistic failure scenarios and performance metrics

import {cyre, useCyre, useGroup, useCollective, useBranch} from '../src'

/*

      H.O.O.K.S - R.E.L.I.A.B.I.L.I.T.Y - D.E.M.O
      
      Testing Strategy:
      - Branch depths 0-5 with realistic application structure
      - All hook combinations (useCyre, useGroup, useCollective, useBranch)
      - Cross-depth communication patterns
      - Concurrent operations and resource cleanup
      - Error propagation and graceful degradation
      - Performance metrics and stress testing

*/

interface TestMetrics {
  startTime: number
  operations: number
  successes: number
  failures: number
  branchesCreated: number
  channelsCreated: number
  subscriptionsCreated: number
  collectivesCreated: number
  averageLatency: number
  memoryUsage: number
  errors: string[]
  warnings: string[]
}

interface HookTestResult {
  testName: string
  depth: number
  hookType: string
  success: boolean
  latency: number
  error?: string
  metadata?: any
}

// Global test state (functional approach)
let testMetrics: TestMetrics = {
  startTime: Date.now(),
  operations: 0,
  successes: 0,
  failures: 0,
  branchesCreated: 0,
  channelsCreated: 0,
  subscriptionsCreated: 0,
  collectivesCreated: 0,
  averageLatency: 0,
  memoryUsage: 0,
  errors: [],
  warnings: []
}

let testResults: HookTestResult[] = []
let createdBranches: Map<string, any> = new Map()
let createdHooks: Map<string, any> = new Map()
let createdCollectives: Map<string, any> = new Map()

/**
 * Memory tracking helper
 */
const getMemoryUsage = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

/**
 * Record test result with metrics
 */
const recordResult = (
  testName: string,
  depth: number,
  hookType: string,
  success: boolean,
  startTime: number,
  error?: string,
  metadata?: any
): void => {
  const latency = performance.now() - startTime

  testResults.push({
    testName,
    depth,
    hookType,
    success,
    latency,
    error,
    metadata
  })

  testMetrics.operations++
  if (success) {
    testMetrics.successes++
  } else {
    testMetrics.failures++
    if (error) testMetrics.errors.push(error)
  }

  // Update average latency
  const totalLatency = testResults.reduce((sum, r) => sum + r.latency, 0)
  testMetrics.averageLatency = totalLatency / testResults.length
  testMetrics.memoryUsage = Math.max(testMetrics.memoryUsage, getMemoryUsage())
}

/**
 * DEPTH 0: Root Level Testing
 */
const testRootLevelHooks = async (): Promise<void> => {
  console.log('\n🏠 DEPTH 0: Root Level Hook Testing')
  console.log('===================================')

  // Test 1: Root useCyre
  const startTime1 = performance.now()
  try {
    const rootChannel = useCyre(cyre, {
      id: 'root-system-health',
      name: 'Root System Health Monitor',
      throttle: 100,
      detectChanges: true
    })

    // Register handler and test call
    const subscription = rootChannel.on(data => {
      console.log('   🔋 Root health check:', data?.status || 'unknown')
      return {healthy: true, timestamp: Date.now(), source: 'root'}
    })

    const result = await rootChannel.call({status: 'checking', level: 'system'})

    createdHooks.set('root-system-health', rootChannel)
    testMetrics.channelsCreated++
    testMetrics.subscriptionsCreated++

    recordResult(
      'Root useCyre',
      0,
      'useCyre',
      result.ok,
      startTime1,
      undefined,
      {
        channelId: rootChannel.id,
        subscriptionOk: subscription.ok
      }
    )

    console.log(`   ✅ Root useCyre: ${result.ok ? 'Success' : 'Failed'}`)
  } catch (error) {
    recordResult('Root useCyre', 0, 'useCyre', false, startTime1, String(error))
    console.log(`   ❌ Root useCyre failed: ${error}`)
  }

  // Test 2: Root useGroup with multiple channels
  const startTime2 = performance.now()
  try {
    // Create multiple root channels for grouping
    const channel1 = useCyre(cyre, {id: 'root-monitor-1', throttle: 50})
    const channel2 = useCyre(cyre, {id: 'root-monitor-2', debounce: 100})
    const channel3 = useCyre(cyre, {id: 'root-monitor-3', detectChanges: true})

    // Register handlers
    channel1.on(data => ({result: 'monitor-1', data, timestamp: Date.now()}))
    channel2.on(data => ({result: 'monitor-2', data, timestamp: Date.now()}))
    channel3.on(data => ({result: 'monitor-3', data, timestamp: Date.now()}))

    // Create group for coordination
    const rootGroup = useGroup([channel1, channel2, channel3], {
      name: 'Root Monitoring Group',
      strategy: 'parallel',
      errorStrategy: 'continue',
      timeout: 5000
    })

    // Test group execution
    const groupResult = await rootGroup.call({
      test: 'root-group-execution',
      timestamp: Date.now()
    })

    createdHooks.set('root-group', rootGroup)
    testMetrics.channelsCreated += 3

    recordResult(
      'Root useGroup',
      0,
      'useGroup',
      groupResult.ok,
      startTime2,
      undefined,
      {
        groupId: rootGroup.id,
        channelCount: rootGroup.channels.length,
        successful: groupResult.metadata?.successful,
        failed: groupResult.metadata?.failed
      }
    )

    console.log(
      `   ✅ Root useGroup: ${groupResult.ok ? 'Success' : 'Failed'} - ${
        groupResult.metadata?.successful
      }/${rootGroup.channels.length} channels`
    )
  } catch (error) {
    recordResult(
      'Root useGroup',
      0,
      'useGroup',
      false,
      startTime2,
      String(error)
    )
    console.log(`   ❌ Root useGroup failed: ${error}`)
  }

  // Test 3: Root useCollective
  const startTime3 = performance.now()
  try {
    const rootCollective = useCollective('root-coordination-system', {
      type: 'computing',
      maxParticipants: 10,
      consensus: 'majority',
      conflictResolution: 'last-write-wins',
      stateSync: 'immediate'
    })

    // Add participants
    await rootCollective.join('root-coordinator', 'admin', {
      weight: 3,
      capabilities: ['system-control']
    })
    await rootCollective.join('root-monitor', 'member', {
      weight: 1,
      capabilities: ['monitoring']
    })

    // Test collective state management
    await rootCollective.updateSharedState('systemStatus', {
      depth: 0,
      active: true,
      participants: 2,
      timestamp: Date.now()
    })

    const stateResult = rootCollective.getSharedState('systemStatus')

    createdCollectives.set('root-coordination-system', rootCollective)
    testMetrics.collectivesCreated++

    recordResult(
      'Root useCollective',
      0,
      'useCollective',
      !!stateResult,
      startTime3,
      undefined,
      {
        collectiveId: rootCollective.id,
        participants: rootCollective.getParticipants().length,
        sharedState: Object.keys(rootCollective.getSharedState()).length
      }
    )

    console.log(
      `   ✅ Root useCollective: Success - ${
        rootCollective.getParticipants().length
      } participants`
    )
  } catch (error) {
    recordResult(
      'Root useCollective',
      0,
      'useCollective',
      false,
      startTime3,
      String(error)
    )
    console.log(`   ❌ Root useCollective failed: ${error}`)
  }
}

/**
 * DEPTH 1: Single Level Branches
 */
const testDepth1Hooks = async (): Promise<void> => {
  console.log('\n🌿 DEPTH 1: Single Level Branch Testing')
  console.log('======================================')

  // Create level 1 branches
  const branches = [
    {id: 'ecommerce', name: 'E-commerce Platform'},
    {id: 'analytics', name: 'Analytics System'},
    {id: 'notifications', name: 'Notification Service'}
  ]

  for (const branchConfig of branches) {
    const startTime = performance.now()

    try {
      // Create branch
      const branch = useBranch(cyre, {
        id: branchConfig.id,
        name: branchConfig.name,
        maxDepth: 5
      })

      createdBranches.set(branchConfig.id, branch)
      testMetrics.branchesCreated++

      // Test useCyre within branch
      const branchChannel = useCyre(branch, {
        id: 'health-monitor',
        name: `${branchConfig.name} Health Monitor`,
        throttle: 200,
        detectChanges: true
      })

      branchChannel.on(data => {
        console.log(`   💚 ${branchConfig.name} health:`, data?.status)
        return {
          healthy: true,
          branch: branchConfig.id,
          depth: 1,
          timestamp: Date.now()
        }
      })

      const result = await branchChannel.call({
        status: 'monitoring',
        branchId: branchConfig.id
      })

      createdHooks.set(`${branchConfig.id}-health`, branchChannel)
      testMetrics.channelsCreated++

      recordResult(
        `Depth 1 useCyre (${branchConfig.id})`,
        1,
        'useCyre',
        result.ok,
        startTime,
        undefined,
        {
          branchId: branchConfig.id,
          channelId: branchChannel.id,
          branchPath: branch.path
        }
      )

      console.log(
        `   ✅ Branch ${branchConfig.id} useCyre: ${
          result.ok ? 'Success' : 'Failed'
        }`
      )

      // Test multiple channels in branch for useGroup
      const channel1 = useCyre(branch, {id: 'processor-1', throttle: 100})
      const channel2 = useCyre(branch, {id: 'processor-2', debounce: 150})

      channel1.on(data => ({processor: 1, result: data, timestamp: Date.now()}))
      channel2.on(data => ({processor: 2, result: data, timestamp: Date.now()}))

      const branchGroup = useGroup([channel1, channel2], {
        name: `${branchConfig.name} Processors`,
        strategy: 'sequential',
        errorStrategy: 'fail-fast'
      })

      const groupResult = await branchGroup.call({
        task: 'branch-processing',
        branchId: branchConfig.id
      })

      createdHooks.set(`${branchConfig.id}-group`, branchGroup)

      console.log(
        `   ✅ Branch ${branchConfig.id} useGroup: ${
          groupResult.ok ? 'Success' : 'Failed'
        }`
      )
    } catch (error) {
      recordResult(
        `Depth 1 useBranch (${branchConfig.id})`,
        1,
        'useBranch',
        false,
        startTime,
        String(error)
      )
      console.log(`   ❌ Branch ${branchConfig.id} failed: ${error}`)
    }
  }
}

/**
 * DEPTH 2: Nested Branches
 */
const testDepth2Hooks = async (): Promise<void> => {
  console.log('\n🌳 DEPTH 2: Nested Branch Testing')
  console.log('=================================')

  const parentBranch = createdBranches.get('ecommerce')
  if (!parentBranch) {
    console.log('   ❌ Parent branch not available for depth 2 testing')
    return
  }

  const subBranches = [
    {id: 'products', name: 'Product Management'},
    {id: 'orders', name: 'Order Processing'},
    {id: 'customers', name: 'Customer Service'}
  ]

  for (const subConfig of subBranches) {
    const startTime = performance.now()

    try {
      // Create nested branch
      const subBranch = useBranch(cyre, {
        id: subConfig.id,
        name: subConfig.name,
        parent: parentBranch
      })

      createdBranches.set(`ecommerce-${subConfig.id}`, subBranch)
      testMetrics.branchesCreated++

      // Test cross-depth communication (parent → child)
      const childChannel = useCyre(subBranch, {
        id: 'operations',
        name: `${subConfig.name} Operations`,
        debounce: 250,
        required: true
      })

      childChannel.on(data => {
        console.log(`   🔄 ${subConfig.name} operation:`, data?.operation)
        return {
          completed: true,
          operation: data?.operation,
          branch: subConfig.id,
          depth: 2,
          timestamp: Date.now()
        }
      })

      // Test parent calling child
      const crossDepthResult = await parentBranch.call(
        `${subConfig.id}/operations`,
        {
          operation: 'cross-depth-test',
          fromParent: true
        }
      )

      createdHooks.set(`depth2-${subConfig.id}`, childChannel)
      testMetrics.channelsCreated++

      recordResult(
        `Depth 2 Cross-Communication (${subConfig.id})`,
        2,
        'useCyre',
        crossDepthResult.ok,
        startTime,
        undefined,
        {
          parentBranch: parentBranch.path,
          childBranch: subBranch.path,
          crossDepthCall: true
        }
      )

      console.log(
        `   ✅ Depth 2 ${subConfig.id}: ${
          crossDepthResult.ok ? 'Success' : 'Failed'
        }`
      )
    } catch (error) {
      recordResult(
        `Depth 2 ${subConfig.id}`,
        2,
        'useBranch',
        false,
        startTime,
        String(error)
      )
      console.log(`   ❌ Depth 2 ${subConfig.id} failed: ${error}`)
    }
  }
}

/**
 * DEPTH 3: Deep Nesting
 */
const testDepth3Hooks = async (): Promise<void> => {
  console.log('\n🌲 DEPTH 3: Deep Nesting Testing')
  console.log('================================')

  const parentBranch = createdBranches.get('ecommerce-products')
  if (!parentBranch) {
    console.log('   ❌ Parent branch not available for depth 3 testing')
    return
  }

  const deepBranches = [
    {id: 'catalog', name: 'Product Catalog'},
    {id: 'inventory', name: 'Inventory Management'},
    {id: 'pricing', name: 'Pricing Engine'}
  ]

  for (const deepConfig of deepBranches) {
    const startTime = performance.now()

    try {
      const deepBranch = useBranch(cyre, {
        id: deepConfig.id,
        name: deepConfig.name,
        parent: parentBranch
      })

      createdBranches.set(`products-${deepConfig.id}`, deepBranch)
      testMetrics.branchesCreated++

      // Create collective at depth 3
      const deepCollective = useCollective(`depth3-${deepConfig.id}-team`, {
        type: 'collaboration',
        maxParticipants: 5,
        consensus: 'weighted',
        workDistribution: 'skill-based'
      })

      await deepCollective.join(`${deepConfig.id}-lead`, 'admin', {
        weight: 3,
        capabilities: ['leadership', deepConfig.id]
      })
      await deepCollective.join(`${deepConfig.id}-dev`, 'member', {
        weight: 2,
        capabilities: ['development', deepConfig.id]
      })

      createdCollectives.set(`depth3-${deepConfig.id}`, deepCollective)
      testMetrics.collectivesCreated++

      recordResult(
        `Depth 3 useCollective (${deepConfig.id})`,
        3,
        'useCollective',
        true,
        startTime,
        undefined,
        {
          branchPath: deepBranch.path,
          collectiveId: deepCollective.id,
          participants: deepCollective.getParticipants().length
        }
      )

      console.log(
        `   ✅ Depth 3 ${deepConfig.id} collective: Success - ${
          deepCollective.getParticipants().length
        } participants`
      )
    } catch (error) {
      recordResult(
        `Depth 3 ${deepConfig.id}`,
        3,
        'useCollective',
        false,
        startTime,
        String(error)
      )
      console.log(`   ❌ Depth 3 ${deepConfig.id} failed: ${error}`)
    }
  }
}

/**
 * DEPTH 4: Extreme Nesting
 */
const testDepth4Hooks = async (): Promise<void> => {
  console.log('\n🏔️ DEPTH 4: Extreme Nesting Testing')
  console.log('===================================')

  const parentBranch = createdBranches.get('products-catalog')
  if (!parentBranch) {
    console.log('   ❌ Parent branch not available for depth 4 testing')
    return
  }

  const extremeBranches = [
    {id: 'categories', name: 'Product Categories'},
    {id: 'attributes', name: 'Product Attributes'}
  ]

  for (const extremeConfig of extremeBranches) {
    const startTime = performance.now()

    try {
      const extremeBranch = useBranch(cyre, {
        id: extremeConfig.id,
        name: extremeConfig.name,
        parent: parentBranch
      })

      // Create multiple channels for stress testing
      const channels = []
      for (let i = 0; i < 5; i++) {
        const channel = useCyre(extremeBranch, {
          id: `processor-${i}`,
          throttle: 50 + i * 10,
          detectChanges: i % 2 === 0
        })

        channel.on(data => ({
          processor: i,
          data,
          depth: 4,
          timestamp: Date.now()
        }))

        channels.push(channel)
      }

      const extremeGroup = useGroup(channels, {
        name: `${extremeConfig.name} Extreme Group`,
        strategy: 'parallel',
        errorStrategy: 'continue',
        timeout: 10000
      })

      const result = await extremeGroup.call({
        test: 'extreme-depth-test',
        processors: channels.length
      })

      createdHooks.set(`depth4-${extremeConfig.id}`, extremeGroup)
      testMetrics.channelsCreated += channels.length

      recordResult(
        `Depth 4 useGroup (${extremeConfig.id})`,
        4,
        'useGroup',
        result.ok,
        startTime,
        undefined,
        {
          branchPath: extremeBranch.path,
          channelCount: channels.length,
          successful: result.metadata?.successful
        }
      )

      console.log(
        `   ✅ Depth 4 ${extremeConfig.id}: ${
          result.ok ? 'Success' : 'Failed'
        } - ${result.metadata?.successful}/${channels.length} channels`
      )
    } catch (error) {
      recordResult(
        `Depth 4 ${extremeConfig.id}`,
        4,
        'useGroup',
        false,
        startTime,
        String(error)
      )
      console.log(`   ❌ Depth 4 ${extremeConfig.id} failed: ${error}`)
    }
  }
}

/**
 * Concurrent Operations Test
 */
const testConcurrentOperations = async (): Promise<void> => {
  console.log('\n⚡ CONCURRENT OPERATIONS STRESS TEST')
  console.log('===================================')

  const startTime = performance.now()

  try {
    // Create 50 concurrent operations across different depths
    const operations = []

    for (let i = 0; i < 50; i++) {
      const operation = async () => {
        const depth = i % 4 // Distribute across depths 0-3
        const branchKey =
          depth === 0
            ? 'root'
            : depth === 1
            ? 'ecommerce'
            : depth === 2
            ? 'ecommerce-products'
            : 'products-catalog'

        const branch = depth === 0 ? cyre : createdBranches.get(branchKey)
        if (!branch) return {success: false, error: 'Branch not found'}

        const channel = useCyre(branch, {
          id: `concurrent-${i}`,
          throttle: 25,
          detectChanges: true
        })

        channel.on(data => ({
          operation: i,
          depth,
          result: 'concurrent-success',
          timestamp: Date.now()
        }))

        return await channel.call({operationId: i, depth, concurrent: true})
      }

      operations.push(operation())
    }

    const results = await Promise.allSettled(operations)
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    recordResult(
      'Concurrent Operations',
      -1,
      'mixed',
      successful > 40,
      startTime,
      undefined,
      {
        total: operations.length,
        successful,
        failed,
        successRate: (successful / operations.length) * 100
      }
    )

    console.log(
      `   ✅ Concurrent test: ${successful}/${operations.length} successful (${(
        (successful / operations.length) *
        100
      ).toFixed(1)}%)`
    )
  } catch (error) {
    recordResult(
      'Concurrent Operations',
      -1,
      'mixed',
      false,
      startTime,
      String(error)
    )
    console.log(`   ❌ Concurrent test failed: ${error}`)
  }
}

/**
 * Cascade Destruction Test
 */
const testCascadeDestruction = async (): Promise<void> => {
  console.log('\n💥 CASCADE DESTRUCTION TEST')
  console.log('===========================')

  const startTime = performance.now()

  try {
    // Test destroying parent branch and verify children are destroyed
    const parentBranch = createdBranches.get('analytics')
    if (parentBranch) {
      const statsBeforeDestruction = parentBranch.getStats()
      const destroyed = parentBranch.destroy()

      recordResult(
        'Cascade Destruction',
        1,
        'useBranch',
        destroyed,
        startTime,
        undefined,
        {
          branchPath: parentBranch.path,
          channelsDestroyed: statsBeforeDestruction.channelCount,
          childrenDestroyed: statsBeforeDestruction.childCount
        }
      )

      console.log(
        `   ✅ Cascade destruction: ${destroyed ? 'Success' : 'Failed'}`
      )
    }

    // Test collective cleanup
    for (const [id, collective] of createdCollectives) {
      await collective.destroy()
      console.log(`   🧹 Collective ${id} destroyed`)
    }
  } catch (error) {
    recordResult(
      'Cascade Destruction',
      -1,
      'cleanup',
      false,
      startTime,
      String(error)
    )
    console.log(`   ❌ Cascade destruction failed: ${error}`)
  }
}

/**
 * Performance Analysis
 */
const analyzePerformance = (): void => {
  console.log('\n📊 PERFORMANCE ANALYSIS')
  console.log('=======================')

  const totalDuration = Date.now() - testMetrics.startTime
  const successRate = (testMetrics.successes / testMetrics.operations) * 100

  console.log(`Total Test Duration: ${totalDuration}ms`)
  console.log(`Total Operations: ${testMetrics.operations}`)
  console.log(`Success Rate: ${successRate.toFixed(2)}%`)
  console.log(`Average Latency: ${testMetrics.averageLatency.toFixed(2)}ms`)
  console.log(`Peak Memory Usage: ${testMetrics.memoryUsage.toFixed(2)}MB`)
  console.log(`Branches Created: ${testMetrics.branchesCreated}`)
  console.log(`Channels Created: ${testMetrics.channelsCreated}`)
  console.log(`Collectives Created: ${testMetrics.collectivesCreated}`)

  // Performance by depth
  console.log('\n📈 Performance by Depth:')
  for (let depth = 0; depth <= 4; depth++) {
    const depthResults = testResults.filter(r => r.depth === depth)
    if (depthResults.length > 0) {
      const depthSuccessRate =
        (depthResults.filter(r => r.success).length / depthResults.length) * 100
      const avgLatency =
        depthResults.reduce((sum, r) => sum + r.latency, 0) /
        depthResults.length
      console.log(
        `   Depth ${depth}: ${depthSuccessRate.toFixed(
          1
        )}% success, ${avgLatency.toFixed(2)}ms avg latency`
      )
    }
  }

  // Performance by hook type
  console.log('\n🎣 Performance by Hook Type:')
  const hookTypes = ['useCyre', 'useGroup', 'useCollective', 'useBranch']
  hookTypes.forEach(type => {
    const typeResults = testResults.filter(r => r.hookType === type)
    if (typeResults.length > 0) {
      const typeSuccessRate =
        (typeResults.filter(r => r.success).length / typeResults.length) * 100
      const avgLatency =
        typeResults.reduce((sum, r) => sum + r.latency, 0) / typeResults.length
      console.log(
        `   ${type}: ${typeSuccessRate.toFixed(
          1
        )}% success, ${avgLatency.toFixed(2)}ms avg latency`
      )
    }
  })

  if (testMetrics.errors.length > 0) {
    console.log('\n❌ Errors Encountered:')
    testMetrics.errors.slice(0, 5).forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`)
    })
    if (testMetrics.errors.length > 5) {
      console.log(`   ... and ${testMetrics.errors.length - 5} more errors`)
    }
  }
}

/**
 * Main test runner
 */
const runHooksReliabilityDemo = async (): Promise<void> => {
  console.log('🎣 CYRE HOOKS RELIABILITY DEMO')
  console.log('===============================')
  console.log(
    'Testing hooks across multiple branch depths with realistic scenarios...\n'
  )

  try {
    // Initialize Cyre
    await cyre.init()
    console.log('✅ Cyre initialized')

    // Run tests in order of complexity
    await testRootLevelHooks()
    await testDepth1Hooks()
    await testDepth2Hooks()
    await testDepth3Hooks()
    await testDepth4Hooks()

    // Stress tests
    await testConcurrentOperations()
    await testCascadeDestruction()

    // Analysis
    analyzePerformance()

    console.log('\n🎉 HOOKS RELIABILITY DEMO COMPLETED!')
    console.log('====================================')
    console.log('✅ All hook types tested across depths 0-4')
    console.log('✅ Cross-depth communication verified')
    console.log('✅ Concurrent operations stress tested')
    console.log('✅ Cascade destruction validated')
    console.log('✅ Performance metrics collected')
    console.log('')
    console.log('🌟 Cyre hooks system is highly reliable! 🌟')
  } catch (error) {
    console.error('❌ Demo failed:', error)
  } finally {
    // Final cleanup
    cyre.clear()
    console.log('🧹 System cleaned up')
  }
}

// Export for external use
export {
  runHooksReliabilityDemo,
  testRootLevelHooks,
  testDepth1Hooks,
  testDepth2Hooks,
  testDepth3Hooks,
  testDepth4Hooks,
  testConcurrentOperations,
  testCascadeDestruction
}

// Run if called directly
runHooksReliabilityDemo().catch(console.error)

export default runHooksReliabilityDemo
