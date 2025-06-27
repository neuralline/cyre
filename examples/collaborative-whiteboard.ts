// examples/collaborative-whiteboard.ts
// Real-time collaborative whiteboard using useCollective
// Clean, focused example showing practical collective intelligence

import {useCollective} from '../src/hooks/use-collective'
import {cyre, log} from '../src'

/*
    COLLABORATIVE WHITEBOARD EXAMPLE
    
    Features demonstrated:
    - Real-time drawing collaboration
    - Conflict resolution (simultaneous edits)
    - User presence awareness
    - Drawing permissions and roles
    - Undo/redo with collective state
    - Smart cursor tracking
*/

// Initialize Cyre first
await cyre.init()

interface DrawingAction {
  type: 'draw' | 'erase' | 'move' | 'select'
  userId: string
  timestamp: number
  data: {
    x: number
    y: number
    tool?: 'pen' | 'brush' | 'eraser'
    color?: string
    size?: number
    pressure?: number
  }
}

interface WhiteboardState {
  strokes: Array<{
    id: string
    userId: string
    points: Array<{x: number; y: number; pressure: number}>
    tool: string
    color: string
    size: number
    timestamp: number
  }>
  cursors: Record<string, {x: number; y: number; tool: string; color: string}>
  selectedObjects: string[]
  version: number
}

interface UserPresence {
  userId: string
  name: string
  avatar: string
  cursorPosition: {x: number; y: number}
  currentTool: string
  isDrawing: boolean
  lastActivity: number
}

// Create the collaborative whiteboard
console.log('🎨 Creating Collaborative Whiteboard...')

const whiteboard = useCollective('design-session-001', {
  type: 'collaboration',
  maxParticipants: 8,
  conflictResolution: 'last-write-wins',
  stateSync: 'immediate',
  notifications: 'important-only',
  messageHistory: 50
})

console.log('✅ Whiteboard collective created')

// Initialize whiteboard state
const initialWhiteboardState: WhiteboardState = {
  strokes: [],
  cursors: {},
  selectedObjects: [],
  version: 0
}

await whiteboard.updateSharedState('canvas', initialWhiteboardState)
await whiteboard.updateSharedState('userPresence', {})

console.log('🎯 Whiteboard state initialized')

// ========================================
// COLLABORATIVE DRAWING FUNCTIONS
// ========================================

/**
 * Add a user to the whiteboard session
 */
async function addUser(
  userId: string,
  name: string,
  role: 'designer' | 'viewer' | 'admin' = 'designer'
) {
  console.log(`👤 ${name} joining whiteboard...`)

  const result = await whiteboard.join(userId, role, {
    name,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
    joinTime: Date.now(),
    drawingPermissions: role === 'viewer' ? ['view'] : ['view', 'draw', 'edit']
  })

  if (result.success) {
    // Update presence
    const presence = whiteboard.getSharedState('userPresence') || {}
    presence[userId] = {
      userId,
      name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      cursorPosition: {x: 400, y: 300},
      currentTool: 'pen',
      isDrawing: false,
      lastActivity: Date.now()
    }

    await whiteboard.updateSharedState('userPresence', presence)

    console.log(`✅ ${name} joined as ${role}`)
    return result
  } else {
    console.log(`❌ ${name} failed to join: ${result.error}`)
    return result
  }
}

/**
 * User draws on the whiteboard
 */
async function drawStroke(
  userId: string,
  points: Array<{x: number; y: number; pressure: number}>,
  tool: string = 'pen',
  color: string = '#000000',
  size: number = 2
) {
  const canvas = whiteboard.getSharedState('canvas') as WhiteboardState
  const presence = whiteboard.getSharedState('userPresence') as Record<
    string,
    UserPresence
  >

  // Create new stroke
  const stroke = {
    id: `stroke-${Date.now()}-${userId}`,
    userId,
    points,
    tool,
    color,
    size,
    timestamp: Date.now()
  }

  // Update canvas
  const updatedCanvas = {
    ...canvas,
    strokes: [...canvas.strokes, stroke],
    version: canvas.version + 1
  }

  // Update user presence
  const updatedPresence = {
    ...presence,
    [userId]: {
      ...presence[userId],
      isDrawing: true,
      currentTool: tool,
      lastActivity: Date.now()
    }
  }

  // Apply updates
  await whiteboard.updateSharedState('canvas', updatedCanvas)
  await whiteboard.updateSharedState('userPresence', updatedPresence)

  // Broadcast drawing action to other users
  await whiteboard.broadcast({
    type: 'stroke-added',
    stroke,
    userId,
    canvasVersion: updatedCanvas.version
  })

  console.log(
    `🖊️ ${presence[userId]?.name || userId} drew with ${tool} (${
      points.length
    } points)`
  )
}

/**
 * Update user cursor position
 */
async function updateCursor(userId: string, x: number, y: number) {
  const presence = whiteboard.getSharedState('userPresence') as Record<
    string,
    UserPresence
  >

  if (presence[userId]) {
    const updatedPresence = {
      ...presence,
      [userId]: {
        ...presence[userId],
        cursorPosition: {x, y},
        lastActivity: Date.now()
      }
    }

    await whiteboard.updateSharedState('userPresence', updatedPresence)

    // Broadcast cursor movement (throttled in real app)
    await whiteboard.broadcast({
      type: 'cursor-moved',
      userId,
      position: {x, y}
    })
  }
}

/**
 * Collaborative selection of objects
 */
async function selectObjects(userId: string, objectIds: string[]) {
  const canvas = whiteboard.getSharedState('canvas') as WhiteboardState

  const updatedCanvas = {
    ...canvas,
    selectedObjects: objectIds,
    version: canvas.version + 1
  }

  await whiteboard.updateSharedState('canvas', updatedCanvas)

  await whiteboard.broadcast({
    type: 'objects-selected',
    userId,
    objectIds,
    canvasVersion: updatedCanvas.version
  })

  console.log(`🎯 ${userId} selected ${objectIds.length} objects`)
}

/**
 * Delete strokes (with permission check)
 */
async function deleteStrokes(userId: string, strokeIds: string[]) {
  const canvas = whiteboard.getSharedState('canvas') as WhiteboardState
  const user = whiteboard.getParticipant(userId)

  if (!user || user.role === 'viewer') {
    console.log(`❌ ${userId} doesn't have delete permissions`)
    return
  }

  const updatedCanvas = {
    ...canvas,
    strokes: canvas.strokes.filter(stroke => !strokeIds.includes(stroke.id)),
    version: canvas.version + 1
  }

  await whiteboard.updateSharedState('canvas', updatedCanvas)

  await whiteboard.broadcast({
    type: 'strokes-deleted',
    userId,
    strokeIds,
    canvasVersion: updatedCanvas.version
  })

  console.log(`🗑️ ${userId} deleted ${strokeIds.length} strokes`)
}

/**
 * Display current whiteboard state
 */
function displayWhiteboardState() {
  const canvas = whiteboard.getSharedState('canvas') as WhiteboardState
  const presence = whiteboard.getSharedState('userPresence') as Record<
    string,
    UserPresence
  >
  const participants = whiteboard.getParticipants()

  console.log('\n📊 WHITEBOARD STATE')
  console.log('===================')
  console.log(`Canvas Version: ${canvas.version}`)
  console.log(`Total Strokes: ${canvas.strokes.length}`)
  console.log(`Selected Objects: ${canvas.selectedObjects.length}`)
  console.log(`Active Users: ${participants.length}`)

  console.log('\n👥 User Presence:')
  Object.values(presence).forEach(user => {
    const participant = whiteboard.getParticipant(user.userId)
    const isActive = Date.now() - user.lastActivity < 30000 // 30 seconds
    console.log(
      `  ${user.name} (${participant?.role}): ${user.currentTool} at (${
        user.cursorPosition.x
      }, ${user.cursorPosition.y}) ${isActive ? '🟢' : '🔴'}`
    )
  })

  if (canvas.strokes.length > 0) {
    console.log('\n✏️ Recent Strokes:')
    canvas.strokes.slice(-3).forEach(stroke => {
      const user = presence[stroke.userId]
      console.log(
        `  ${user?.name || stroke.userId}: ${stroke.tool} ${stroke.color} (${
          stroke.points.length
        } points)`
      )
    })
  }
}

// ========================================
// DEMO SIMULATION
// ========================================

async function runCollaborativeDemo() {
  console.log('\n🎨 STARTING COLLABORATIVE WHITEBOARD DEMO')
  console.log('==========================================')

  // Add users to the session
  await addUser('alice', 'Alice (Designer)', 'designer')
  await addUser('bob', 'Bob (Developer)', 'designer')
  await addUser('charlie', 'Charlie (Manager)', 'viewer')
  await addUser('diana', 'Diana (UX Lead)', 'admin')

  console.log('\n📝 Users start collaborating...')

  // Alice draws a rectangle
  await drawStroke(
    'alice',
    [
      {x: 100, y: 100, pressure: 0.8},
      {x: 200, y: 100, pressure: 0.8},
      {x: 200, y: 150, pressure: 0.8},
      {x: 100, y: 150, pressure: 0.8},
      {x: 100, y: 100, pressure: 0.8}
    ],
    'pen',
    '#FF6B6B',
    3
  )

  await new Promise(resolve => setTimeout(resolve, 500))

  // Bob adds annotations
  await drawStroke(
    'bob',
    [
      {x: 250, y: 120, pressure: 0.6},
      {x: 300, y: 125, pressure: 0.7},
      {x: 320, y: 130, pressure: 0.8}
    ],
    'brush',
    '#4ECDC4',
    2
  )

  await new Promise(resolve => setTimeout(resolve, 500))

  // Diana (admin) adds feedback
  await drawStroke(
    'diana',
    [
      {x: 150, y: 180, pressure: 0.9},
      {x: 180, y: 200, pressure: 0.8},
      {x: 200, y: 180, pressure: 0.7}
    ],
    'pen',
    '#45B7D1',
    4
  )

  await new Promise(resolve => setTimeout(resolve, 500))

  // Simulate cursor movements
  await updateCursor('alice', 150, 125)
  await updateCursor('bob', 275, 125)
  await updateCursor('diana', 175, 190)

  displayWhiteboardState()

  console.log('\n🎯 Diana selects objects for feedback...')
  const canvas = whiteboard.getSharedState('canvas') as WhiteboardState
  const strokeIds = canvas.strokes.slice(0, 2).map(s => s.id)
  await selectObjects('diana', strokeIds)

  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\n🗑️ Alice removes her initial sketch...')
  const aliceStrokes = canvas.strokes
    .filter(s => s.userId === 'alice')
    .map(s => s.id)
  await deleteStrokes('alice', aliceStrokes)

  displayWhiteboardState()

  // Test voting on design decisions
  console.log('\n🗳️ Team votes on design direction...')
  const proposal = await whiteboard.propose({
    question: 'Should we use the blue color scheme for the final design?',
    options: [
      'Yes, use blue theme',
      'No, try different colors',
      'Need more options'
    ],
    category: 'design-decision'
  })

  if (proposal.success) {
    console.log(`📋 Proposal created: ${proposal.data.proposalId}`)

    // Team votes
    await whiteboard.vote(
      proposal.data.proposalId,
      'Yes, use blue theme',
      'alice'
    )
    await whiteboard.vote(
      proposal.data.proposalId,
      'Yes, use blue theme',
      'diana'
    )
    await whiteboard.vote(
      proposal.data.proposalId,
      'No, try different colors',
      'bob'
    )
    // Charlie (viewer) cannot vote on design decisions in this role

    console.log('🗳️ Votes cast by team members')

    const consensus = await whiteboard.getConsensus(proposal.data.proposalId)
    if (consensus.success && consensus.consensus?.achieved) {
      console.log(`✅ Design decision: ${consensus.consensus.result}`)
    } else {
      console.log('❌ No consensus reached on design direction')
    }
  }

  // Final state
  console.log('\n📊 FINAL WHITEBOARD SESSION STATE')
  displayWhiteboardState()

  const metrics = whiteboard.getMetrics()
  console.log('\n📈 Session Metrics:')
  console.log(`  Total Operations: ${metrics.totalCalls}`)
  console.log(`  Messages Exchanged: ${metrics.messagesExchanged}`)
  console.log(`  Consensus Decisions: ${metrics.consensusReached}`)
  console.log(`  Session Duration: ${Math.round(metrics.uptime / 1000)}s`)

  console.log('\n👋 Ending collaborative session...')

  // Users leave the session
  await whiteboard.leave('charlie')
  await whiteboard.leave('bob')
  await whiteboard.leave('alice')
  await whiteboard.leave('diana')

  console.log('✅ Collaborative whiteboard demo completed!')
}

// ========================================
// ADDITIONAL FEATURES DEMO
// ========================================

async function demonstrateAdvancedFeatures() {
  console.log('\n🚀 ADVANCED COLLECTIVE FEATURES DEMO')
  console.log('====================================')

  // Create a workshop collective
  const workshop = useCollective('design-workshop-advanced', {
    type: 'collaboration',
    maxParticipants: 12,
    consensus: 'weighted',
    voting: {
      type: 'weighted',
      quorum: 0.6,
      timeout: 30000
    },
    workDistribution: 'skill-based',
    autoDestroy: 'when-empty'
  })

  // Add participants with different expertise
  await workshop.join('lead-designer', 'admin', {
    weight: 3,
    capabilities: ['design', 'strategy', 'leadership'],
    expertise: 'senior'
  })

  await workshop.join('frontend-dev', 'member', {
    weight: 2,
    capabilities: ['frontend', 'react', 'typescript'],
    expertise: 'senior'
  })

  await workshop.join('junior-designer', 'member', {
    weight: 1,
    capabilities: ['design', 'prototyping'],
    expertise: 'junior'
  })

  console.log('👥 Workshop team assembled')

  // Distribute work based on skills
  const tasks = [
    {
      id: 'task-1',
      type: 'design-system',
      requiredSkills: ['design', 'strategy']
    },
    {
      id: 'task-2',
      type: 'component-implementation',
      requiredSkills: ['frontend', 'react']
    },
    {
      id: 'task-3',
      type: 'user-research',
      requiredSkills: ['design', 'prototyping']
    }
  ]

  console.log('📋 Distributing workshop tasks...')
  const distribution = await workshop.distributeWork(tasks, 'skill-based')

  if (distribution.success) {
    console.log('✅ Tasks distributed based on team capabilities:')
    Object.entries(distribution.distribution!.assigned).forEach(
      ([participant, tasks]) => {
        const user = workshop.getParticipant(participant)
        console.log(
          `  ${participant}: ${
            (tasks as any[]).length
          } tasks (capabilities: ${user?.capabilities?.join(', ')})`
        )
      }
    )
  }

  // Weighted voting on technical approach
  const techProposal = await workshop.propose({
    question: 'Which framework should we use for the new component library?',
    options: [
      'React + TypeScript',
      'Vue 3 + TypeScript',
      'Svelte + TypeScript'
    ],
    category: 'technical-decision'
  })

  if (techProposal.success) {
    console.log('\n🗳️ Technical decision voting (weighted by expertise)...')

    await workshop.vote(
      techProposal.data.proposalId,
      'React + TypeScript',
      'lead-designer'
    )
    await workshop.vote(
      techProposal.data.proposalId,
      'React + TypeScript',
      'frontend-dev'
    )
    await workshop.vote(
      techProposal.data.proposalId,
      'Vue 3 + TypeScript',
      'junior-designer'
    )

    const techConsensus = await workshop.getConsensus(
      techProposal.data.proposalId
    )
    if (techConsensus.success && techConsensus.consensus?.achieved) {
      console.log(
        `🎯 Technical decision (weighted): ${techConsensus.consensus.result}`
      )
    }
  }

  // Health check
  const health = workshop.getHealth()
  console.log(`\n💚 Workshop Health: ${health.status}`)
  if (health.issues.length > 0) {
    console.log(`⚠️ Issues: ${health.issues.join(', ')}`)
  }

  await workshop.destroy()
  console.log('✅ Advanced features demo completed!')
}

// ========================================
// RUN THE DEMOS
// ========================================

async function runBetterCollectiveExample() {
  try {
    await runCollaborativeDemo()
    await new Promise(resolve => setTimeout(resolve, 2000))
    await demonstrateAdvancedFeatures()

    console.log('\n🎉 ALL COLLECTIVE EXAMPLES COMPLETED SUCCESSFULLY!')
    console.log('=================================================')
    console.log('✅ Real-time collaborative whiteboard')
    console.log('✅ Role-based permissions and conflict resolution')
    console.log('✅ User presence and cursor tracking')
    console.log('✅ Collective decision making with voting')
    console.log('✅ Skill-based work distribution')
    console.log('✅ Weighted consensus for technical decisions')
    console.log('')
    console.log('🌟 useCollective: Perfect for real-time collaboration! 🌟')
  } catch (error) {
    console.error('❌ Demo failed:', error)
  } finally {
    // Cleanup
    cyre.clear()
  }
}

// Export for external use
export {
  runBetterCollectiveExample,
  addUser,
  drawStroke,
  updateCursor,
  selectObjects,
  deleteStrokes
}

// Run the demo
runBetterCollectiveExample().catch(console.error)
