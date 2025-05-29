// src/state-machine/examples.ts
// Comprehensive examples of state machine usage with Cyre

import {
  stateMachineService,
  createAndStartStateMachine
} from './state-machine-service'
import {machine, patterns} from './builders'

/*

      C.Y.R.E - S.T.A.T.E - M.A.C.H.I.N.E - E.X.A.M.P.L.E.S
      
      Real-world examples demonstrating state machine integration:
      - E-commerce order processing
      - File upload workflow
      - User authentication
      - Game state management
      - API request handling

*/

// Lazy load cyre to avoid circular dependency
let cyre: any
const getCyre = () => {
  if (!cyre) {
    cyre = require('../app').cyre
  }
  return cyre
}

/**
 * Example 1: E-commerce Order Processing
 */
export const createOrderProcessingMachine = () => {
  interface OrderContext {
    orderId: string
    items: Array<{id: string; quantity: number; price: number}>
    customerInfo: {name: string; email: string; address: string}
    paymentInfo: {method: string; token?: string}
    total: number
    attempts: number
    maxAttempts: number
  }

  const orderMachine = machine<OrderContext>('order-processor')
    .initial('pending')
    .context({
      orderId: '',
      items: [],
      customerInfo: {name: '', email: '', address: ''},
      paymentInfo: {method: ''},
      total: 0,
      attempts: 0,
      maxAttempts: 3
    })
    .guards({
      hasValidItems: context => context.items.length > 0,
      hasValidCustomer: context => !!context.customerInfo.email,
      hasValidPayment: context => !!context.paymentInfo.method,
      canRetryPayment: context => context.attempts < context.maxAttempts,
      isHighValue: context => context.total > 1000
    })
    .actions({
      calculateTotal: context => {
        context.total = context.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        )
      },
      incrementAttempts: context => {
        context.attempts += 1
      },
      resetAttempts: context => {
        context.attempts = 0
      },
      notifyCustomer: async (context, event) => {
        await getCyre().call('send-email', {
          to: context.customerInfo.email,
          subject: 'Order Update',
          body: `Your order ${context.orderId} status: ${event.type}`
        })
      },
      logOrderEvent: (context, event) => {
        console.log(`Order ${context.orderId}: ${event.type}`)
      }
    })
    .state('pending')
    .entry('logOrderEvent')
    .on('SUBMIT', 'validating')
    .on('CANCEL', 'cancelled')
    .state('validating')
    .entry(['calculateTotal', 'logOrderEvent'])
    .when('VALIDATION_COMPLETE', 'hasValidItems', 'itemValidation')
    .on('VALIDATION_FAILED', 'rejected')
    .after(30000, 'timeout')
    .state('itemValidation')
    .when('ITEMS_VALID', 'hasValidCustomer', 'customerValidation')
    .on('ITEMS_INVALID', 'rejected')
    .state('customerValidation')
    .when('CUSTOMER_VALID', 'hasValidPayment', 'paymentValidation')
    .on('CUSTOMER_INVALID', 'rejected')
    .state('paymentValidation')
    .on('PAYMENT_VALID', 'processing')
    .on('PAYMENT_INVALID', 'rejected')
    .state('processing')
    .entry(['resetAttempts', 'logOrderEvent'])
    .when('PAYMENT_SUCCESS', 'isHighValue', 'manualReview')
    .on('PAYMENT_SUCCESS', 'fulfilling')
    .when('PAYMENT_FAILED', 'canRetryPayment', 'paymentRetry')
    .on('PAYMENT_FAILED', 'paymentFailed')
    .after(60000, 'timeout')
    .state('paymentRetry')
    .entry('incrementAttempts')
    .on('RETRY_PAYMENT', 'processing')
    .after(10000, 'processing') // Auto-retry after 10s
    .state('manualReview')
    .entry('notifyCustomer')
    .on('APPROVE', 'fulfilling')
    .on('REJECT', 'rejected')
    .after(86400000, 'rejected') // 24h review timeout
    .state('fulfilling')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .on('SHIPPED', 'shipped')
    .on('FULFILLMENT_FAILED', 'fulfillmentError')
    .after(120000, 'fulfillmentError') // 2min fulfillment timeout
    .state('shipped')
    .entry('notifyCustomer')
    .on('DELIVERED', 'completed')
    .on('DELIVERY_FAILED', 'deliveryError')
    .after(604800000, 'deliveryError') // 7 day delivery timeout
    .state('completed')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .final()
    .state('cancelled')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .final()
    .state('rejected')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .final()
    .state('timeout')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .final()
    .state('paymentFailed')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .on('RETRY_PAYMENT', 'processing')
    .final()
    .state('fulfillmentError')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .on('RETRY_FULFILLMENT', 'fulfilling')
    .final()
    .state('deliveryError')
    .entry(['notifyCustomer', 'logOrderEvent'])
    .on('RETRY_DELIVERY', 'shipped')
    .final()
    .priority('high')
    .debug(true)
    .build()

  return createAndStartStateMachine(orderMachine)
}

/**
 * Example 2: File Upload Workflow
 */
export const createFileUploadMachine = () => {
  interface UploadContext {
    files: File[]
    currentFileIndex: number
    uploadedFiles: string[]
    failedFiles: Array<{file: File; error: string}>
    totalSize: number
    uploadedSize: number
    retryAttempts: number
    maxRetries: number
  }

  const uploadMachine = machine<UploadContext>('file-uploader')
    .initial('idle')
    .context({
      files: [],
      currentFileIndex: 0,
      uploadedFiles: [],
      failedFiles: [],
      totalSize: 0,
      uploadedSize: 0,
      retryAttempts: 0,
      maxRetries: 3
    })
    .guards({
      hasFiles: context => context.files.length > 0,
      hasMoreFiles: context => context.currentFileIndex < context.files.length,
      canRetry: context => context.retryAttempts < context.maxRetries,
      allFilesProcessed: context =>
        context.currentFileIndex >= context.files.length
    })
    .actions({
      calculateTotalSize: context => {
        context.totalSize = context.files.reduce(
          (sum, file) => sum + file.size,
          0
        )
      },
      moveToNextFile: context => {
        context.currentFileIndex += 1
        context.retryAttempts = 0
      },
      incrementRetry: context => {
        context.retryAttempts += 1
      },
      addToUploaded: (context, event) => {
        const fileUrl = event.payload?.url
        if (fileUrl) {
          context.uploadedFiles.push(fileUrl)
          context.uploadedSize += context.files[context.currentFileIndex].size
        }
      },
      addToFailed: (context, event) => {
        const error = event.payload?.error || 'Unknown error'
        context.failedFiles.push({
          file: context.files[context.currentFileIndex],
          error
        })
      },
      updateProgress: (context, event) => {
        // Update upload progress from Cyre event
        cyre.call('upload-progress-update', {
          current: context.currentFileIndex + 1,
          total: context.files.length,
          bytesUploaded: context.uploadedSize,
          totalBytes: context.totalSize,
          progress: (context.uploadedSize / context.totalSize) * 100
        })
      }
    })
    .state('idle')
    .on('SELECT_FILES', 'validating')
    .state('validating')
    .entry(['calculateTotalSize'])
    .when('FILES_SELECTED', 'hasFiles', 'uploading')
    .on('NO_FILES', 'idle')
    .after(5000, 'idle') // Auto-reset if stuck
    .state('uploading')
    .entry(['updateProgress'])
    .on('UPLOAD_SUCCESS', 'fileCompleted')
    .on('UPLOAD_ERROR', 'fileError')
    .on('PAUSE', 'paused')
    .on('CANCEL', 'cancelled')
    .after(300000, 'timeout') // 5 min per file timeout
    .state('fileCompleted')
    .entry(['addToUploaded', 'moveToNextFile', 'updateProgress'])
    .when('CONTINUE', 'hasMoreFiles', 'uploading')
    .when('CONTINUE', 'allFilesProcessed', 'completed')
    .state('fileError')
    .entry(['incrementRetry'])
    .when('RETRY', 'canRetry', 'uploading')
    .do('SKIP', 'fileSkipped', 'addToFailed', 'moveToNextFile')
    .on('CANCEL', 'cancelled')
    .state('fileSkipped')
    .when('CONTINUE', 'hasMoreFiles', 'uploading')
    .when('CONTINUE', 'allFilesProcessed', 'completed')
    .state('paused')
    .on('RESUME', 'uploading')
    .on('CANCEL', 'cancelled')
    .state('completed')
    .entry('updateProgress')
    .final()
    .state('cancelled')
    .entry('updateProgress')
    .final()
    .state('timeout')
    .entry('updateProgress')
    .on('RETRY', 'uploading')
    .final()
    .build()

  return createAndStartStateMachine(uploadMachine)
}

/**
 * Example 3: Game State Management
 */
export const createGameStateMachine = () => {
  interface GameContext {
    player: {
      name: string
      level: number
      health: number
      maxHealth: number
      score: number
    }
    currentLevel: number
    lives: number
    isPaused: boolean
    gameTime: number
    powerUps: string[]
  }

  const gameMachine = machine<GameContext>('game-controller')
    .initial('menu')
    .context({
      player: {
        name: '',
        level: 1,
        health: 100,
        maxHealth: 100,
        score: 0
      },
      currentLevel: 1,
      lives: 3,
      isPaused: false,
      gameTime: 0,
      powerUps: []
    })
    .guards({
      hasLives: context => context.lives > 0,
      isHealthLow: context => context.player.health < 30,
      canLevelUp: context => context.player.score >= context.currentLevel * 1000
    })
    .actions({
      startGame: context => {
        context.gameTime = Date.now()
        context.isPaused = false
      },
      pauseGame: context => {
        context.isPaused = true
      },
      resumeGame: context => {
        context.isPaused = false
      },
      loseLife: context => {
        context.lives -= 1
        context.player.health = context.player.maxHealth
      },
      levelUp: context => {
        context.currentLevel += 1
        context.player.level += 1
        context.player.maxHealth += 20
        context.player.health = context.player.maxHealth
      },
      saveHighScore: async context => {
        await getCyre().call('save-high-score', {
          player: context.player.name,
          score: context.player.score,
          level: context.currentLevel
        })
      }
    })
    .state('menu')
    .on('START_GAME', 'playing')
    .on('LOAD_GAME', 'playing')
    .on('SETTINGS', 'settings')
    .on('QUIT', 'quit')
    .state('settings')
    .on('SAVE_SETTINGS', 'menu')
    .on('CANCEL', 'menu')
    .state('playing')
    .entry(['startGame'])
    .on('PAUSE', 'paused')
    .on('PLAYER_DIED', 'playerDied')
    .when('LEVEL_COMPLETE', 'canLevelUp', 'levelComplete')
    .on('BOSS_ENCOUNTER', 'bossPhase')
    .on('POWER_UP_COLLECTED', 'powerUpActive')
    .on('QUIT_TO_MENU', 'menu')
    .state('paused')
    .entry('pauseGame')
    .on('RESUME', 'playing')
    .on('QUIT_TO_MENU', 'menu')
    .on('RESTART', 'playing')
    .state('playerDied')
    .entry('loseLife')
    .when('RESPAWN', 'hasLives', 'playing')
    .on('RESPAWN', 'gameOver')
    .state('levelComplete')
    .entry('levelUp')
    .on('NEXT_LEVEL', 'playing')
    .on('QUIT_TO_MENU', 'menu')
    .after(5000, 'playing') // Auto-advance after 5s
    .state('bossPhase')
    .on('BOSS_DEFEATED', 'levelComplete')
    .on('PLAYER_DIED', 'playerDied')
    .on('PAUSE', 'paused')
    .after(600000, 'playerDied') // 10 min boss timeout
    .state('powerUpActive')
    .on('POWER_UP_EXPIRED', 'playing')
    .on('PLAYER_DIED', 'playerDied')
    .on('PAUSE', 'paused')
    .after(30000, 'playing') // Power-up lasts 30s
    .state('gameOver')
    .entry(['saveHighScore'])
    .on('RESTART', 'playing')
    .on('QUIT_TO_MENU', 'menu')
    .state('quit')
    .final()
    .priority('medium')
    .debug(true)
    .build()

  return createAndStartStateMachine(gameMachine)
}

/**
 * Example 4: API Request with Circuit Breaker
 */
export const createApiRequestMachine = () => {
  interface ApiContext {
    url: string
    method: string
    data?: any
    response?: any
    error?: string
    retryCount: number
    maxRetries: number
    circuitFailures: number
    circuitThreshold: number
    lastFailureTime: number
  }

  const apiMachine = machine<ApiContext>('api-request')
    .initial('idle')
    .context({
      url: '',
      method: 'GET',
      retryCount: 0,
      maxRetries: 3,
      circuitFailures: 0,
      circuitThreshold: 5,
      lastFailureTime: 0
    })
    .guards({
      canRetry: context => context.retryCount < context.maxRetries,
      circuitClosed: context =>
        context.circuitFailures < context.circuitThreshold,
      circuitCanReset: context => {
        const now = Date.now()
        const timeSinceLastFailure = now - context.lastFailureTime
        return timeSinceLastFailure > 60000 // 1 minute cooldown
      }
    })
    .actions({
      makeRequest: async (context, event) => {
        await getCyre().call('http-request', {
          url: context.url,
          method: context.method,
          data: context.data
        })
      },
      incrementRetry: context => {
        context.retryCount += 1
      },
      resetRetry: context => {
        context.retryCount = 0
      },
      recordFailure: context => {
        context.circuitFailures += 1
        context.lastFailureTime = Date.now()
      },
      resetCircuit: context => {
        context.circuitFailures = 0
      },
      storeResponse: (context, event) => {
        context.response = event.payload
      },
      storeError: (context, event) => {
        context.error = event.payload?.message || 'Request failed'
      }
    })
    .state('idle')
    .on('REQUEST', 'checking')
    .state('checking')
    .when('PROCEED', 'circuitClosed', 'requesting')
    .when('PROCEED', 'circuitCanReset', 'halfOpen')
    .on('PROCEED', 'circuitOpen')
    .state('requesting')
    .entry(['makeRequest'])
    .on('SUCCESS', 'success')
    .on('FAILURE', 'failure')
    .after(30000, 'timeout')
    .state('success')
    .entry(['storeResponse', 'resetRetry', 'resetCircuit'])
    .on('NEW_REQUEST', 'idle')
    .final()
    .state('failure')
    .entry(['storeError', 'incrementRetry', 'recordFailure'])
    .when('RETRY', 'canRetry', 'requesting')
    .on('RETRY', 'exhausted')
    .on('GIVE_UP', 'exhausted')
    .after(5000, 'requesting') // Auto-retry after 5s
    .state('timeout')
    .entry(['storeError', 'incrementRetry', 'recordFailure'])
    .when('RETRY', 'canRetry', 'requesting')
    .on('RETRY', 'exhausted')
    .state('exhausted')
    .entry(['storeError'])
    .on('NEW_REQUEST', 'idle')
    .final()
    .state('circuitOpen')
    .entry(['storeError'])
    .after(60000, 'idle') // Circuit breaker timeout
    .state('halfOpen')
    .entry(['makeRequest'])
    .on('SUCCESS', 'success')
    .on('FAILURE', 'circuitOpen')
    .after(10000, 'circuitOpen')
    .build()

  return createAndStartStateMachine(apiMachine)
}

/**
 * Example 5: User Onboarding Flow
 */
export const createOnboardingMachine = () => {
  interface OnboardingContext {
    user: {
      email: string
      name: string
      preferences: Record<string, any>
      avatar?: string
    }
    currentStep: number
    totalSteps: number
    completedSteps: Set<string>
    skippedSteps: Set<string>
    startTime: number
  }

  // Using the wizard pattern with customization
  const baseConfig = patterns.wizard<OnboardingContext>(
    'user-onboarding',
    ['welcome', 'profile', 'preferences', 'avatar', 'tutorial', 'verification'],
    {canGoBack: true, finalState: 'onboarded'}
  )

  // Enhance with custom context and actions
  const onboardingMachine = {
    ...baseConfig,
    context: {
      user: {
        email: '',
        name: '',
        preferences: {}
      },
      currentStep: 0,
      totalSteps: 6,
      completedSteps: new Set<string>(),
      skippedSteps: new Set<string>(),
      startTime: Date.now()
    },
    actions: {
      trackStep: (context: OnboardingContext, event: any) => {
        getCyre().call('analytics-track', {
          event: 'onboarding_step',
          step: event.payload?.step,
          timestamp: Date.now(),
          userId: context.user.email
        })
      },
      completeOnboarding: async (context: OnboardingContext) => {
        const duration = Date.now() - context.startTime
        await getCyre().call('complete-onboarding', {
          user: context.user,
          duration,
          completedSteps: Array.from(context.completedSteps),
          skippedSteps: Array.from(context.skippedSteps)
        })
      }
    }
  }

  // Add custom entry actions to states
  const enhancedStates = Object.entries(onboardingMachine.states).reduce(
    (acc, [stateId, stateConfig]) => {
      acc[stateId] = {
        ...stateConfig,
        entry: [...(stateConfig.entry || []), 'trackStep']
      }
      return acc
    },
    {} as any
  )

  enhancedStates.onboarded.entry = [
    ...(enhancedStates.onboarded.entry || []),
    'completeOnboarding'
  ]

  const finalConfig = {
    ...onboardingMachine,
    states: enhancedStates
  }

  return createAndStartStateMachine(finalConfig)
}

/**
 * Example integration with Cyre streams
 */
export const createIntegratedWorkflow = () => {
  // Create state machine
  const workflowMachine = createOrderProcessingMachine()

  // Create corresponding Cyre stream for real-time updates
  const orderUpdatesStream = getCyre().createStream({
    id: 'order-updates',
    debug: true
  })

  // Connect state machine changes to stream
  workflowMachine.onStateChange(stateChange => {
    orderUpdatesStream.next({
      orderId: stateChange.context.orderId,
      state: stateChange.to.current,
      previousState: stateChange.from.current,
      timestamp: stateChange.timestamp,
      context: stateChange.context
    })
  })

  // Process stream for analytics and notifications
  orderUpdatesStream
    .filter(update =>
      ['completed', 'cancelled', 'rejected'].includes(update.state)
    )
    .subscribe(finalUpdate => {
      getCyre().call('order-analytics', {
        type: 'order_final_state',
        orderId: finalUpdate.orderId,
        finalState: finalUpdate.state,
        processingTime: finalUpdate.timestamp - finalUpdate.context.startTime
      })
    })

  return {
    machine: workflowMachine,
    stream: orderUpdatesStream,

    // Utility methods
    processOrder: (orderData: any) => {
      workflowMachine.send('SUBMIT', orderData)
    },

    getOrderStatus: () => {
      return workflowMachine.getSnapshot()
    },

    cancelOrder: () => {
      workflowMachine.send('CANCEL')
    }
  }
}

/**
 * Usage examples
 */
export const usageExamples = {
  // Simple usage
  basic: () => {
    const machine = createOrderProcessingMachine()

    // Send events
    machine.send('SUBMIT', {orderId: '12345', items: []})
    machine.send('VALIDATION_COMPLETE')

    // Listen to state changes
    const unsubscribe = machine.onStateChange(change => {
      console.log(
        `Order ${change.context.orderId}: ${change.from.current} → ${change.to.current}`
      )
    })

    return unsubscribe
  },

  // Integration with Cyre actions
  withCyreActions: () => {
    const machine = createGameStateMachine()

    // Set up Cyre actions to control the machine
    getCyre().action({id: 'game-start', payload: {}})
    getCyre().on('game-start', () => {
      machine.send('START_GAME')
    })

    getCyre().action({id: 'game-pause', payload: {}})
    getCyre().on('game-pause', () => {
      machine.send('PAUSE')
    })

    // Game can trigger Cyre actions
    machine.onState('gameOver', context => {
      getCyre().call('show-game-over-screen', {
        score: context.player.score,
        level: context.currentLevel
      })
    })
  },

  // Multiple machines coordination
  coordination: () => {
    const authMachine = patterns.auth('user-auth')
    const gameMachine = createGameStateMachine()

    // Create auth machine
    const auth = createAndStartStateMachine(authMachine)
    const game = createAndStartStateMachine(gameMachine)

    // Coordinate between machines
    auth.onState('authenticated', () => {
      game.send('START_GAME')
    })

    auth.onState('unauthenticated', () => {
      if (game.state.current === 'playing') {
        game.send('PAUSE')
      }
    })

    return {auth, game}
  }
}
