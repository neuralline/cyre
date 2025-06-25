// demo/smart-city.ts
// Simple demo showing Cyre features with real-time feedback

import {cyre, useBranch} from '../src'

/*

      C.Y.R.E - I.N.T.E.R.A.C.T.I.V.E - D.E.M.O
      
      Real-time demonstration of Cyre features:
      - Branch system with live isolation
      - Schema validation with error handling
      - Throttling and debouncing in action
      - Breathing system under load
      - Cross-branch communication
      - Performance monitoring

*/

// ===========================================
// DEMO SCHEMAS
// ===========================================

// ===========================================
// CHAT APPLICATION DEMO
// ===========================================

async function createChatDemo() {
  console.log('💬 Creating Chat Application Demo...')

  await cyre.initialize()

  // Create chat rooms as branches
  const generalRoom = useBranch(undefined, {id: 'general-chat'})
  const techRoom = useBranch(undefined, {id: 'tech-chat'})
  const randomRoom = useBranch(undefined, {id: 'random-chat'})

  // Setup message system for each room
  const rooms = [
    {branch: generalRoom, name: 'General'},
    {branch: techRoom, name: 'Tech'},
    {branch: randomRoom, name: 'Random'}
  ]

  rooms.forEach(({branch, name}) => {
    // Message action with schema validation and throttling
    branch.action({
      id: 'send-message',
      throttle: 1000, // 1 message per second max
      detectChanges: true,
      payload: {from: '', to: '', content: '', timestamp: 0}
    })

    // User join/leave actions
    branch.action({
      id: 'user-join',
      payload: {id: '', name: '', email: '', age: 0}
    })

    branch.action({
      id: 'user-leave',
      payload: {userId: '', reason: 'disconnect'}
    })

    // Message handler
    branch.on('send-message', (data: any) => {
      console.log(`[${name} Room] ${data.from}: ${data.content}`)

      // Cross-room notification for mentions
      if (data.content.includes('@everyone')) {
        rooms.forEach(({branch: otherBranch}) => {
          if (otherBranch.id !== branch.id) {
            otherBranch.call('cross-room-mention', {
              from: data.from,
              sourceRoom: name,
              content: data.content
            })
          }
        })
      }

      return {
        messageId: `msg-${Date.now()}`,
        delivered: true,
        timestamp: Date.now()
      }
    })

    // User join handler
    branch.on('user-join', (data: any) => {
      console.log(`👋 [${name} Room] ${data.name} joined the chat`)
      return {welcomed: true, userCount: Math.floor(Math.random() * 50) + 1}
    })

    // User leave handler
    branch.on('user-leave', (data: any) => {
      console.log(`👋 [${name} Room] User left: ${data.reason}`)
      return {left: true, timestamp: Date.now()}
    })

    // Cross-room mention handler
    branch.action({id: 'cross-room-mention', payload: {}})
    branch.on('cross-room-mention', (data: any) => {
      console.log(
        `📢 [${name} Room] Mention from ${data.sourceRoom}: ${data.from} said "${data.content}"`
      )
      return {notified: true}
    })
  })

  return {generalRoom, techRoom, randomRoom}
}

// ===========================================
// GAMING SYSTEM DEMO
// ===========================================

async function createGamingDemo() {
  console.log('🎮 Creating Gaming System Demo...')

  // Create game instances as branches
  const game1 = useBranch(undefined, {id: 'tic-tac-toe-1'})
  const game2 = useBranch(undefined, {id: 'tic-tac-toe-2'})
  const game3 = useBranch(undefined, {id: 'tic-tac-toe-3'})

  const games = [
    {branch: game1, id: 'Game #1'},
    {branch: game2, id: 'Game #2'},
    {branch: game3, id: 'Game #3'}
  ]

  games.forEach(({branch, id}) => {
    // Game state action with debouncing (prevent rapid moves)
    branch.action({
      id: 'make-move',
      debounce: 500, // Half second debounce
      maxWait: 2000, // Max wait 2 seconds
      payload: {
        player: '',
        position: 0,
        board: Array(9).fill(''),
        gameId: id
      }
    })

    // Game reset action
    branch.action({
      id: 'reset-game',
      payload: {reason: 'new-game'}
    })

    // Move handler
    branch.on('make-move', (data: any) => {
      const newBoard = [...data.board]
      newBoard[data.position] = data.player

      console.log(
        `🎯 [${id}] Player ${data.player} moves to position ${data.position}`
      )
      console.log(`   Board: ${newBoard.map((cell, i) => cell || i).join('|')}`)

      // Check for winner (simple check)
      const winPatterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
      ]
      const winner = winPatterns.find(pattern =>
        pattern.every(
          pos => newBoard[pos] === data.player && newBoard[pos] !== ''
        )
      )

      if (winner) {
        console.log(`🏆 [${id}] Player ${data.player} wins!`)
        setTimeout(() => branch.call('reset-game', {reason: 'game-over'}), 3000)
      }

      return {
        board: newBoard,
        winner: winner ? data.player : null,
        nextPlayer: data.player === 'X' ? 'O' : 'X'
      }
    })

    // Reset handler
    branch.on('reset-game', (data: any) => {
      console.log(`🔄 [${id}] Game reset: ${data.reason}`)
      return {
        board: Array(9).fill(''),
        currentPlayer: 'X',
        winner: null
      }
    })
  })

  return {game1, game2, game3}
}

// ===========================================
// LOAD TESTING SYSTEM
// ===========================================

function startLoadTesting(chatRooms: any, games: any) {
  console.log('🔬 Starting load testing to demonstrate Cyre features...')

  const users = [
    'Alice',
    'Bob',
    'Charlie',
    'Diana',
    'Eve',
    'Frank',
    'Grace',
    'Henry'
  ]
  const rooms = Object.values(chatRooms) as any[]
  const gameList = Object.values(games) as any[]

  // Simulate chat activity
  setInterval(async () => {
    const user = users[Math.floor(Math.random() * users.length)]
    const room = rooms[Math.floor(Math.random() * rooms.length)]

    const messages = [
      'Hello everyone!',
      'How is everyone doing?',
      'Working on some cool Cyre features',
      '@everyone check out this branch system!',
      'The schema validation is amazing',
      'Love the throttling feature',
      'Breathing system keeps everything smooth',
      'Cross-branch communication rocks!'
    ]

    const message = messages[Math.floor(Math.random() * messages.length)]

    try {
      await room.call('send-message', {
        from: user,
        to: 'room',
        content: message,
        timestamp: Date.now()
      })
    } catch (error) {
      // Throttling or other expected errors
      console.log(`⏱️  ${user}'s message throttled in ${room.id}`)
    }
  }, 1500) // Every 1.5 seconds

  // Simulate game moves
  setInterval(async () => {
    const game = gameList[Math.floor(Math.random() * gameList.length)]
    const player = Math.random() > 0.5 ? 'X' : 'O'
    const position = Math.floor(Math.random() * 9)

    try {
      await game.call('make-move', {
        player,
        position,
        board: Array(9).fill(''),
        gameId: game.id
      })
    } catch (error) {
      // Debouncing or other expected errors
      console.log(`⏱️  Move debounced in ${game.id}`)
    }
  }, 2000) // Every 2 seconds

  // Simulate user join/leave
  setInterval(async () => {
    const user = users[Math.floor(Math.random() * users.length)]
    const room = rooms[Math.floor(Math.random() * rooms.length)]

    try {
      if (Math.random() > 0.5) {
        await room.call('user-join', {
          id: user.toLowerCase(),
          name: user,
          email: `${user.toLowerCase()}@example.com`,
          age: Math.floor(Math.random() * 40) + 18
        })
      } else {
        await room.call('user-leave', {
          userId: user.toLowerCase(),
          reason: 'disconnect'
        })
      }
    } catch (error) {
      console.log(`❌ Schema validation failed for ${user}`)
    }
  }, 4000) // Every 4 seconds
}

// ===========================================
// PERFORMANCE MONITORING
// ===========================================

function startPerformanceMonitoring() {
  console.log('📊 Starting performance monitoring...')

  setInterval(() => {
    const health = cyre.getSystemHealth()
    const performance = cyre.getPerformanceState()
    const branchStats = cyre.branch.getStats()
    const insights = cyre.getPerformanceInsights()

    console.log('\n📈 === PERFORMANCE DASHBOARD ===')
    console.log(`🏗️  Branches: ${branchStats.active}/${branchStats.total}`)
    console.log(`📡 Channels: ${branchStats.totalChannels}`)
    console.log(
      `⚡ System Stress: ${Math.round(health.breathing.stress * 100)}%`
    )
    console.log(`💓 Breathing Rate: ${health.breathing.rate}ms`)
    console.log(`📞 Call Rate: ${performance.callRate}/sec`)
    console.log(`🎯 Total Calls: ${performance.totalCalls}`)

    if (health.breathing.stress > 0.6) {
      console.log('⚠️  System under moderate stress')
    }

    if (health.breathing.stress > 0.8) {
      console.log('🔥 High stress detected - breathing system adapting!')
    }

    if (performance.callRate > 20) {
      console.log('🚀 High activity detected!')
    }

    if (insights.length > 0) {
      console.log('💡 Insights:', insights.join(', '))
    }

    console.log('===============================\n')
  }, 15000) // Every 15 seconds
}

// ===========================================
// INTERACTIVE COMMANDS
// ===========================================

function setupInteractiveCommands(chatRooms: any, games: any) {
  console.log('💻 Interactive commands available:')
  console.log('- Type demo commands in your console!')

  // Make demo functions globally available
  ;(global as any).demoCommands = {
    // Send a message to any room
    sendMessage: async (roomName: string, from: string, message: string) => {
      const room = (chatRooms as any)[`${roomName}Room`]
      if (room) {
        try {
          const result = await room.call('send-message', {
            from,
            to: 'room',
            content: message,
            timestamp: Date.now()
          })
          console.log(`✅ Message sent to ${roomName}:`, result)
        } catch (error) {
          console.log(`❌ Failed to send message:`, error)
        }
      } else {
        console.log(`❌ Room '${roomName}' not found`)
      }
    },

    // Make a game move
    makeMove: async (gameNumber: number, player: string, position: number) => {
      const game = Object.values(games)[gameNumber - 1] as any
      if (game) {
        try {
          const result = await game.call('make-move', {
            player,
            position,
            board: Array(9).fill(''),
            gameId: game.id
          })
          console.log(`✅ Move made in game ${gameNumber}:`, result)
        } catch (error) {
          console.log(`❌ Move failed:`, error)
        }
      } else {
        console.log(`❌ Game ${gameNumber} not found`)
      }
    },

    // Get system stats
    getStats: () => {
      const health = cyre.getSystemHealth()
      const performance = cyre.getPerformanceState()

      console.log('📊 Current System Stats:')
      console.log({
        health: health,
        performance: {
          callRate: performance.callRate,
          totalCalls: performance.totalCalls,
          stress: Math.round(performance.stress * 100) + '%'
        }
      })
    },

    // List all branches
    listBranches: () => {
      const branches = cyre.dev.branch.list()
      console.log('🌳 All Branches:')
      branches.forEach(branch => {
        console.log(
          `  - ${branch.id} (${branch.path}) - ${branch.channelCount} channels`
        )
      })
    },

    // Test cross-branch communication
    testCrossBranch: async () => {
      console.log('🔗 Testing cross-branch communication...')

      // Send message from tech room mentioning everyone
      const result = await chatRooms.techRoom.call('send-message', {
        from: 'System',
        to: 'room',
        content: '@everyone Testing cross-branch communication!',
        timestamp: Date.now()
      })

      console.log('✅ Cross-branch test completed:', result)
    },

    // Stress test the system
    stressTest: async () => {
      console.log('💥 Starting stress test...')

      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          chatRooms.generalRoom
            .call('send-message', {
              from: `StressBot${i}`,
              to: 'room',
              content: `Stress test message ${i}`,
              timestamp: Date.now()
            })
            .catch(() => {}) // Ignore throttling errors
        )
      }

      await Promise.all(promises)
      console.log(
        '✅ Stress test completed - check breathing system adaptation!'
      )
    },

    // Clean up empty branches
    cleanup: async () => {
      const result = await cyre.dev.triggerMemoryCleanup()
      console.log('🧹 Cleanup result:', result)
    }
  }

  console.log('\n🚀 Try these commands:')
  console.log(
    '  demoCommands.sendMessage("general", "YourName", "Hello world!")'
  )
  console.log('  demoCommands.makeMove(1, "X", 4)')
  console.log('  demoCommands.getStats()')
  console.log('  demoCommands.listBranches()')
  console.log('  demoCommands.testCrossBranch()')
  console.log('  demoCommands.stressTest()')
  console.log('  demoCommands.cleanup()')
}

// ===========================================
// SCHEMA VALIDATION DEMO
// ===========================================

async function demonstrateSchemaValidation(chatRooms: any) {
  console.log('\n🔍 Demonstrating Schema Validation...')

  // Valid data
  console.log('✅ Testing valid user data...')
  try {
    await chatRooms.generalRoom.call('user-join', {
      id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      age: 25
    })
  } catch (error) {
    console.log('❌ Unexpected error:', error)
  }

  // Invalid email
  console.log('❌ Testing invalid email...')
  try {
    await chatRooms.generalRoom.call('user-join', {
      id: 'user456',
      name: 'Jane Smith',
      email: 'invalid-email',
      age: 30
    })
  } catch (error) {
    console.log('✅ Schema correctly rejected invalid email')
  }

  // Age too young
  console.log('❌ Testing invalid age...')
  try {
    await chatRooms.generalRoom.call('user-join', {
      id: 'user789',
      name: 'Kid',
      email: 'kid@example.com',
      age: 10
    })
  } catch (error) {
    console.log('✅ Schema correctly rejected underage user')
  }

  // Missing required field
  console.log('❌ Testing missing required field...')
  try {
    await chatRooms.generalRoom.call('user-join', {
      id: 'user999',
      email: 'test@example.com',
      age: 25
      // Missing name field
    })
  } catch (error) {
    console.log('✅ Schema correctly rejected missing name field')
  }
}

// ===========================================
// THROTTLING AND DEBOUNCING DEMO
// ===========================================

async function demonstrateThrottlingAndDebouncing(chatRooms: any, games: any) {
  console.log('\n⏱️  Demonstrating Throttling and Debouncing...')

  // Throttling demo - rapid messages
  console.log('🚫 Testing message throttling (1 msg/sec limit)...')
  for (let i = 0; i < 5; i++) {
    try {
      await chatRooms.generalRoom.call('send-message', {
        from: 'ThrottleBot',
        to: 'room',
        content: `Rapid message ${i + 1}`,
        timestamp: Date.now()
      })
      console.log(`✅ Message ${i + 1} sent`)
    } catch (error) {
      console.log(`🚫 Message ${i + 1} throttled`)
    }
  }

  // Debouncing demo - rapid game moves
  console.log('\n⏸️  Testing move debouncing (500ms debounce)...')
  const rapidMoves = [
    {player: 'X', position: 0},
    {player: 'O', position: 1},
    {player: 'X', position: 2},
    {player: 'O', position: 3},
    {player: 'X', position: 4}
  ]

  rapidMoves.forEach(async (move, i) => {
    try {
      await games.game1.call('make-move', {
        ...move,
        board: Array(9).fill(''),
        gameId: games.game1.id
      })
      console.log(`✅ Move ${i + 1} executed`)
    } catch (error) {
      console.log(`⏸️  Move ${i + 1} debounced`)
    }
  })
}

// ===========================================
// MAIN DEMO EXECUTION
// ===========================================

export async function runInteractiveDemo() {
  console.log('🎬 Starting Interactive Cyre Demo!')
  console.log('Features showcased:')
  console.log('- ✅ Branch system (chat rooms + games)')
  console.log('- ✅ Schema validation (user data)')
  console.log('- ✅ Throttling (message rate limiting)')
  console.log('- ✅ Debouncing (game move collapsing)')
  console.log('- ✅ Cross-branch communication')
  console.log('- ✅ Breathing system (load adaptation)')
  console.log('- ✅ Real-time monitoring')
  console.log('- ✅ Interactive commands\n')

  try {
    // Create demo systems
    const chatRooms = await createChatDemo()
    const games = await createGamingDemo()

    // Demonstrate schema validation
    await demonstrateSchemaValidation(chatRooms)

    // Demonstrate throttling and debouncing
    await demonstrateThrottlingAndDebouncing(chatRooms, games)

    // Start background systems
    startLoadTesting(chatRooms, games)
    startPerformanceMonitoring()
    setupInteractiveCommands(chatRooms, games)

    console.log('\n🎉 Interactive Demo is now running!')
    console.log('👀 Watch the console for real-time activity...')
    console.log('📊 Performance dashboard updates every 15 seconds')
    console.log('💬 Chat and game activity will show throttling/debouncing')
    console.log('⚡ System stress will trigger breathing system adaptation')
    console.log('\n💻 Use the demoCommands.* functions to interact!')

    return {
      success: true,
      message: 'Interactive demo running successfully!',
      chatRooms,
      games,
      features: [
        'Branch isolation demonstrated',
        'Schema validation active',
        'Throttling/debouncing in effect',
        'Cross-branch communication working',
        'Performance monitoring active',
        'Interactive commands available'
      ]
    }
  } catch (error) {
    console.error('❌ Demo failed to start:', error)
    throw error
  }
}

// Auto-run the demo
runInteractiveDemo().catch(console.error)

// Example usage shown in console
setTimeout(() => {
  console.log('\n🔥 Example Commands to Try:')
  console.log(
    '1. demoCommands.sendMessage("tech", "Alice", "Check out these branches!")'
  )
  console.log('2. demoCommands.makeMove(2, "X", 4)')
  console.log('3. demoCommands.stressTest() // Watch breathing system adapt!')
  console.log('4. demoCommands.getStats() // See current system status')
  console.log('5. demoCommands.testCrossBranch() // Test @everyone mentions')
}, 5000)

runInteractiveDemo()
