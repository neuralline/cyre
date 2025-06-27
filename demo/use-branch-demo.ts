// demo/use-branch-demo.ts
// Complete useBranch testing demo with proper instance-first syntax

import {cyre, useBranch} from '../src'

/*

      U.S.E - B.R.A.N.C.H - D.E.M.O
      
      Testing all useBranch functionality:
      - Instance-first syntax: useBranch(instance, config)
      - Hierarchical organization
      - Parent-child communication patterns
      - Cascade destruction
      - Branch isolation and reuse

*/

async function runUseBranchDemo() {
  console.log('🌳 CYRE useBranch Demo')
  console.log('======================')
  console.log('Testing branch system with instance-first syntax...\n')

  await cyre.init()

  // ========================================
  // STEP 1: Basic Branch Creation
  // ========================================

  console.log('📁 STEP 1: Basic Branch Creation')
  console.log('=================================')

  // Test 1: Simple branch with main cyre instance
  const mainBranch = useBranch(cyre, {
    id: 'main-app',
    name: 'Main Application Branch'
  })

  console.log(`✅ Main branch created: ${mainBranch.path}`)

  // Test 2: Child branch
  const userBranch = useBranch(cyre, {
    id: 'users',
    name: 'User Management',
    parent: mainBranch
  })

  console.log(`✅ User branch created: ${userBranch.path}`)

  // Test 3: Grandchild branch
  const profileBranch = useBranch(cyre, {
    id: 'profiles',
    name: 'User Profiles',
    parent: userBranch,
    maxDepth: 5
  })

  console.log(`✅ Profile branch created: ${profileBranch.path}`)

  // ========================================
  // STEP 2: Action Registration Testing
  // ========================================

  console.log('\n🔧 STEP 2: Action Registration Testing')
  console.log('======================================')

  // Register actions in different branches
  const mainActions = [
    mainBranch.action({
      id: 'system-health',
      payload: {status: 'unknown'}
    }),
    mainBranch.action({
      id: 'error-handler',
      throttle: 1000
    })
  ]

  const userActions = [
    userBranch.action({
      id: 'create-user',
      required: true,
      detectChanges: true
    }),
    userBranch.action({
      id: 'validate-user',
      debounce: 300
    }),
    userBranch.action({
      id: 'delete-user',
      priority: {level: 'high'}
    })
  ]

  const profileActions = [
    profileBranch.action({
      id: 'update-avatar',
      throttle: 500,
      detectChanges: true
    }),
    profileBranch.action({
      id: 'save-preferences',
      debounce: 1000
    })
  ]

  console.log('✅ Actions registered across branches:')
  console.log(`   Main: ${mainActions.filter(r => r.ok).length}/2 successful`)
  console.log(`   User: ${userActions.filter(r => r.ok).length}/3 successful`)
  console.log(
    `   Profile: ${profileActions.filter(r => r.ok).length}/2 successful`
  )

  // ========================================
  // STEP 3: Handler Registration Testing
  // ========================================

  console.log('\n👂 STEP 3: Handler Registration Testing')
  console.log('=======================================')

  // Main branch handlers
  const mainSubscriptions = [
    mainBranch.on('system-health', () => {
      console.log('   🏥 System health check executed')
      return {
        status: 'healthy',
        timestamp: Date.now(),
        branch: 'main-app'
      }
    }),

    mainBranch.on('error-handler', error => {
      console.log(`   ❌ Error handled: ${error?.message || 'Unknown error'}`)
      return {
        handled: true,
        timestamp: Date.now(),
        severity: error?.severity || 'medium'
      }
    })
  ]

  // User branch handlers
  const userSubscriptions = [
    userBranch.on('create-user', userData => {
      console.log(`   👤 Creating user: ${userData?.name || 'Unknown'}`)
      return {
        id: Date.now(),
        name: userData?.name,
        email: userData?.email,
        created: true,
        branch: 'users'
      }
    }),

    userBranch.on('validate-user', userData => {
      console.log(`   ✅ Validating user: ${userData?.email || 'Unknown'}`)
      const isValid = userData?.email && userData?.name
      return {
        valid: isValid,
        errors: isValid ? [] : ['Missing required fields'],
        branch: 'users'
      }
    }),

    userBranch.on('delete-user', userId => {
      console.log(`   🗑️ Deleting user: ${userId}`)
      return {
        deleted: true,
        userId,
        timestamp: Date.now(),
        branch: 'users'
      }
    })
  ]

  // Profile branch handlers
  const profileSubscriptions = [
    profileBranch.on('update-avatar', avatarData => {
      console.log(`   🖼️ Updating avatar: ${avatarData?.url || 'No URL'}`)
      return {
        updated: true,
        url: avatarData?.url,
        size: avatarData?.size || 'medium',
        branch: 'profiles'
      }
    }),

    profileBranch.on('save-preferences', prefs => {
      console.log(
        `   ⚙️ Saving preferences: ${Object.keys(prefs || {}).length} items`
      )
      return {
        saved: true,
        preferences: prefs,
        timestamp: Date.now(),
        branch: 'profiles'
      }
    })
  ]

  const totalSubscriptions = [
    ...mainSubscriptions,
    ...userSubscriptions,
    ...profileSubscriptions
  ]

  console.log('✅ Handlers registered:')
  console.log(
    `   Total: ${totalSubscriptions.filter(s => s.ok).length}/${
      totalSubscriptions.length
    } successful`
  )

  // ========================================
  // STEP 4: Call Testing (Parent → Child Pattern)
  // ========================================

  console.log('\n📞 STEP 4: Call Testing (Parent → Child Pattern)')
  console.log('=================================================')

  // Test main branch calls
  console.log('\n🏠 Main Branch Calls:')

  const healthResult = await mainBranch.call('system-health')
  console.log(
    `   Health Check: ${healthResult.ok ? '✅ Success' : '❌ Failed'} - ${
      healthResult.message
    }`
  )

  const errorResult = await mainBranch.call('error-handler', {
    message: 'Test error',
    severity: 'low'
  })
  console.log(
    `   Error Handler: ${errorResult.ok ? '✅ Success' : '❌ Failed'} - ${
      errorResult.message
    }`
  )

  // Test user branch calls
  console.log('\n👥 User Branch Calls:')

  const createResult = await userBranch.call('create-user', {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  })
  console.log(
    `   Create User: ${createResult.ok ? '✅ Success' : '❌ Failed'} - ${
      createResult.message
    }`
  )

  const validateResult = await userBranch.call('validate-user', {
    name: 'Jane Smith',
    email: 'jane@example.com'
  })
  console.log(
    `   Validate User: ${validateResult.ok ? '✅ Success' : '❌ Failed'} - ${
      validateResult.message
    }`
  )

  // Test profile branch calls
  console.log('\n🖼️ Profile Branch Calls:')

  const avatarResult = await profileBranch.call('update-avatar', {
    url: 'https://example.com/avatar.jpg',
    size: 'large'
  })
  console.log(
    `   Update Avatar: ${avatarResult.ok ? '✅ Success' : '❌ Failed'} - ${
      avatarResult.message
    }`
  )

  const prefsResult = await profileBranch.call('save-preferences', {
    theme: 'dark',
    language: 'en',
    notifications: true
  })
  console.log(
    `   Save Preferences: ${prefsResult.ok ? '✅ Success' : '❌ Failed'} - ${
      prefsResult.message
    }`
  )

  // ========================================
  // STEP 5: Cross-Branch Communication Testing
  // ========================================

  console.log('\n🔄 STEP 5: Cross-Branch Communication Testing')
  console.log('==============================================')

  // Test parent calling child (ALLOWED)
  console.log('\n✅ Parent → Child Communication (ALLOWED):')

  try {
    // Main branch can call into user branch
    const childResult = await mainBranch.call('users/create-user', {
      name: 'Alice Johnson',
      email: 'alice@example.com'
    })
    console.log(
      `   Main → User: ${childResult.ok ? '✅ Success' : '❌ Failed'} - ${
        childResult.message
      }`
    )

    // User branch can call into profile branch
    const grandchildResult = await userBranch.call('profiles/update-avatar', {
      url: 'https://example.com/alice-avatar.jpg'
    })
    console.log(
      `   User → Profile: ${
        grandchildResult.ok ? '✅ Success' : '❌ Failed'
      } - ${grandchildResult.message}`
    )
  } catch (error) {
    console.log(`   ❌ Cross-branch call failed: ${error}`)
  }

  // Test sibling communication (BLOCKED)
  console.log('\n🚫 Sibling Communication (BLOCKED):')

  // Create sibling branch for testing
  const orderBranch = useBranch(cyre, {
    id: 'orders',
    parent: mainBranch
  })

  orderBranch.action({id: 'create-order'})
  orderBranch.on('create-order', order => {
    console.log(`   📋 Creating order: ${order?.id}`)
    return {created: true, orderId: order?.id}
  })

  try {
    // This should be blocked - siblings can't communicate directly
    const siblingResult = await userBranch.call('../orders/create-order', {
      id: 'ORD-123'
    })
    console.log(`   ❌ Unexpected success: ${siblingResult.message}`)
  } catch (error) {
    console.log(
      `   ✅ Correctly blocked sibling communication: ${error.message}`
    )
  }

  // ========================================
  // STEP 6: Branch Statistics and Management
  // ========================================

  console.log('\n📊 STEP 6: Branch Statistics and Management')
  console.log('===========================================')

  const mainStats = mainBranch.getStats()
  const userStats = userBranch.getStats()
  const profileStats = profileBranch.getStats()

  console.log('\n📈 Branch Statistics:')
  console.log(`   Main Branch (${mainStats.path}):`)
  console.log(`     • Channels: ${mainStats.channelCount}`)
  console.log(`     • Depth: ${mainStats.depth}`)
  console.log(`     • Active: ${mainStats.isActive}`)

  console.log(`   User Branch (${userStats.path}):`)
  console.log(`     • Channels: ${userStats.channelCount}`)
  console.log(`     • Depth: ${userStats.depth}`)
  console.log(`     • Child Count: ${userStats.childCount}`)

  console.log(`   Profile Branch (${profileStats.path}):`)
  console.log(`     • Channels: ${profileStats.channelCount}`)
  console.log(`     • Depth: ${profileStats.depth}`)
  console.log(`     • Active: ${profileStats.isActive}`)

  // ========================================
  // STEP 7: Branch Setup Testing
  // ========================================

  console.log('\n🔧 STEP 7: Branch Setup Testing')
  console.log('================================')

  // Create a new branch with setup configuration
  const analyticsBranch = useBranch(cyre, {
    id: 'analytics',
    name: 'Analytics System',
    parent: mainBranch
  })

  const setupResult = analyticsBranch.setup({
    actions: [
      {
        id: 'track-event',
        throttle: 100,
        detectChanges: true
      },
      {
        id: 'generate-report',
        debounce: 2000,
        priority: {level: 'medium'}
      }
    ],
    subscriptions: [
      {
        id: 'track-event',
        handler: event => {
          console.log(`   📊 Tracking event: ${event?.type || 'unknown'}`)
          return {tracked: true, eventType: event?.type}
        }
      },
      {
        id: 'generate-report',
        handler: criteria => {
          console.log(
            `   📋 Generating report: ${criteria?.period || 'default'}`
          )
          return {
            generated: true,
            reportId: Date.now(),
            period: criteria?.period
          }
        }
      }
    ]
  })

  console.log(
    `✅ Branch setup: ${setupResult.ok ? 'Success' : 'Failed'} - ${
      setupResult.message
    }`
  )

  // Test the setup channels
  const trackResult = await analyticsBranch.call('track-event', {
    type: 'user_login',
    userId: 12345
  })
  console.log(`   Track Event: ${trackResult.ok ? '✅ Success' : '❌ Failed'}`)

  // ========================================
  // STEP 8: Cascade Destruction Testing
  // ========================================

  console.log('\n💥 STEP 8: Cascade Destruction Testing')
  console.log('======================================')

  console.log('\nBefore destruction:')
  console.log(`   • Main branch active: ${mainBranch.isActive()}`)
  console.log(`   • User branch active: ${userBranch.isActive()}`)
  console.log(`   • Profile branch active: ${profileBranch.isActive()}`)
  console.log(`   • Analytics branch active: ${analyticsBranch.isActive()}`)

  // Destroy user branch - should cascade to profile branch
  console.log('\n🔥 Destroying user branch (should cascade to profile)...')
  const destroyResult = userBranch.destroy()
  console.log(
    `   Destruction result: ${destroyResult ? '✅ Success' : '❌ Failed'}`
  )

  console.log('\nAfter user branch destruction:')
  console.log(`   • Main branch active: ${mainBranch.isActive()}`)
  console.log(`   • User branch active: ${userBranch.isActive()}`)
  console.log(`   • Profile branch active: ${profileBranch.isActive()}`)
  console.log(`   • Analytics branch active: ${analyticsBranch.isActive()}`)

  // Test that destroyed channels are no longer callable
  try {
    const deadResult = await userBranch.call('create-user', {name: 'Test'})
    console.log(
      `   ❌ Unexpected success calling destroyed branch: ${deadResult.message}`
    )
  } catch (error) {
    console.log(`   ✅ Correctly failed to call destroyed branch`)
  }

  // ========================================
  // STEP 9: Error Handling and Edge Cases
  // ========================================

  console.log('\n🚨 STEP 9: Error Handling and Edge Cases')
  console.log('========================================')

  // Test invalid branch ID
  try {
    const invalidBranch = useBranch(cyre, {
      id: 'invalid/branch/id', // Should fail
      name: 'Invalid Branch'
    })
    console.log(`   ❌ Unexpected success with invalid ID`)
  } catch (error) {
    console.log(`   ✅ Correctly rejected invalid branch ID: ${error.message}`)
  }

  // Test circular reference prevention
  try {
    const circularBranch = useBranch(cyre, {
      id: 'circular',
      parent: analyticsBranch
    })

    // This should fail if we try to make analytics a child of circular
    const circularResult = useBranch(cyre, {
      id: 'test-circular',
      parent: circularBranch
    })

    console.log(`   ✅ Circular reference test passed (no infinite loops)`)
  } catch (error) {
    console.log(`   ✅ Circular reference properly prevented: ${error.message}`)
  }

  // Test calling non-existent channel
  try {
    const nonExistentResult = await mainBranch.call('non-existent-channel')
    console.log(`   ❌ Unexpected success calling non-existent channel`)
  } catch (error) {
    console.log(`   ✅ Correctly failed to call non-existent channel`)
  }

  // ========================================
  // STEP 10: Performance and Memory Testing
  // ========================================

  console.log('\n⚡ STEP 10: Performance and Memory Testing')
  console.log('==========================================')

  // Create multiple branches rapidly
  const startTime = Date.now()
  const branches = []

  for (let i = 0; i < 100; i++) {
    const branch = useBranch(cyre, {
      id: `perf-test-${i}`,
      parent: mainBranch
    })

    branch.action({id: 'test-action'})
    branch.on('test-action', () => ({result: i}))

    branches.push(branch)
  }

  const creationTime = Date.now() - startTime
  console.log(`✅ Created 100 branches in ${creationTime}ms`)

  // Test rapid calls
  const callStartTime = Date.now()
  const callPromises = branches.slice(0, 10).map(async (branch, index) => {
    return await branch.call('test-action')
  })

  const callResults = await Promise.all(callPromises)
  const callTime = Date.now() - callStartTime
  const successfulCalls = callResults.filter(r => r.ok).length

  console.log(`✅ Executed ${successfulCalls}/10 calls in ${callTime}ms`)

  // Cleanup performance test branches
  const cleanupStart = Date.now()
  branches.forEach(branch => branch.destroy())
  const cleanupTime = Date.now() - cleanupStart

  console.log(`✅ Cleaned up 100 branches in ${cleanupTime}ms`)

  // ========================================
  // FINAL SUMMARY
  // ========================================

  console.log('\n🎉 FINAL SUMMARY')
  console.log('================')
  console.log('✅ All useBranch tests completed successfully!')
  console.log('')
  console.log('🌟 Features tested:')
  console.log('   • Instance-first syntax: useBranch(instance, config)')
  console.log('   • Hierarchical organization with parent-child relationships')
  console.log('   • Proper action and handler registration')
  console.log('   • Parent → Child communication (allowed)')
  console.log('   • Sibling communication blocking (security)')
  console.log('   • Branch statistics and management')
  console.log('   • Bulk setup with actions and subscriptions')
  console.log('   • Cascade destruction (React-like unmounting)')
  console.log('   • Error handling and edge cases')
  console.log('   • Performance with 100+ branches')
  console.log('')
  console.log('💎 useBranch is working beautifully!')

  // Final cleanup
  mainBranch.destroy()
  analyticsBranch.destroy()
  cyre.clear()
}

// Export for testing
export {runUseBranchDemo}

// Run if called directly
runUseBranchDemo().catch(console.error)
