// examples/collective-examples.ts

/*
 * Comprehensive examples demonstrating useCollective functionality
 * Shows real-world use cases and patterns
 */

import {useCollective} from '../src/hooks/use-collective'
import {cyre, log} from '../src'

// Initialize Cyre
cyre.init()

/**
 * Example 1: Real-time Chat Room
 * Multi-user chat with message history and moderation
 */
async function chatRoomExample() {
  console.log('\n🗣️ CHAT ROOM EXAMPLE')
  console.log('===================')

  // Create chat room collective
  const chatRoom = useCollective('general-chat', {
    type: 'chat',
    maxParticipants: 50,
    messageHistory: 100,
    notifications: 'all',
    joinPermission: 'open',
    autoDestroy: 'when-empty'
  })

  // Simulate users joining
  console.log('👥 Users joining chat room...')
  await chatRoom.join('alice', 'member', {nickname: 'Alice'})
  await chatRoom.join('bob', 'member', {nickname: 'Bob'})
  await chatRoom.join('moderator', 'moderator', {nickname: 'ChatMod'})

  console.log(`Chat room has ${chatRoom.getParticipants().length} participants`)

  // Send messages
  console.log('💬 Sending messages...')
  await chatRoom.broadcast({
    type: 'message',
    from: 'alice',
    text: 'Hello everyone! 👋',
    timestamp: Date.now()
  })

  await chatRoom.broadcast({
    type: 'message',
    from: 'bob',
    text: 'Hey Alice! How are you?',
    timestamp: Date.now()
  })

  // Moderator announcement
  await chatRoom.broadcast({
    type: 'announcement',
    from: 'moderator',
    text: 'Welcome to the general chat! Please be respectful.',
    priority: 'high',
    timestamp: Date.now()
  })

  // Check chat state
  const chatState = chatRoom.getState()
  console.log(`Messages exchanged: ${chatState.metrics.messagesExchanged}`)

  // User leaves
  await chatRoom.leave('bob')
  console.log(
    `Bob left. Remaining participants: ${chatRoom.getParticipants().length}`
  )
}

/**
 * Example 2: Team Decision Making
 * Democratic voting system with proposals and consensus
 */
async function teamDecisionExample() {
  console.log('\n🗳️ TEAM DECISION EXAMPLE')
  console.log('=======================')

  // Create decision-making collective
  const engineeringTeam = useCollective('eng-team-decisions', {
    type: 'collaboration',
    consensus: 'majority',
    voting: {
      type: 'weighted',
      quorum: 0.6,
      timeout: 30000 // 30 seconds for demo
    },
    maxParticipants: 20
  })

  // Team members join with different weights (experience levels)
  console.log('👨‍💻 Engineering team assembling...')
  await engineeringTeam.join('senior-dev-1', 'member', {
    weight: 3,
    role: 'Senior'
  })
  await engineeringTeam.join('senior-dev-2', 'member', {
    weight: 3,
    role: 'Senior'
  })
  await engineeringTeam.join('mid-dev-1', 'member', {weight: 2, role: 'Mid'})
  await engineeringTeam.join('mid-dev-2', 'member', {weight: 2, role: 'Mid'})
  await engineeringTeam.join('junior-dev-1', 'member', {
    weight: 1,
    role: 'Junior'
  })
  await engineeringTeam.join('tech-lead', 'admin', {weight: 4, role: 'Lead'})

  console.log(
    `Team assembled: ${engineeringTeam.getParticipants().length} members`
  )

  // Propose architectural decision
  console.log('📋 Proposing architectural decision...')
  const proposalResult = await engineeringTeam.propose(
    {
      title: 'Database Migration Strategy',
      description: 'Should we migrate from PostgreSQL to MongoDB?',
      options: ['migrate-immediately', 'gradual-migration', 'stay-postgresql'],
      reasoning: 'Need to evaluate performance and scalability requirements'
    },
    {proposer: 'tech-lead'}
  )

  if (proposalResult.success) {
    const proposalId = proposalResult.data.proposalId
    console.log(`Proposal created: ${proposalId}`)

    // Team members vote
    console.log('🗳️ Team voting...')
    await engineeringTeam.vote(proposalId, 'gradual-migration', 'senior-dev-1')
    await engineeringTeam.vote(proposalId, 'stay-postgresql', 'senior-dev-2')
    await engineeringTeam.vote(proposalId, 'gradual-migration', 'mid-dev-1')
    await engineeringTeam.vote(proposalId, 'gradual-migration', 'mid-dev-2')
    await engineeringTeam.vote(
      proposalId,
      'migrate-immediately',
      'junior-dev-1'
    )
    await engineeringTeam.vote(proposalId, 'gradual-migration', 'tech-lead')

    // Get consensus
    console.log('📊 Calculating consensus...')
    const consensusResult = await engineeringTeam.getConsensus(proposalId)

    if (consensusResult.success && consensusResult.consensus?.achieved) {
      console.log(`✅ Consensus reached: ${consensusResult.consensus.result}`)
      console.log(`Votes processed: ${consensusResult.data.votes}`)
    } else {
      console.log('❌ No consensus reached')
    }
  }
}

/**
 * Example 3: Distributed Computing Cluster
 * Work distribution across multiple compute nodes
 */
async function distributedComputingExample() {
  console.log('\n💻 DISTRIBUTED COMPUTING EXAMPLE')
  console.log('================================')

  // Create compute cluster
  const computeCluster = useCollective('ml-training-cluster', {
    type: 'computing',
    workDistribution: 'skill-based',
    loadBalancing: 'least-busy',
    healthCheck: true,
    autoScaling: true
  })

  // Compute nodes join with different capabilities
  console.log('🖥️ Compute nodes joining cluster...')
  await computeCluster.join('gpu-node-1', 'member', {
    capabilities: ['gpu-training', 'inference', 'high-memory'],
    specs: {gpu: 'RTX 4090', memory: '32GB', cores: 16}
  })

  await computeCluster.join('gpu-node-2', 'member', {
    capabilities: ['gpu-training', 'inference'],
    specs: {gpu: 'RTX 3080', memory: '16GB', cores: 8}
  })

  await computeCluster.join('cpu-node-1', 'member', {
    capabilities: ['cpu-training', 'data-processing'],
    specs: {cpu: 'AMD 5950X', memory: '64GB', cores: 32}
  })

  await computeCluster.join('coordinator', 'admin', {
    capabilities: ['coordination', 'monitoring'],
    specs: {role: 'master-node'}
  })

  console.log(
    `Cluster formed: ${computeCluster.getParticipants().length} nodes`
  )

  // Create training tasks
  const trainingTasks = [
    {
      id: 'task-1',
      type: 'gpu-training',
      model: 'transformer',
      dataset: 'large-text',
      requiredSkills: ['gpu-training', 'high-memory'],
      estimatedTime: '2 hours'
    },
    {
      id: 'task-2',
      type: 'inference',
      model: 'cnn',
      dataset: 'image-classification',
      requiredSkills: ['inference'],
      estimatedTime: '30 minutes'
    },
    {
      id: 'task-3',
      type: 'data-processing',
      operation: 'feature-extraction',
      dataset: 'raw-data',
      requiredSkills: ['data-processing'],
      estimatedTime: '1 hour'
    }
  ]

  // Distribute work across cluster
  console.log('📋 Distributing training tasks...')
  const distributionResult = await computeCluster.distributeWork(
    trainingTasks,
    'skill-based'
  )

  if (distributionResult.success) {
    console.log('✅ Tasks distributed successfully')
    console.log(`Assignments:`, distributionResult.distribution?.assigned)
  }

  // Simulate task completion
  console.log('⚡ Simulating task execution...')
  await computeCluster.completeTask('task-1', {
    status: 'completed',
    accuracy: 0.94,
    executionTime: '1.8 hours',
    nodeId: 'gpu-node-1'
  })

  // Check cluster health
  const health = computeCluster.getHealth()
  console.log(`Cluster health: ${health.status}`)
  if (health.issues.length > 0) {
    console.log(`Issues: ${health.issues.join(', ')}`)
  }
}

/**
 * Example 4: Gaming Multiplayer World
 * Shared game state with conflict resolution
 */
async function multiplayerGameExample() {
  console.log('\n🎮 MULTIPLAYER GAME EXAMPLE')
  console.log('==========================')

  // Create game world collective
  const gameWorld = useCollective('fantasy-realm-1', {
    type: 'gaming',
    sharedState: ['playerPositions', 'worldEvents', 'inventory'],
    stateSync: 'immediate',
    conflictResolution: 'last-write-wins',
    maxParticipants: 100
  })

  // Players join the game world
  console.log('🧙 Players entering the realm...')
  await gameWorld.join('player-warrior', 'member', {
    character: {class: 'warrior', level: 15, health: 100}
  })

  await gameWorld.join('player-mage', 'member', {
    character: {class: 'mage', level: 12, mana: 80}
  })

  await gameWorld.join('game-master', 'admin', {
    role: 'dungeon-master'
  })

  console.log(`Players in realm: ${gameWorld.getParticipants().length}`)

  // Update shared game state
  console.log('🗺️ Updating game world state...')
  await gameWorld.updateSharedState('playerPositions', {
    'player-warrior': {x: 150, y: 200, zone: 'forest'},
    'player-mage': {x: 145, y: 195, zone: 'forest'}
  })

  await gameWorld.updateSharedState('worldEvents', {
    'dragon-encounter': {
      location: {x: 160, y: 210, zone: 'forest'},
      type: 'boss-fight',
      participants: ['player-warrior', 'player-mage'],
      status: 'active'
    }
  })

  // Broadcast game event
  console.log('🐉 Broadcasting dragon encounter...')
  await gameWorld.broadcast({
    type: 'world-event',
    event: 'dragon-appeared',
    location: {x: 160, y: 210, zone: 'forest'},
    message: '🐉 A mighty dragon emerges from the ancient ruins!',
    participants: ['player-warrior', 'player-mage']
  })

  // Player actions
  await gameWorld.call('player-action', {
    playerId: 'player-warrior',
    action: 'attack',
    target: 'dragon',
    weapon: 'enchanted-sword'
  })

  await gameWorld.call('player-action', {
    playerId: 'player-mage',
    action: 'cast-spell',
    spell: 'fireball',
    target: 'dragon'
  })

  // Check shared state
  const gameState = gameWorld.getSharedState()
  console.log('🎯 Current game state:', Object.keys(gameState))
}

/**
 * Example 5: Smart City Traffic Management
 * Coordinated traffic optimization across city systems
 */
async function smartCityExample() {
  console.log('\n🏙️ SMART CITY EXAMPLE')
  console.log('=====================')

  // Create city-wide coordination collective
  const cityTraffic = useCollective('downtown-traffic', {
    type: 'collaboration',
    workDistribution: 'auto',
    consensus: 'weighted',
    sharedState: ['trafficFlow', 'incidents', 'optimization']
  })

  // Traffic systems join
  console.log('🚦 Traffic systems coming online...')
  await cityTraffic.join('intersection-main-1st', 'member', {
    weight: 3,
    capabilities: ['traffic-lights', 'pedestrian-crossing'],
    location: {intersection: 'Main & 1st', priority: 'high'}
  })

  await cityTraffic.join('intersection-main-2nd', 'member', {
    weight: 3,
    capabilities: ['traffic-lights', 'turn-lanes'],
    location: {intersection: 'Main & 2nd', priority: 'high'}
  })

  await cityTraffic.join('highway-onramp-a', 'member', {
    weight: 2,
    capabilities: ['ramp-metering', 'merge-control'],
    location: {highway: 'I-95 North', priority: 'medium'}
  })

  await cityTraffic.join('traffic-control-center', 'admin', {
    weight: 5,
    capabilities: ['coordination', 'emergency-override'],
    location: {role: 'central-command'}
  })

  console.log(`Traffic systems online: ${cityTraffic.getParticipants().length}`)

  // Update traffic conditions
  console.log('📊 Updating traffic conditions...')
  await cityTraffic.updateSharedState('trafficFlow', {
    'main-1st': {volume: 'heavy', avgSpeed: 15, backlog: 12},
    'main-2nd': {volume: 'moderate', avgSpeed: 25, backlog: 3},
    'highway-onramp-a': {volume: 'light', avgSpeed: 45, backlog: 0}
  })

  // Report traffic incident
  console.log('🚨 Traffic incident reported...')
  await cityTraffic.updateSharedState('incidents', {
    'incident-001': {
      type: 'accident',
      location: 'Main & 1st',
      severity: 'moderate',
      lanesBlocked: 1,
      estimatedClearance: '20 minutes'
    }
  })

  // Broadcast incident to all systems
  await cityTraffic.broadcast({
    type: 'incident-alert',
    incident: 'incident-001',
    affectedSystems: ['intersection-main-1st', 'intersection-main-2nd'],
    action: 'reroute-traffic',
    priority: 'high'
  })

  // Propose traffic optimization
  console.log('🎯 Proposing traffic optimization...')
  const optimizationProposal = await cityTraffic.propose({
    type: 'optimization',
    strategy: 'adaptive-timing',
    changes: {
      'intersection-main-1st': {greenTime: '+15s', redTime: '-10s'},
      'intersection-main-2nd': {greenTime: '+10s', redTime: '-5s'}
    },
    expectedImprovement: '20% faster flow'
  })

  // Systems vote on optimization
  if (optimizationProposal.success) {
    const proposalId = optimizationProposal.data.proposalId
    await cityTraffic.vote(proposalId, 'approve', 'intersection-main-1st')
    await cityTraffic.vote(proposalId, 'approve', 'intersection-main-2nd')
    await cityTraffic.vote(proposalId, 'approve', 'highway-onramp-a')
    await cityTraffic.vote(proposalId, 'approve', 'traffic-control-center')

    const consensus = await cityTraffic.getConsensus(proposalId)
    if (consensus.success && consensus.consensus?.achieved) {
      console.log('✅ Traffic optimization approved and implemented')
    }
  }

  // Check system metrics
  const metrics = cityTraffic.getMetrics()
  console.log(`Traffic coordination metrics:`, {
    totalCalls: metrics.totalCalls,
    participants: metrics.participants,
    consensusReached: metrics.consensusReached
  })
}

/**
 * Example 6: Real-time Collaboration (Document Editing)
 * Conflict resolution and operational transforms
 */
async function collaborativeEditingExample() {
  console.log('\n📝 COLLABORATIVE EDITING EXAMPLE')
  console.log('=================================')

  // Create document collaboration collective
  const document = useCollective('shared-doc-123', {
    type: 'collaboration',
    sharedState: ['documentContent', 'cursorPositions', 'changes'],
    stateSync: 'immediate',
    conflictResolution: 'merge',
    maxParticipants: 10
  })

  // Users join document
  console.log('👥 Users joining document...')
  await document.join('user-alice', 'member', {
    name: 'Alice',
    color: '#ff6b6b',
    permissions: ['read', 'write']
  })

  await document.join('user-bob', 'member', {
    name: 'Bob',
    color: '#4ecdc4',
    permissions: ['read', 'write']
  })

  await document.join('user-charlie', 'moderator', {
    name: 'Charlie',
    color: '#45b7d1',
    permissions: ['read', 'write', 'admin']
  })

  console.log(`Document collaborators: ${document.getParticipants().length}`)

  // Initialize document content
  console.log('📄 Initializing document...')
  await document.updateSharedState('documentContent', {
    text: 'Welcome to our collaborative document!\n\nThis is where we brainstorm ideas.',
    version: 1,
    lastModified: Date.now()
  })

  // Simulate real-time editing
  console.log('✏️ Simulating real-time edits...')

  // Alice adds text
  await document.call('edit-operation', {
    userId: 'user-alice',
    operation: 'insert',
    position: 45,
    content: '\n\n• First brainstorming point by Alice',
    timestamp: Date.now()
  })

  // Bob adds text simultaneously
  await document.call('edit-operation', {
    userId: 'user-bob',
    operation: 'insert',
    position: 47,
    content: "\n\n• Bob's brilliant idea here",
    timestamp: Date.now() + 1
  })

  // Update cursor positions
  await document.updateSharedState('cursorPositions', {
    'user-alice': {line: 4, column: 32},
    'user-bob': {line: 6, column: 15},
    'user-charlie': {line: 1, column: 0}
  })

  // Broadcast typing indicator
  await document.broadcast({
    type: 'typing-indicator',
    userId: 'user-alice',
    isTyping: true,
    position: {line: 4, column: 32}
  })

  // Charlie comments on the document
  await document.call('add-comment', {
    userId: 'user-charlie',
    comment: "Great ideas everyone! Let's expand on these points.",
    position: {line: 4, column: 0},
    timestamp: Date.now()
  })

  // Get final document state
  const docState = document.getSharedState()
  console.log('📋 Document collaboration completed')
  console.log(`Document version: ${docState.documentContent?.version}`)
  console.log(
    `Active cursors: ${Object.keys(docState.cursorPositions || {}).length}`
  )
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 CYRE COLLECTIVE INTELLIGENCE EXAMPLES')
  console.log('=========================================')
  console.log('Demonstrating real-world collective use cases...\n')

  try {
    await chatRoomExample()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await teamDecisionExample()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await distributedComputingExample()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await multiplayerGameExample()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await smartCityExample()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await collaborativeEditingExample()

    console.log('\n🎉 ALL COLLECTIVE EXAMPLES COMPLETED!')
    console.log('=====================================')
    console.log('✅ Chat rooms with real-time messaging')
    console.log('✅ Democratic team decision making')
    console.log('✅ Distributed computing clusters')
    console.log('✅ Multiplayer game coordination')
    console.log('✅ Smart city traffic management')
    console.log('✅ Real-time collaborative editing')
    console.log('\n🌟 Collective Intelligence: The future of coordination!')
  } catch (error) {
    console.error('❌ Example failed:', error)
  }
}

// Export examples for individual testing
export {
  chatRoomExample,
  teamDecisionExample,
  distributedComputingExample,
  multiplayerGameExample,
  smartCityExample,
  collaborativeEditingExample,
  runAllExamples
}

runAllExamples().catch(console.error)
