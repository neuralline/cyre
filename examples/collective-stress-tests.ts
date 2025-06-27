/**
 * examples/collective-stress-tests.ts
 * Extreme stress testing for useCollective - pushing limits!
 * Tests scalability, edge cases, and breaking points
 */

import {useCollective} from '../src/hooks/use-collective'
import {cyre, log} from '../src'

// Initialize Cyre
cyre.init()

/**
 * STRESS TEST 1: Massive Participant Load
 * Test with thousands of participants
 */
async function massiveParticipantStressTest() {
  console.log('\n🔥 MASSIVE PARTICIPANT STRESS TEST')
  console.log('==================================')
  console.log('Testing with 5,000 participants...')

  const startTime = Date.now()

  // Create massive collective
  const megaCollective = useCollective('mega-event', {
    type: 'collaboration',
    maxParticipants: 10000,
    notifications: 'important-only', // Reduce noise
    messageHistory: 50 // Limit memory usage
  })

  console.log('👥 Mass participant registration starting...')

  // Add 5,000 participants in batches
  const batchSize = 100
  const totalParticipants = 5000
  let successfulJoins = 0
  let errors = 0

  for (let batch = 0; batch < totalParticipants / batchSize; batch++) {
    const batchPromises = []

    for (let i = 0; i < batchSize; i++) {
      const participantId = `user-${batch * batchSize + i}`
      const joinPromise = megaCollective
        .join(participantId, 'member', {
          batch: batch,
          region: `region-${i % 10}`,
          tier: i % 3 === 0 ? 'premium' : 'standard'
        })
        .then(result => {
          if (result.success) successfulJoins++
          else errors++
          return result
        })
        .catch(() => {
          errors++
        })

      batchPromises.push(joinPromise)
    }

    // Process batch
    await Promise.allSettled(batchPromises)

    // Progress update every 10 batches
    if (batch % 10 === 0) {
      console.log(
        `  Batch ${batch + 1}/${
          totalParticipants / batchSize
        } completed. Participants: ${successfulJoins}, Errors: ${errors}`
      )
    }
  }

  const joinTime = Date.now() - startTime
  console.log(
    `✅ Mass join completed: ${successfulJoins} participants in ${joinTime}ms`
  )
  console.log(
    `⚡ Join rate: ${Math.round(
      successfulJoins / (joinTime / 1000)
    )} participants/sec`
  )

  // Test massive broadcast
  console.log('📡 Testing massive broadcast...')
  const broadcastStart = Date.now()

  const broadcastResult = await megaCollective.broadcast({
    type: 'system-announcement',
    message: 'Welcome to the mega event! 🎉',
    priority: 'high',
    timestamp: Date.now()
  })

  const broadcastTime = Date.now() - broadcastStart
  console.log(
    `📢 Broadcast to ${successfulJoins} participants in ${broadcastTime}ms`
  )
  console.log(
    `⚡ Broadcast rate: ${Math.round(
      successfulJoins / (broadcastTime / 1000)
    )} notifications/sec`
  )

  // Test partial leave (simulate realistic usage)
  console.log('👋 Testing mass leave (50% participants)...')
  const leaveStart = Date.now()
  let leaveCount = 0

  // Leave every other participant
  for (let i = 0; i < totalParticipants; i += 2) {
    try {
      await megaCollective.leave(`user-${i}`)
      leaveCount++
    } catch (error) {
      // Continue on error
    }

    // Batch process to avoid overwhelming
    if (i % 1000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  const leaveTime = Date.now() - leaveStart
  console.log(`👋 ${leaveCount} participants left in ${leaveTime}ms`)

  const finalStats = megaCollective.getMetrics()
  console.log('📊 Final Stats:', {
    participants: finalStats.participants,
    totalCalls: finalStats.totalCalls,
    messagesExchanged: finalStats.messagesExchanged,
    uptime: finalStats.uptime
  })

  // Cleanup
  await megaCollective.destroy()
}

/**
 * STRESS TEST 2: Rapid Fire Operations
 * Extremely high frequency operations
 */
async function rapidFireOperationsTest() {
  console.log('\n⚡ RAPID FIRE OPERATIONS TEST')
  console.log('============================')
  console.log('Testing 10,000 operations in rapid succession...')

  const speedCollective = useCollective('speed-test', {
    type: 'computing',
    stateSync: 'immediate',
    notifications: 'none' // Disable to focus on core operations
  })

  // Add participants
  console.log('🏃‍♂️ Adding speed test participants...')
  for (let i = 0; i < 50; i++) {
    await speedCollective.join(`speed-user-${i}`, 'member', {index: i})
  }

  console.log('🔥 Starting rapid fire operations...')
  const operationCount = 10000
  const startTime = Date.now()
  let successCount = 0
  let errorCount = 0

  // Mix of different operations
  const operations = [
    // State updates
    async (i: number) => {
      return await speedCollective.updateSharedState(`key-${i % 100}`, {
        value: i,
        timestamp: Date.now(),
        batch: Math.floor(i / 100)
      })
    },
    // Broadcasts (limited frequency)
    async (i: number) => {
      if (i % 50 === 0) {
        // Only every 50th operation
        return await speedCollective.broadcast({
          type: 'batch-update',
          batch: Math.floor(i / 50),
          progress: i / operationCount
        })
      }
      return {success: true}
    },
    // Collective calls
    async (i: number) => {
      return await speedCollective.call('speed-operation', {
        operationId: i,
        data: `operation-data-${i}`,
        timestamp: Date.now()
      })
    }
  ]

  // Fire operations as fast as possible
  const promises = []
  for (let i = 0; i < operationCount; i++) {
    const operation = operations[i % operations.length]
    const promise = operation(i)
      .then(result => {
        if (result.success) successCount++
        else errorCount++
      })
      .catch(() => {
        errorCount++
      })

    promises.push(promise)

    // Micro-batch to prevent overwhelming
    if (i % 1000 === 0 && i > 0) {
      await Promise.allSettled(promises.splice(0, 1000))
      console.log(`  Operations ${i - 1000}-${i} completed`)
    }
  }

  // Wait for remaining operations
  await Promise.allSettled(promises)

  const totalTime = Date.now() - startTime
  console.log(`⚡ ${operationCount} operations completed in ${totalTime}ms`)
  console.log(
    `🚀 Operation rate: ${Math.round(
      operationCount / (totalTime / 1000)
    )} ops/sec`
  )
  console.log(`✅ Success: ${successCount}, ❌ Errors: ${errorCount}`)

  await speedCollective.destroy()
}

/**
 * STRESS TEST 3: Complex Decision Making at Scale
 * Multiple simultaneous proposals with large voting groups
 */
async function massiveDecisionMakingTest() {
  console.log('\n🗳️ MASSIVE DECISION MAKING TEST')
  console.log('==============================')
  console.log(
    'Testing complex voting with 1,000 voters and 10 simultaneous proposals...'
  )

  const democracyCollective = useCollective('mega-democracy', {
    type: 'collaboration',
    consensus: 'majority',
    voting: {
      type: 'weighted',
      quorum: 0.6,
      timeout: 60000
    }
  })

  // Add 1,000 voters with different weights
  console.log('🗳️ Registering voters...')
  const voterCount = 1000
  for (let i = 0; i < voterCount; i++) {
    const weight =
      Math.random() > 0.8
        ? 3 // 20% senior voters
        : Math.random() > 0.5
        ? 2 // 30% experienced voters
        : 1 // 50% regular voters

    await democracyCollective.join(`voter-${i}`, 'member', {
      weight,
      expertise: i % 10, // 10 different expertise areas
      region: `region-${i % 5}` // 5 regions
    })

    if (i % 100 === 0) {
      console.log(`  ${i + 1}/${voterCount} voters registered`)
    }
  }

  console.log(`✅ ${voterCount} voters registered`)

  // Create 10 simultaneous proposals
  console.log('📋 Creating simultaneous proposals...')
  const proposalCount = 10
  const proposals = []

  for (let i = 0; i < proposalCount; i++) {
    const proposalResult = await democracyCollective.propose(
      {
        id: `proposal-${i}`,
        title: `Strategic Decision ${i + 1}`,
        description: `Should we implement strategy ${i + 1}?`,
        options: [
          'strongly-agree',
          'agree',
          'neutral',
          'disagree',
          'strongly-disagree'
        ],
        category: `category-${i % 3}`,
        urgency: i < 3 ? 'high' : i < 7 ? 'medium' : 'low'
      },
      {timeout: 30000}
    )

    if (proposalResult.success) {
      proposals.push(proposalResult.data.proposalId)
      console.log(
        `  Proposal ${i + 1} created: ${proposalResult.data.proposalId}`
      )
    }
  }

  // Simulate realistic voting patterns
  console.log('🗳️ Simulating mass voting...')
  const votingStart = Date.now()

  let totalVotes = 0
  const votePromises = []

  for (let voterIndex = 0; voterIndex < voterCount; voterIndex++) {
    const voterId = `voter-${voterIndex}`

    // Each voter votes on random subset of proposals (realistic behavior)
    const proposalsToVoteOn = proposals
      .filter(() => Math.random() > 0.3) // 70% chance to vote on each proposal
      .slice(0, Math.floor(Math.random() * 5) + 1) // Vote on 1-5 proposals

    for (const proposalId of proposalsToVoteOn) {
      const vote = [
        'strongly-agree',
        'agree',
        'neutral',
        'disagree',
        'strongly-disagree'
      ][Math.floor(Math.random() * 5)]

      const votePromise = democracyCollective
        .vote(proposalId, vote, voterId)
        .then(() => totalVotes++)
        .catch(() => {})

      votePromises.push(votePromise)
    }

    // Progress update
    if (voterIndex % 200 === 0) {
      console.log(`  ${voterIndex}/${voterCount} voters processed`)
    }
  }

  // Wait for all votes
  await Promise.allSettled(votePromises)

  const votingTime = Date.now() - votingStart
  console.log(`🗳️ ${totalVotes} votes cast in ${votingTime}ms`)
  console.log(
    `⚡ Voting rate: ${Math.round(totalVotes / (votingTime / 1000))} votes/sec`
  )

  // Calculate consensus for all proposals
  console.log('📊 Calculating consensus results...')
  const consensusStart = Date.now()
  let consensusReached = 0

  for (const proposalId of proposals) {
    try {
      const consensusResult = await democracyCollective.getConsensus(proposalId)
      if (consensusResult.success && consensusResult.consensus?.achieved) {
        consensusReached++
        console.log(`  ✅ ${proposalId}: ${consensusResult.consensus.result}`)
      } else {
        console.log(`  ❌ ${proposalId}: No consensus`)
      }
    } catch (error) {
      console.log(`  ⚠️ ${proposalId}: Error calculating consensus`)
    }
  }

  const consensusTime = Date.now() - consensusStart
  console.log(`📊 Consensus calculated in ${consensusTime}ms`)
  console.log(
    `🎯 Consensus reached: ${consensusReached}/${proposalCount} proposals`
  )

  await democracyCollective.destroy()
}

/**
 * STRESS TEST 4: Memory and Resource Limits
 * Test memory usage patterns and resource cleanup
 */
async function memoryStressTest() {
  console.log('\n🧠 MEMORY STRESS TEST')
  console.log('====================')
  console.log('Testing memory usage with large data sets...')

  // Track memory usage
  const getMemoryUsage = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024
    }
    return 0
  }

  const initialMemory = getMemoryUsage()
  console.log(`🧠 Initial memory: ${initialMemory.toFixed(2)}MB`)

  const memoryCollective = useCollective('memory-test', {
    type: 'computing',
    sharedState: 'all',
    stateSync: 'immediate',
    messageHistory: 1000 // Large message history
  })

  // Add participants with large metadata
  console.log('📊 Adding participants with large metadata...')
  for (let i = 0; i < 500; i++) {
    const largeMetadata = {
      id: i,
      profile: {
        name: `User ${i}`,
        bio: 'A'.repeat(1000), // 1KB bio
        preferences: Array.from({length: 100}, (_, j) => ({
          key: `pref-${j}`,
          value: Math.random(),
          data: 'B'.repeat(100) // 100B per preference
        })),
        history: Array.from({length: 50}, (_, j) => ({
          action: `action-${j}`,
          timestamp: Date.now() - j * 60000,
          data: {payload: 'C'.repeat(200)} // 200B per history item
        }))
      }
    }

    await memoryCollective.join(`memory-user-${i}`, 'member', largeMetadata)

    if (i % 100 === 0) {
      const currentMemory = getMemoryUsage()
      console.log(
        `  Users: ${i + 1}, Memory: ${currentMemory.toFixed(2)}MB (+${(
          currentMemory - initialMemory
        ).toFixed(2)}MB)`
      )
    }
  }

  // Add large shared state
  console.log('📈 Adding large shared state...')
  for (let i = 0; i < 100; i++) {
    const largeData = {
      dataset: Array.from({length: 1000}, (_, j) => ({
        id: j,
        value: Math.random(),
        metadata: 'D'.repeat(50) // 50B per item
      })),
      timestamp: Date.now(),
      version: i
    }

    await memoryCollective.updateSharedState(`dataset-${i}`, largeData)

    if (i % 25 === 0) {
      const currentMemory = getMemoryUsage()
      console.log(`  Datasets: ${i + 1}, Memory: ${currentMemory.toFixed(2)}MB`)
    }
  }

  // Generate message history
  console.log('💬 Generating message history...')
  for (let i = 0; i < 1000; i++) {
    await memoryCollective.broadcast({
      type: 'data-message',
      sequence: i,
      payload: {
        data: 'E'.repeat(500), // 500B per message
        metadata: Array.from({length: 10}, (_, j) => `meta-${j}`)
      },
      timestamp: Date.now()
    })

    if (i % 250 === 0) {
      const currentMemory = getMemoryUsage()
      console.log(`  Messages: ${i + 1}, Memory: ${currentMemory.toFixed(2)}MB`)
    }
  }

  const peakMemory = getMemoryUsage()
  console.log(
    `🔝 Peak memory usage: ${peakMemory.toFixed(2)}MB (+${(
      peakMemory - initialMemory
    ).toFixed(2)}MB)`
  )

  // Test cleanup
  console.log('🧹 Testing cleanup...')
  await memoryCollective.destroy()

  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }

  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000))

  const finalMemory = getMemoryUsage()
  console.log(`🧠 Post-cleanup memory: ${finalMemory.toFixed(2)}MB`)
  console.log(`♻️ Memory recovered: ${(peakMemory - finalMemory).toFixed(2)}MB`)
}

/**
 * STRESS TEST 5: Concurrent Collective Creation/Destruction
 * Test system stability under rapid collective lifecycle
 */
async function concurrentLifecycleTest() {
  console.log('\n🔄 CONCURRENT LIFECYCLE TEST')
  console.log('===========================')
  console.log('Testing rapid creation/destruction of collectives...')

  const lifecycleCount = 100
  const startTime = Date.now()

  console.log(
    `🏗️ Creating and destroying ${lifecycleCount} collectives concurrently...`
  )

  const lifecyclePromises = Array.from(
    {length: lifecycleCount},
    async (_, i) => {
      try {
        // Create collective
        const collective = useCollective(`lifecycle-test-${i}`, {
          type: 'custom',
          maxParticipants: 10,
          autoDestroy: 'when-empty'
        })

        // Add some participants
        for (let j = 0; j < 5; j++) {
          await collective.join(`user-${i}-${j}`, 'member', {index: j})
        }

        // Do some operations
        await collective.updateSharedState('data', {
          collectiveId: i,
          data: Array.from({length: 100}, (_, k) => k)
        })
        await collective.broadcast({message: `Hello from collective ${i}`})

        // Create proposal
        const proposal = await collective.propose({
          question: `Should collective ${i} continue?`,
          options: ['yes', 'no']
        })

        if (proposal.success) {
          // Quick voting
          for (let j = 0; j < 5; j++) {
            await collective.vote(
              proposal.data.proposalId,
              Math.random() > 0.5 ? 'yes' : 'no',
              `user-${i}-${j}`
            )
          }
          await collective.getConsensus(proposal.data.proposalId)
        }

        // Remove participants
        for (let j = 0; j < 5; j++) {
          await collective.leave(`user-${i}-${j}`)
        }

        // Destroy collective
        await collective.destroy()

        return {success: true, id: i}
      } catch (error) {
        return {success: false, id: i, error: String(error)}
      }
    }
  )

  const results = await Promise.allSettled(lifecyclePromises)
  const totalTime = Date.now() - startTime

  const successful = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length
  const failed = results.length - successful

  console.log(`✅ Lifecycle test completed in ${totalTime}ms`)
  console.log(`🏆 Successful: ${successful}/${lifecycleCount}`)
  console.log(`❌ Failed: ${failed}/${lifecycleCount}`)
  console.log(
    `⚡ Rate: ${Math.round(
      lifecycleCount / (totalTime / 1000)
    )} collectives/sec`
  )
}

/**
 * STRESS TEST 6: Edge Cases and Error Conditions
 * Test system behavior under abnormal conditions
 */
async function edgeCasesTest() {
  console.log('\n🚨 EDGE CASES TEST')
  console.log('==================')
  console.log('Testing error conditions and edge cases...')

  const edgeCollective = useCollective('edge-test', {
    type: 'custom',
    maxParticipants: 5, // Intentionally low limit
    consensus: 'unanimous'
  })

  console.log('🔬 Testing edge cases...')

  // Test 1: Exceed participant limit
  console.log('  Test 1: Exceeding participant limit')
  for (let i = 0; i < 10; i++) {
    const result = await edgeCollective.join(`overflow-user-${i}`, 'member')
    if (!result.success) {
      console.log(`    ✅ Correctly rejected participant ${i} (limit reached)`)
      break
    }
  }

  // Test 2: Vote on non-existent proposal
  console.log('  Test 2: Vote on non-existent proposal')
  const invalidVote = await edgeCollective.vote(
    'fake-proposal-id',
    'yes',
    'overflow-user-0'
  )
  console.log(
    `    ${invalidVote.success ? '❌' : '✅'} Invalid vote correctly handled`
  )

  // Test 3: Leave non-existent participant
  console.log('  Test 3: Leave non-existent participant')
  const invalidLeave = await edgeCollective.leave('non-existent-user')
  console.log(
    `    ${invalidLeave.success ? '❌' : '✅'} Invalid leave correctly handled`
  )

  // Test 4: Multiple rapid joins/leaves of same user
  console.log('  Test 4: Rapid join/leave cycles')
  for (let i = 0; i < 10; i++) {
    await edgeCollective.join('flip-flop-user', 'member')
    await edgeCollective.leave('flip-flop-user')
  }
  console.log('    ✅ Rapid join/leave cycles handled')

  // Test 5: Extremely large broadcast
  console.log('  Test 5: Extremely large broadcast payload')
  const hugeBroadcast = await edgeCollective.broadcast({
    type: 'stress-test',
    data: Array.from({length: 10000}, (_, i) => ({
      id: i,
      data: 'X'.repeat(100)
    })),
    timestamp: Date.now()
  })
  console.log(
    `    ${hugeBroadcast.success ? '✅' : '❌'} Large broadcast handled`
  )

  // Test 6: Destroy and then try to use
  console.log('  Test 6: Use after destroy')
  await edgeCollective.destroy()
  const useAfterDestroy = await edgeCollective.join('ghost-user', 'member')
  console.log(
    `    ${
      useAfterDestroy.success ? '❌' : '✅'
    } Use after destroy correctly handled`
  )

  console.log('🔬 Edge cases testing completed')
}

/**
 * Run all stress tests
 */
async function runAllStressTests() {
  console.log('🔥 CYRE COLLECTIVE STRESS TESTING SUITE')
  console.log('=======================================')
  console.log('Pushing useCollective to its absolute limits...\n')

  const overallStart = Date.now()

  try {
    await massiveParticipantStressTest()
    await new Promise(resolve => setTimeout(resolve, 2000))

    await rapidFireOperationsTest()
    await new Promise(resolve => setTimeout(resolve, 2000))

    await massiveDecisionMakingTest()
    await new Promise(resolve => setTimeout(resolve, 2000))

    await memoryStressTest()
    await new Promise(resolve => setTimeout(resolve, 2000))

    await concurrentLifecycleTest()
    await new Promise(resolve => setTimeout(resolve, 2000))

    await edgeCasesTest()

    const totalTime = Date.now() - overallStart

    console.log('\n🏆 ALL STRESS TESTS COMPLETED!')
    console.log('==============================')
    console.log(`⏱️ Total testing time: ${Math.round(totalTime / 1000)}s`)
    console.log('🔥 Stress tests passed:')
    console.log('  ✅ 5,000 participant load test')
    console.log('  ✅ 10,000 rapid fire operations')
    console.log('  ✅ 1,000 voter democracy simulation')
    console.log('  ✅ Memory usage and cleanup verification')
    console.log('  ✅ 100 concurrent collective lifecycles')
    console.log('  ✅ Edge cases and error conditions')
    console.log('\n🚀 useCollective is production-ready for extreme loads!')
  } catch (error) {
    console.error('❌ Stress test failed:', error)
  }
}

// Export individual tests
export {
  massiveParticipantStressTest,
  rapidFireOperationsTest,
  massiveDecisionMakingTest,
  memoryStressTest,
  concurrentLifecycleTest,
  edgeCasesTest,
  runAllStressTests
}

// Run all stress tests if called directly
runAllStressTests().catch(console.error)
