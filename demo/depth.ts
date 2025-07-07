// 6. Test branch statistics// demo/multi-depth-branch-demo.ts
// Multi-depth branch system testing channel IDs, paths, and call functionality
// NOW WITH useCyre INTEGRATION TESTING

import {cyre, useBranch, useCyre} from '../src'

/**
 * 🌳 MULTI-DEPTH BRANCH TESTING SYSTEM
 *
 * Tests:
 * - Channel ID consistency across depths
 * - Local ID vs Global ID handling
 * - Path resolution at each level
 * - Call functionality between depths
 * - Payload routing verification
 *
 * Structure:
 * cyre (root - path: "")
 * └── company (depth: 1 - path: "company")
 *     └── division (depth: 2 - path: "company/division")
 *         └── department (depth: 3 - path: "company/division/department")
 *             └── team (depth: 4 - path: "company/division/department/team")
 *                 └── project (depth: 5 - path: "company/division/department/team/project")
 */

interface ChannelTestResult {
  channelId: string
  localId: string
  branchPath: string
  depth: number
  actionResult: {ok: boolean; message: string}
  subscriptionResult: {ok: boolean; message: string}
  callResult?: {ok: boolean; payload: any; message: string}
  payloadMatch: boolean
  pathMatch: boolean
  timestamp: number
  // NEW: useCyre testing results
  useCyreTest?: {
    created: boolean
    globalId: string
    stats: any
    callSuccess: boolean
    hookCallTime: number
  }
}

interface DepthTestSuite {
  depth: number
  branchId: string
  branchPath: string
  channels: ChannelTestResult[]
  crossDepthCalls: {
    from: string
    to: string
    success: boolean
    payload: any
    error?: string
  }[]
}

// ========================================
// MULTI-DEPTH BRANCH CREATION
// ========================================

export const createMultiDepthBranchSystem = async () => {
  console.log('🌳 Creating Multi-Depth Branch System...')

  // Initialize Cyre
  const initResult = await cyre.init()
  if (!initResult.ok) {
    throw new Error(`Failed to initialize Cyre: ${initResult.message}`)
  }

  console.log(`✅ Cyre initialized - Root path: "${cyre.path()}"`)

  // DEPTH 1: Company Level
  const company = useBranch(cyre, {
    id: 'company',
    name: 'Acme Corporation'
  })

  if (!company) {
    throw new Error('Failed to create company branch')
  }

  console.log(`✅ Company branch created - Path: "${company.path()}"`)

  // DEPTH 2: Division Level
  const division = useBranch(company, {
    id: 'division',
    name: 'Technology Division'
  })

  if (!division) {
    throw new Error('Failed to create division branch')
  }

  console.log(`✅ Division branch created - Path: "${division.path()}"`)

  // DEPTH 3: Department Level
  const department = useBranch(division, {
    id: 'department',
    name: 'Software Engineering Department'
  })

  if (!department) {
    throw new Error('Failed to create department branch')
  }

  console.log(`✅ Department branch created - Path: "${department.path()}"`)

  // DEPTH 4: Team Level
  const team = useBranch(department, {
    id: 'team',
    name: 'Backend Development Team'
  })

  if (!team) {
    throw new Error('Failed to create team branch')
  }

  console.log(`✅ Team branch created - Path: "${team.path()}"`)

  // DEPTH 5: Project Level
  const project = useBranch(team, {
    id: 'project',
    name: 'Cyre Framework Project'
  })

  if (!project) {
    throw new Error('Failed to create project branch')
  }

  console.log(`✅ Project branch created - Path: "${project.path()}"`)

  return {
    root: cyre,
    company,
    division,
    department,
    team,
    project,
    hierarchy: [
      {name: 'root', instance: cyre, depth: 0, path: cyre.path()},
      {name: 'company', instance: company, depth: 1, path: company.path()},
      {name: 'division', instance: division, depth: 2, path: division.path()},
      {
        name: 'department',
        instance: department,
        depth: 3,
        path: department.path()
      },
      {name: 'team', instance: team, depth: 4, path: team.path()},
      {name: 'project', instance: project, depth: 5, path: project.path()}
    ]
  }
}

// ========================================
// CHANNEL TESTING AT EACH DEPTH
// ========================================

export const testChannelsAtEachDepth = async (
  branchSystem: any
): Promise<DepthTestSuite[]> => {
  console.log('\n🔍 Testing Channels at Each Depth...')

  const testSuites: DepthTestSuite[] = []

  for (const level of branchSystem.hierarchy) {
    console.log(
      `\n📍 Testing Depth ${level.depth}: ${level.name} (path: "${level.path}")`
    )

    const testSuite: DepthTestSuite = {
      depth: level.depth,
      branchId: level.name,
      branchPath: level.path,
      channels: [],
      crossDepthCalls: []
    }

    // Test multiple channels at this depth
    const channelTests = [
      {
        localId: 'status-monitor',
        expectedPayload: {
          status: 'active',
          level: level.name,
          depth: level.depth
        }
      },
      {
        localId: 'data-processor',
        expectedPayload: {
          processor: 'online',
          branch: level.name,
          timestamp: Date.now()
        }
      },
      {
        localId: 'health-checker',
        expectedPayload: {
          health: 'good',
          location: level.path,
          depth: level.depth
        }
      }
    ]

    for (const channelTest of channelTests) {
      const channelResult = await testSingleChannel(
        level.instance,
        level.name,
        level.path,
        level.depth,
        channelTest.localId,
        channelTest.expectedPayload
      )

      testSuite.channels.push(channelResult)
    }

    testSuites.push(testSuite)
  }

  return testSuites
}

// ========================================
// SINGLE CHANNEL TESTING
// ========================================

const testSingleChannel = async (
  branchInstance: any,
  branchName: string,
  branchPath: string,
  depth: number,
  localId: string,
  expectedPayload: any
): Promise<ChannelTestResult> => {
  console.log(`  🔧 Testing channel "${localId}" at depth ${depth}...`)

  const testResult: ChannelTestResult = {
    channelId: localId,
    localId,
    branchPath,
    depth,
    actionResult: {ok: false, message: ''},
    subscriptionResult: {ok: false, message: ''},
    payloadMatch: false,
    pathMatch: false,
    timestamp: Date.now()
  }

  try {
    // 1. CREATE ACTION/CHANNEL
    const actionResult = branchInstance.action({
      id: localId,
      payload: expectedPayload,
      throttle: 100, // Prevent rapid calls during testing
      detectChanges: true
    })

    testResult.actionResult = actionResult
    console.log(`    ✅ Action created: ${actionResult.message}`)

    if (!actionResult.ok) {
      return testResult
    }

    // 2. CREATE SUBSCRIPTION
    const subscriptionResult = branchInstance.on(
      localId,
      (receivedPayload: any) => {
        console.log(
          `    📨 Handler called for "${localId}" with:`,
          receivedPayload
        )

        return {
          handlerResponse: 'processed',
          receivedAt: Date.now(),
          branchName,
          branchPath,
          depth,
          originalPayload: receivedPayload,
          channelId: localId,
          processingTime: Math.random() * 10 + 1 // 1-11ms
        }
      }
    )

    testResult.subscriptionResult = subscriptionResult
    console.log(`    ✅ Subscription created: ${subscriptionResult.message}`)

    if (!subscriptionResult.ok) {
      return testResult
    }

    // 3. TEST CALL FUNCTIONALITY
    const callPayload = {
      ...expectedPayload,
      callTime: Date.now(),
      testId: `test-${depth}-${localId}`
    }

    const callResult = await branchInstance.call(localId, callPayload)
    testResult.callResult = callResult

    if (callResult.ok) {
      console.log(`    ✅ Call successful:`, callResult.payload.handlerResponse)

      // 4. VERIFY PAYLOAD MATCHING
      testResult.payloadMatch =
        callResult.payload.originalPayload?.testId === callPayload.testId &&
        callResult.payload.channelId === localId

      // 5. VERIFY PATH MATCHING
      testResult.pathMatch =
        callResult.payload.branchPath === branchPath &&
        callResult.payload.depth === depth

      console.log(
        `    📊 Payload match: ${testResult.payloadMatch ? '✅' : '❌'}`
      )
      console.log(`    📊 Path match: ${testResult.pathMatch ? '✅' : '❌'}`)
    } else {
      console.log(`    ❌ Call failed: ${callResult.message}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`    ❌ Channel test error: ${errorMessage}`)
    testResult.actionResult.message = errorMessage
  }

  return testResult
}

// ========================================
// CROSS-DEPTH CALL TESTING
// ========================================

export const testCrossDepthCalls = async (
  branchSystem: any
): Promise<any[]> => {
  console.log('\n🔄 Testing Cross-Depth Calls...')

  const crossDepthResults: any[] = []

  // Test Parent → Child calls (allowed in React-like pattern)
  console.log('\n👥 Testing Parent → Child calls (should work)...')

  const parentChildTests = [
    {
      from: {name: 'root', instance: branchSystem.root},
      to: {name: 'company', channelId: 'status-monitor'},
      payload: {command: 'status_check', from: 'root'}
    },
    {
      from: {name: 'company', instance: branchSystem.company},
      to: {name: 'division', channelId: 'data-processor'},
      payload: {command: 'process_data', from: 'company'}
    },
    {
      from: {name: 'division', instance: branchSystem.division},
      to: {name: 'department', channelId: 'health-checker'},
      payload: {command: 'health_check', from: 'division'}
    },
    {
      from: {name: 'department', instance: branchSystem.department},
      to: {name: 'team', channelId: 'status-monitor'},
      payload: {command: 'team_status', from: 'department'}
    },
    {
      from: {name: 'team', instance: branchSystem.team},
      to: {name: 'project', channelId: 'data-processor'},
      payload: {command: 'project_update', from: 'team'}
    }
  ]

  for (const test of parentChildTests) {
    try {
      console.log(
        `  🔄 ${test.from.name} → ${test.to.name}:${test.to.channelId}`
      )

      const callResult = await test.from.instance.call(
        test.to.channelId,
        test.payload
      )

      const result = {
        type: 'parent_to_child',
        from: test.from.name,
        to: test.to.name,
        channelId: test.to.channelId,
        success: callResult.ok,
        payload: callResult.payload,
        message: callResult.message,
        error: callResult.ok ? null : callResult.message
      }

      crossDepthResults.push(result)

      if (callResult.ok) {
        console.log(`    ✅ Success: ${callResult.payload?.handlerResponse}`)
      } else {
        console.log(`    ❌ Failed: ${callResult.message}`)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.log(`    ❌ Error: ${errorMessage}`)

      crossDepthResults.push({
        type: 'parent_to_child',
        from: test.from.name,
        to: test.to.name,
        channelId: test.to.channelId,
        success: false,
        error: errorMessage
      })
    }
  }

  // Test deep calls (root → project)
  console.log('\n🏃‍♂️ Testing Deep Calls (root → project)...')

  try {
    const deepCallResult = await branchSystem.root.call('health-checker', {
      command: 'deep_health_check',
      from: 'root',
      target: 'project',
      depth: 5
    })

    const deepResult = {
      type: 'deep_call',
      from: 'root',
      to: 'project',
      channelId: 'health-checker',
      success: deepCallResult.ok,
      payload: deepCallResult.payload,
      message: deepCallResult.message
    }

    crossDepthResults.push(deepResult)

    if (deepCallResult.ok) {
      console.log(
        `  ✅ Deep call success: Reached depth ${deepCallResult.payload?.depth}`
      )
    } else {
      console.log(`  ❌ Deep call failed: ${deepCallResult.message}`)
    }
  } catch (error) {
    console.log(`  ❌ Deep call error: ${error}`)
  }

  return crossDepthResults
}

// ========================================
// COMPREHENSIVE VERIFICATION
// ========================================

export const verifySystemIntegrity = async (
  branchSystem: any,
  testSuites: DepthTestSuite[],
  crossDepthResults: any[]
): Promise<any> => {
  console.log('\n🔍 Verifying System Integrity...')

  const verification = {
    branchCreation: {
      totalBranches: branchSystem.hierarchy.length,
      successfulBranches: branchSystem.hierarchy.filter((h: any) => h.instance)
        .length,
      pathConsistency: true,
      depthConsistency: true
    },
    channelTesting: {
      totalChannels: 0,
      successfulChannels: 0,
      payloadMatches: 0,
      pathMatches: 0,
      callSuccesses: 0
    },
    // NEW: useCyre testing metrics
    useCyreTesting: {
      totalHookTests: 0,
      successfulHooks: 0,
      hookCallSuccesses: 0,
      averageHookPerformance: 0,
      globalIdMatches: 0
    },
    crossDepthCalls: {
      totalTests: crossDepthResults.length,
      successful: crossDepthResults.filter(r => r.success).length,
      parentChildSuccess: crossDepthResults.filter(
        r => r.type === 'parent_to_child' && r.success
      ).length,
      deepCallSuccess: crossDepthResults.filter(
        r => r.type === 'deep_call' && r.success
      ).length
    },
    systemMetrics: {}
  }

  // Verify branch paths
  for (let i = 0; i < branchSystem.hierarchy.length; i++) {
    const level = branchSystem.hierarchy[i]
    const expectedDepth = i
    const expectedPath =
      i === 0
        ? ''
        : branchSystem.hierarchy
            .slice(1, i + 1)
            .map((l: any) => l.name)
            .join('/')

    if (level.depth !== expectedDepth) {
      verification.branchCreation.depthConsistency = false
      console.log(
        `❌ Depth mismatch at ${level.name}: expected ${expectedDepth}, got ${level.depth}`
      )
    }

    if (level.path !== expectedPath) {
      verification.branchCreation.pathConsistency = false
      console.log(
        `❌ Path mismatch at ${level.name}: expected "${expectedPath}", got "${level.path}"`
      )
    }
  }

  // Aggregate channel testing results including useCyre
  const hookPerformanceTimes: number[] = []

  for (const testSuite of testSuites) {
    for (const channel of testSuite.channels) {
      verification.channelTesting.totalChannels++

      if (channel.actionResult.ok && channel.subscriptionResult.ok) {
        verification.channelTesting.successfulChannels++
      }

      if (channel.payloadMatch) {
        verification.channelTesting.payloadMatches++
      }

      if (channel.pathMatch) {
        verification.channelTesting.pathMatches++
      }

      if (channel.callResult?.ok) {
        verification.channelTesting.callSuccesses++
      }

      // NEW: Aggregate useCyre testing results
      if (channel.useCyreTest) {
        verification.useCyreTesting.totalHookTests++

        if (channel.useCyreTest.created) {
          verification.useCyreTesting.successfulHooks++
        }

        if (channel.useCyreTest.callSuccess) {
          verification.useCyreTesting.hookCallSuccesses++
        }

        if (channel.useCyreTest.hookCallTime > 0) {
          hookPerformanceTimes.push(channel.useCyreTest.hookCallTime)
        }

        // Verify global ID construction
        const expectedGlobalId = channel.branchPath
          ? `${channel.branchPath}/hook-${channel.localId}`
          : `hook-${channel.localId}`

        if (channel.useCyreTest.globalId === expectedGlobalId) {
          verification.useCyreTesting.globalIdMatches++
        }
      }
    }
  }

  // Calculate average hook performance
  verification.useCyreTesting.averageHookPerformance =
    hookPerformanceTimes.length > 0
      ? hookPerformanceTimes.reduce((sum, time) => sum + time, 0) /
        hookPerformanceTimes.length
      : 0

  // Get system metrics
  verification.systemMetrics = cyre.getMetrics()

  // Print verification summary
  console.log('\n📊 VERIFICATION SUMMARY:')
  console.log('========================')

  console.log('\n🌳 Branch Creation:')
  console.log(`  Total branches: ${verification.branchCreation.totalBranches}`)
  console.log(`  Successful: ${verification.branchCreation.successfulBranches}`)
  console.log(
    `  Path consistency: ${
      verification.branchCreation.pathConsistency ? '✅' : '❌'
    }`
  )
  console.log(
    `  Depth consistency: ${
      verification.branchCreation.depthConsistency ? '✅' : '❌'
    }`
  )

  console.log('\n📡 Channel Testing:')
  console.log(`  Total channels: ${verification.channelTesting.totalChannels}`)
  console.log(`  Successful: ${verification.channelTesting.successfulChannels}`)
  console.log(
    `  Payload matches: ${verification.channelTesting.payloadMatches}`
  )
  console.log(`  Path matches: ${verification.channelTesting.pathMatches}`)
  console.log(`  Call successes: ${verification.channelTesting.callSuccesses}`)

  // NEW: useCyre verification summary
  console.log('\n🪝 useCyre Hook Testing:')
  console.log(
    `  Total hook tests: ${verification.useCyreTesting.totalHookTests}`
  )
  console.log(
    `  Successful hooks: ${verification.useCyreTesting.successfulHooks}`
  )
  console.log(
    `  Hook call successes: ${verification.useCyreTesting.hookCallSuccesses}`
  )
  console.log(
    `  Global ID matches: ${verification.useCyreTesting.globalIdMatches}`
  )
  console.log(
    `  Average performance: ${verification.useCyreTesting.averageHookPerformance.toFixed(
      2
    )}ms`
  )

  console.log('\n🔄 Cross-Depth Calls:')
  console.log(`  Total tests: ${verification.crossDepthCalls.totalTests}`)
  console.log(`  Successful: ${verification.crossDepthCalls.successful}`)
  console.log(
    `  Parent→Child: ${verification.crossDepthCalls.parentChildSuccess}`
  )
  console.log(`  Deep calls: ${verification.crossDepthCalls.deepCallSuccess}`)

  console.log('\n⚡ System Metrics:')
  console.log(
    `  Total channels: ${verification.systemMetrics.stores?.channels || 0}`
  )
  console.log(
    `  Total subscribers: ${
      verification.systemMetrics.stores?.subscribers || 0
    }`
  )
  console.log(
    `  System health: ${
      verification.systemMetrics.system?.health?.isHealthy
        ? '✅ Healthy'
        : '❌ Degraded'
    }`
  )

  return verification
}

// ========================================
// MAIN DEMO ORCHESTRATOR
// ========================================

export const multiDepthBranchDemo = async () => {
  console.log('🚀 Starting Multi-Depth Branch Demo...')
  console.log('====================================')

  try {
    // 1. Create multi-depth branch system
    const branchSystem = await createMultiDepthBranchSystem()

    // 2. Test channels at each depth
    const testSuites = await testChannelsAtEachDepth(branchSystem)

    // 3. Test cross-depth calls
    const crossDepthResults = await testCrossDepthCalls(branchSystem)

    // 4. Verify system integrity
    const verification = await verifySystemIntegrity(
      branchSystem,
      testSuites,
      crossDepthResults
    )

    // 5. Test branch statistics
    console.log('\n📈 Branch Statistics:')
    branchSystem.hierarchy.forEach((level: any) => {
      if (level.instance.getStats) {
        const stats = level.instance.getStats()
        console.log(`  ${level.name} (depth ${level.depth}):`, {
          path: stats.path,
          channels: stats.channelCount,
          children: stats.childCount,
          active: stats.isActive
        })
      }
    })

    console.log('\n🎉 Multi-Depth Branch Demo Completed Successfully!')

    return {
      branchSystem,
      testSuites,
      crossDepthResults,
      verification
    }
  } catch (error) {
    console.error('❌ Multi-Depth Branch Demo Failed:', error)
    throw error
  }
}

// ========================================
// useCyre HOOK PERFORMANCE DEMO
// ========================================

export const useCyrePerformanceDemo = async (
  branchSystem: any
): Promise<any> => {
  console.log('\n🚀 useCyre Hook Performance Demo...')

  const performanceResults: any[] = []

  for (const level of branchSystem.hierarchy) {
    console.log(
      `\n🪝 Testing useCyre performance at depth ${level.depth}: ${level.name}`
    )

    const hooks: any[] = []
    const createStartTime = performance.now()

    // Create multiple hooks at this depth
    for (let i = 0; i < 5; i++) {
      const hookId = `perf-hook-${i}`

      try {
        const hook = useCyre(
          {
            channelId: hookId,
            payload: {
              perfTest: true,
              depth: level.depth,
              branch: level.name,
              hookIndex: i
            },
            config: {
              throttle: 200,
              detectChanges: true
            }
          },
          level.instance
        )

        // Subscribe to hook
        hook.on((payload: any) => {
          return {
            perfHookResponse: 'processed',
            hookId,
            depth: level.depth,
            receivedPayload: payload
          }
        })

        hooks.push({hook, hookId})
      } catch (error) {
        console.log(`  ❌ Hook creation failed: ${error}`)
      }
    }

    const createTime = performance.now() - createStartTime

    // Test hook calls
    const callStartTime = performance.now()
    const callResults = await Promise.all(
      hooks.map(async ({hook, hookId}, index) => {
        try {
          const result = await hook.call({
            perfCallTest: true,
            callIndex: index,
            timestamp: Date.now()
          })
          return {hookId, success: result.ok, result}
        } catch (error) {
          return {hookId, success: false, error}
        }
      })
    )
    const callTime = performance.now() - callStartTime

    // Gather hook statistics
    const hookStats = hooks.map(({hook, hookId}) => {
      const stats = hook.getStats()
      return {
        hookId,
        globalId: stats.globalId,
        localId: stats.localId,
        path: stats.path,
        depth: stats.depth,
        isBranch: stats.isBranch,
        created: stats.created
      }
    })

    const depthResult = {
      depth: level.depth,
      branchName: level.name,
      branchPath: level.path,
      hooksCreated: hooks.length,
      createTime,
      callTime,
      callResults,
      hookStats,
      performance: {
        avgCreateTime: createTime / hooks.length,
        avgCallTime: callTime / hooks.length,
        successfulCalls: callResults.filter(r => r.success).length
      }
    }

    performanceResults.push(depthResult)

    console.log(
      `  📊 Created ${hooks.length} hooks in ${createTime.toFixed(2)}ms`
    )
    console.log(
      `  📊 Executed ${callResults.length} calls in ${callTime.toFixed(2)}ms`
    )
    console.log(
      `  📊 Success rate: ${callResults.filter(r => r.success).length}/${
        callResults.length
      }`
    )
  }

  // Performance summary
  console.log('\n📈 useCyre Performance Summary:')
  console.log('===============================')

  performanceResults.forEach(result => {
    console.log(`Depth ${result.depth} (${result.branchName}):`)
    console.log(`  Hooks: ${result.hooksCreated}`)
    console.log(
      `  Create: ${result.performance.avgCreateTime.toFixed(2)}ms avg`
    )
    console.log(`  Call: ${result.performance.avgCallTime.toFixed(2)}ms avg`)
    console.log(
      `  Success: ${result.performance.successfulCalls}/${result.hooksCreated}`
    )
    console.log(
      `  Global IDs: ${result.hookStats.map((s: any) => s.globalId).join(', ')}`
    )
  })

  return performanceResults
}

// ========================================
// STRESS TEST: MANY CHANNELS PER DEPTH
// ========================================

export const stressTestMultiDepthChannels = async () => {
  console.log('\n🔥 Starting Stress Test: Many Channels Per Depth...')

  try {
    const branchSystem = await createMultiDepthBranchSystem()
    const channelsPerDepth = 10
    const stressResults: any[] = []

    for (const level of branchSystem.hierarchy) {
      if (level.depth === 0) continue // Skip root for this test

      console.log(`\n💥 Stress testing depth ${level.depth}: ${level.name}`)
      const depthResults = {
        depth: level.depth,
        name: level.name,
        channelsCreated: 0,
        channelsSuccessful: 0,
        callsSuccessful: 0,
        avgResponseTime: 0,
        errors: []
      }

      const responseTimes: number[] = []

      // Create many channels
      for (let i = 0; i < channelsPerDepth; i++) {
        const channelId = `stress-channel-${i}`

        try {
          // Create action
          const actionResult = level.instance.action({
            id: channelId,
            payload: {id: i, depth: level.depth, branch: level.name},
            throttle: 50
          })

          if (actionResult.ok) {
            depthResults.channelsCreated++

            // Create handler
            const subResult = level.instance.on(channelId, (payload: any) => {
              return {
                processed: true,
                channelId,
                receivedPayload: payload,
                timestamp: Date.now()
              }
            })

            if (subResult.ok) {
              depthResults.channelsSuccessful++

              // Test call
              const startTime = Date.now()
              const callResult = await level.instance.call(channelId, {
                testCall: true,
                channelIndex: i
              })
              const responseTime = Date.now() - startTime

              if (callResult.ok) {
                depthResults.callsSuccessful++
                responseTimes.push(responseTime)
              }
            }
          }
        } catch (error) {
          depthResults.errors.push(`Channel ${i}: ${error}`)
        }
      }

      // Calculate average response time
      depthResults.avgResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) /
            responseTimes.length
          : 0

      stressResults.push(depthResults)

      console.log(
        `  📊 Results: ${depthResults.channelsSuccessful}/${channelsPerDepth} channels successful`
      )
      console.log(
        `  📊 Calls: ${depthResults.callsSuccessful}/${depthResults.channelsSuccessful} calls successful`
      )
      console.log(
        `  📊 Avg response: ${depthResults.avgResponseTime.toFixed(2)}ms`
      )
    }

    console.log('\n🔥 Stress Test Summary:')
    console.log('========================')
    stressResults.forEach(result => {
      console.log(`Depth ${result.depth} (${result.name}):`)
      console.log(
        `  Channels: ${result.channelsSuccessful}/${channelsPerDepth}`
      )
      console.log(
        `  Calls: ${result.callsSuccessful}/${result.channelsSuccessful}`
      )
      console.log(`  Response: ${result.avgResponseTime.toFixed(2)}ms`)
      console.log(`  Errors: ${result.errors.length}`)
    })

    return stressResults
  } catch (error) {
    console.error('❌ Stress test failed:', error)
    throw error
  }
}

// Export main demo function
export default multiDepthBranchDemo()
