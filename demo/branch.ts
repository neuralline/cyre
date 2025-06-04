// examples/branch-system-usage.ts
// Branch system usage examples and patterns

import {cyre, createBranch, type Branch, type BranchSetup} from '../src'

/*

      C.Y.R.E - B.R.A.N.C.H - E.X.A.M.P.L.E.S
      
      Comprehensive examples of branch system usage:
      - Component isolation and reuse
      - Cross-branch communication
      - Path-based addressing
      - Real-world application patterns

*/

// ===========================================
// EXAMPLE 1: Basic Branch Creation
// ===========================================

console.log('=== Example 1: Basic Branch Creation ===')

// Initialize Cyre
await cyre.initialize()

// Create child branches
const userBranch = createBranch() // Creates under root
const adminBranch = createBranch() // Creates under root
const productBranch = createBranch(userBranch) // Creates under userBranch

console.log('Branches created:')
console.log('- User branch:', userBranch.path)
console.log('- Admin branch:', adminBranch.path)
console.log('- Product branch:', productBranch.path)

// ===========================================
// EXAMPLE 2: Component Duplication (Carousel)
// ===========================================

console.log('\n=== Example 2: Component Duplication ===')

// Define reusable carousel setup
const carouselSetup: BranchSetup = {
  actions: [
    {id: 'next-slide', payload: {currentSlide: 0}},
    {id: 'prev-slide', payload: {currentSlide: 0}},
    {id: 'set-auto-play', payload: {enabled: false, interval: 3000}},
    {id: 'goto-slide', payload: {slideIndex: 0}}
  ],
  subscriptions: [
    {
      id: 'next-slide',
      handler: (payload: any) => {
        console.log('Next slide triggered:', payload)
        return {currentSlide: payload.currentSlide + 1}
      }
    },
    {
      id: 'prev-slide',
      handler: (payload: any) => {
        console.log('Previous slide triggered:', payload)
        return {currentSlide: Math.max(0, payload.currentSlide - 1)}
      }
    },
    {
      id: 'goto-slide',
      handler: (payload: any) => {
        console.log('Go to slide:', payload.slideIndex)
        return {currentSlide: payload.slideIndex}
      }
    }
  ]
}

// Create multiple carousel instances
const heroCarousel = createBranch(undefined, {id: 'hero-carousel'})
const productCarousel = createBranch(undefined, {id: 'product-carousel'})
const testimonialCarousel = createBranch(undefined, {
  id: 'testimonial-carousel'
})

// Setup each carousel with same configuration
heroCarousel.setup(carouselSetup)
productCarousel.setup(carouselSetup)
testimonialCarousel.setup(carouselSetup)

// Test isolated operation
await heroCarousel.call('next-slide', {currentSlide: 0})
await productCarousel.call('next-slide', {currentSlide: 2})
await testimonialCarousel.call('goto-slide', {slideIndex: 5})

console.log('Carousel instances created and tested - no ID conflicts!')

// ===========================================
// EXAMPLE 3: Cross-Branch Communication
// ===========================================

console.log('\n=== Example 3: Cross-Branch Communication ===')

// Create application structure
const appBranch = createBranch(undefined, {id: 'app'})
const headerBranch = createBranch(appBranch, {id: 'header'})
const cartBranch = createBranch(appBranch, {id: 'cart'})
const productListBranch = createBranch(appBranch, {id: 'products'})

// Setup cart management
cartBranch.action({id: 'add-item', payload: {items: []}})
cartBranch.action({id: 'get-count', payload: {count: 0}})
cartBranch.action({id: 'update-header', payload: {}})

cartBranch.on('add-item', (payload: any) => {
  console.log('Item added to cart:', payload)
  const newCount = payload.items.length + 1

  // Cross-branch call to update header
  cartBranch.call('app/header/update-badge', {count: newCount})

  return {items: [...payload.items, payload.newItem], count: newCount}
})

cartBranch.on('get-count', (payload: any) => {
  return {count: payload.count}
})

// Setup header
headerBranch.action({id: 'update-badge', payload: {count: 0}})
headerBranch.on('update-badge', (payload: any) => {
  console.log('Header cart badge updated:', payload.count)
  return {badgeCount: payload.count}
})

// Setup product list
productListBranch.action({id: 'add-to-cart', payload: {}})
productListBranch.on('add-to-cart', (payload: any) => {
  console.log('Product selected:', payload.productId)

  // Cross-branch call to cart
  productListBranch.call('app/cart/add-item', {
    newItem: {id: payload.productId, name: payload.productName}
  })

  return {success: true}
})

// Test cross-branch communication
await productListBranch.call('add-to-cart', {
  productId: 'p123',
  productName: 'Awesome Product'
})

// ===========================================
// EXAMPLE 4: Path-Based Addressing
// ===========================================

console.log('\n=== Example 4: Path-Based Addressing ===')

// Create hierarchical structure
const ecommerceBranch = createBranch(undefined, {id: 'ecommerce'})
const usersBranch = createBranch(ecommerceBranch, {id: 'users'})
const profileBranch = createBranch(usersBranch, {id: 'profile'})
const settingsBranch = createBranch(profileBranch, {id: 'settings'})

// Setup actions at different levels
settingsBranch.action({id: 'update-email', payload: {email: ''}})
settingsBranch.action({id: 'update-password', payload: {password: ''}})
profileBranch.action({id: 'update-avatar', payload: {avatar: ''}})
usersBranch.action({id: 'get-user', payload: {userId: ''}})

// Setup handlers
settingsBranch.on('update-email', (payload: any) => {
  console.log('Email updated via path:', payload.email)
  return {success: true, email: payload.email}
})

profileBranch.on('update-avatar', (payload: any) => {
  console.log('Avatar updated:', payload.avatar)
  return {success: true, avatar: payload.avatar}
})

// Test path-based calls
await cyre.call('ecommerce/users/profile/settings/update-email', {
  email: 'user@example.com'
})

await cyre.call('ecommerce/users/profile/update-avatar', {
  avatar: 'new-avatar.jpg'
})

// Test relative path calls from within branch
await settingsBranch.call('../update-avatar', {avatar: 'relative-avatar.jpg'})

// ===========================================
// EXAMPLE 5: Multi-User Sessions
// ===========================================

console.log('\n=== Example 5: Multi-User Sessions ===')

// Create user session branches
const createUserSession = (userId: string) => {
  const sessionBranch = createBranch(undefined, {id: `user-${userId}`})

  // Setup user-specific state
  sessionBranch.action({id: 'shopping-cart', payload: {items: [], total: 0}})
  sessionBranch.action({
    id: 'preferences',
    payload: {theme: 'light', language: 'en'}
  })
  sessionBranch.action({id: 'notifications', payload: {unread: 0}})

  // Setup handlers
  sessionBranch.on('shopping-cart', (payload: any) => {
    console.log(`User ${userId} cart update:`, payload)
    return payload
  })

  sessionBranch.on('preferences', (payload: any) => {
    console.log(`User ${userId} preferences:`, payload)
    return payload
  })

  return sessionBranch
}

// Create multiple user sessions
const user1Session = createUserSession('123')
const user2Session = createUserSession('456')
const user3Session = createUserSession('789')

// Test isolated user actions
await user1Session.call('shopping-cart', {
  items: [{id: 'p1', name: 'Product 1'}],
  total: 29.99
})

await user2Session.call('shopping-cart', {
  items: [
    {id: 'p2', name: 'Product 2'},
    {id: 'p3', name: 'Product 3'}
  ],
  total: 59.98
})

await user3Session.call('preferences', {
  theme: 'dark',
  language: 'es'
})

console.log('User sessions created with isolated state!')

// ===========================================
// EXAMPLE 6: A/B Testing with Branches
// ===========================================

console.log('\n=== Example 6: A/B Testing ===')

const createExperimentVariant = (variantName: string, config: any) => {
  const variantBranch = createBranch(undefined, {
    id: `experiment-${variantName}`
  })

  variantBranch.action({
    id: 'checkout-flow',
    payload: {
      version: variantName,
      config: config,
      conversions: 0,
      views: 0
    }
  })

  variantBranch.on('checkout-flow', (payload: any) => {
    console.log(`${variantName} checkout triggered:`, payload)
    return {
      ...payload,
      views: payload.views + 1
    }
  })

  return variantBranch
}

// Create A/B test variants
const variantA = createExperimentVariant('control', {
  buttonColor: 'blue',
  buttonText: 'Buy Now',
  layout: 'standard'
})

const variantB = createExperimentVariant('test', {
  buttonColor: 'green',
  buttonText: 'Get Yours Today!',
  layout: 'enhanced'
})

// Test both variants
await variantA.call('checkout-flow', {action: 'view'})
await variantB.call('checkout-flow', {action: 'view'})

// Simulate A/B test routing
const assignUserToVariant = (userId: string) => {
  return parseInt(userId) % 2 === 0 ? 'control' : 'test'
}

const testUserId = '12345'
const assignedVariant = assignUserToVariant(testUserId)
console.log(`User ${testUserId} assigned to variant: ${assignedVariant}`)

// Route to appropriate variant branch
await cyre.call(`experiment-${assignedVariant}/checkout-flow`, {
  userId: testUserId,
  action: 'purchase'
})

// ===========================================
// EXAMPLE 7: Component Library Pattern
// ===========================================

console.log('\n=== Example 7: Component Library ===')

// Generic component factory
const createModalComponent = (modalId: string, config: any) => {
  const modalBranch = createBranch(undefined, {id: modalId})

  modalBranch.action({id: 'show', payload: {visible: false, content: ''}})
  modalBranch.action({id: 'hide', payload: {visible: false}})
  modalBranch.action({id: 'set-content', payload: {content: ''}})

  modalBranch.on('show', (payload: any) => {
    console.log(`Modal ${modalId} shown:`, payload.content)
    return {visible: true, content: payload.content}
  })

  modalBranch.on('hide', () => {
    console.log(`Modal ${modalId} hidden`)
    return {visible: false, content: ''}
  })

  modalBranch.on('set-content', (payload: any) => {
    console.log(`Modal ${modalId} content set:`, payload.content)
    return {content: payload.content}
  })

  return modalBranch
}

// Create multiple modal instances
const confirmModal = createModalComponent('confirm-modal', {type: 'confirm'})
const infoModal = createModalComponent('info-modal', {type: 'info'})
const errorModal = createModalComponent('error-modal', {type: 'error'})

// Test modal operations
await confirmModal.call('show', {content: 'Are you sure you want to delete?'})
await infoModal.call('show', {content: 'Operation completed successfully!'})
await errorModal.call('show', {content: 'An error occurred. Please try again.'})

// Later hide them
await confirmModal.call('hide')
await infoModal.call('hide')
await errorModal.call('hide')

console.log('Component library pattern demonstrated!')

// ===========================================
// EXAMPLE 8: Development Tools Integration
// ===========================================

console.log('\n=== Example 8: Development Tools ===')

// Inspect system state
const systemSnapshot = cyre.dev.snapshot()
console.log('System snapshot:', {
  totalBranches: systemSnapshot.branches.total,
  activeBranches: systemSnapshot.branches.active,
  totalChannels: systemSnapshot.channels.total
})

// Inspect specific branch
const branchInfo = cyre.dev.branch.inspect('hero-carousel')
console.log('Hero carousel branch info:', branchInfo)

// Test cross-branch communication
const commTest = await cyre.dev.branch.testCommunication(
  'user-123',
  'app',
  'cart/add-item'
)
console.log('Communication test result:', commTest)

// List all branches
const allBranches = cyre.dev.branch.list()
console.log(
  'All branches:',
  allBranches.map(b => ({id: b.id, path: b.path}))
)

// Performance insights
const insights = cyre.getPerformanceInsights()
console.log('Performance insights:', insights)

console.log('\n=== Branch System Examples Complete ===')
console.log(
  'Branch system provides powerful isolation and communication capabilities!'
)

// ===========================================
// EXAMPLE 9: Game Development Pattern
// ===========================================

console.log('\n=== Example 9: Game Development ===')

// Create game room factory
const createGameRoom = (roomId: string, gameType: string) => {
  const roomBranch = createBranch(undefined, {id: `game-${roomId}`})

  const gameSetup: BranchSetup = {
    actions: [
      {id: 'player-join', payload: {players: [], maxPlayers: 4}},
      {id: 'player-leave', payload: {playerId: ''}},
      {id: 'game-start', payload: {status: 'waiting', startTime: 0}},
      {id: 'game-end', payload: {winner: '', scores: {}}},
      {id: 'player-move', payload: {playerId: '', move: {}}},
      {id: 'get-state', payload: {gameState: {}}}
    ],
    subscriptions: [
      {
        id: 'player-join',
        handler: (payload: any) => {
          console.log(`Room ${roomId}: Player joined`, payload.playerId)
          return {
            players: [...payload.players, payload.playerId],
            maxPlayers: payload.maxPlayers,
            canStart: payload.players.length + 1 >= 2
          }
        }
      },
      {
        id: 'player-move',
        handler: (payload: any) => {
          console.log(`Room ${roomId}: Player move`, payload)
          // Broadcast move to other players in room
          return {
            playerId: payload.playerId,
            move: payload.move,
            timestamp: Date.now()
          }
        }
      },
      {
        id: 'game-start',
        handler: (payload: any) => {
          console.log(`Room ${roomId}: Game started`)
          return {
            status: 'playing',
            startTime: Date.now(),
            gameType
          }
        }
      }
    ]
  }

  roomBranch.setup(gameSetup)
  return roomBranch
}

// Create multiple game rooms
const chessRoom1 = createGameRoom('chess-001', 'chess')
const chessRoom2 = createGameRoom('chess-002', 'chess')
const checkers1 = createGameRoom('checkers-001', 'checkers')

// Test game room isolation
await chessRoom1.call('player-join', {playerId: 'player1', players: []})
await chessRoom1.call('player-join', {
  playerId: 'player2',
  players: ['player1']
})
await chessRoom2.call('player-join', {playerId: 'player3', players: []})
await checkers1.call('player-join', {playerId: 'player4', players: []})

// Test game moves (isolated per room)
await chessRoom1.call('player-move', {
  playerId: 'player1',
  move: {from: 'e2', to: 'e4', piece: 'pawn'}
})

await chessRoom2.call('player-move', {
  playerId: 'player3',
  move: {from: 'a2', to: 'a3', piece: 'pawn'}
})

console.log('Game rooms created with isolated state!')

// ===========================================
// EXAMPLE 10: Micro-Frontend Architecture
// ===========================================

console.log('\n=== Example 10: Micro-Frontend Architecture ===')

// Create micro-frontend structure
const shellApp = createBranch(undefined, {id: 'shell'})
const navMFE = createBranch(shellApp, {id: 'navigation'})
const userMFE = createBranch(shellApp, {id: 'user-management'})
const orderMFE = createBranch(shellApp, {id: 'order-management'})
const reportMFE = createBranch(shellApp, {id: 'reporting'})

// Setup navigation MFE
navMFE.action({id: 'route-change', payload: {currentRoute: '/'}})
navMFE.action({id: 'set-active-nav', payload: {activeItem: 'home'}})

navMFE.on('route-change', (payload: any) => {
  console.log('Navigation: Route changed to', payload.route)

  // Notify other MFEs about route change
  navMFE.call('shell/user-management/route-changed', {route: payload.route})
  navMFE.call('shell/order-management/route-changed', {route: payload.route})

  return {currentRoute: payload.route, timestamp: Date.now()}
})

// Setup user management MFE
userMFE.action({id: 'route-changed', payload: {route: '/'}})
userMFE.action({id: 'login', payload: {user: null}})
userMFE.action({id: 'logout', payload: {}})

userMFE.on('login', (payload: any) => {
  console.log('User MFE: User logged in', payload.username)

  // Notify shell about login
  userMFE.call('shell/navigation/user-status-changed', {
    loggedIn: true,
    username: payload.username
  })

  return {user: {username: payload.username}, loginTime: Date.now()}
})

userMFE.on('route-changed', (payload: any) => {
  console.log('User MFE: Handling route change', payload.route)
  return {routeHandled: payload.route.startsWith('/users')}
})

// Setup order management MFE
orderMFE.action({id: 'create-order', payload: {orders: []}})
orderMFE.action({id: 'route-changed', payload: {route: '/'}})

orderMFE.on('create-order', (payload: any) => {
  console.log('Order MFE: Order created', payload.orderData)

  // Notify reporting MFE about new order
  orderMFE.call('shell/reporting/order-created', {
    orderId: payload.orderData.id,
    amount: payload.orderData.total,
    timestamp: Date.now()
  })

  return {
    orderId: payload.orderData.id,
    status: 'created',
    orders: [...payload.orders, payload.orderData]
  }
})

// Setup reporting MFE
reportMFE.action({id: 'order-created', payload: {orderEvents: []}})
reportMFE.action({id: 'generate-report', payload: {reportType: 'daily'}})

reportMFE.on('order-created', (payload: any) => {
  console.log('Reporting MFE: Recording order event', payload.orderId)
  return {
    orderEvents: [
      ...payload.orderEvents,
      {
        type: 'order_created',
        orderId: payload.orderId,
        amount: payload.amount,
        timestamp: payload.timestamp
      }
    ]
  }
})

// Test micro-frontend communication
await navMFE.call('route-change', {route: '/users/profile'})
await userMFE.call('login', {username: 'john.doe'})
await orderMFE.call('create-order', {
  orderData: {id: 'ord-123', total: 99.99, items: ['item1', 'item2']},
  orders: []
})

console.log('Micro-frontend architecture demonstrated!')

// ===========================================
// EXAMPLE 11: Branch Cleanup and Management
// ===========================================

console.log('\n=== Example 11: Branch Management ===')

// Create temporary branches for testing
const tempBranch1 = createBranch(undefined, {id: 'temp-1'})
const tempBranch2 = createBranch(undefined, {id: 'temp-2'})
const tempBranch3 = createBranch(tempBranch1, {id: 'temp-child'})

// Add some content to branches
tempBranch1.action({id: 'test-action', payload: {data: 'test'}})
tempBranch2.action({id: 'another-action', payload: {value: 42}})

// Check branch stats before cleanup
const beforeStats = cyre.branch.getStats()
console.log('Branches before cleanup:', beforeStats.total)

// Test branch destruction
const destroyResult = cyre.dev.branch.destroy('temp-2')
console.log('Destroy temp-2 result:', destroyResult)

// Test memory cleanup (removes empty branches)
const cleanupResult = await cyre.dev.triggerMemoryCleanup()
console.log('Memory cleanup result:', cleanupResult)

// Check stats after cleanup
const afterStats = cyre.branch.getStats()
console.log('Branches after cleanup:', afterStats.total)

// ===========================================
// EXAMPLE 12: Real-World E-commerce App
// ===========================================

console.log('\n=== Example 12: E-commerce Application ===')

// Create complete e-commerce application structure
const ecommerceApp = createBranch(undefined, {id: 'ecommerce-app'})

// Create main sections
const catalogBranch = createBranch(ecommerceApp, {id: 'catalog'})
const checkoutBranch = createBranch(ecommerceApp, {id: 'checkout'})
const userAccountBranch = createBranch(ecommerceApp, {id: 'account'})
const adminBranch2 = createBranch(ecommerceApp, {id: 'admin'})

// Setup catalog functionality
const catalogSetup: BranchSetup = {
  actions: [
    {id: 'search-products', payload: {query: '', results: []}},
    {id: 'filter-products', payload: {filters: {}, products: []}},
    {id: 'add-to-cart', payload: {productId: '', quantity: 1}},
    {id: 'view-product', payload: {productId: '', viewCount: 0}}
  ],
  subscriptions: [
    {
      id: 'add-to-cart',
      handler: (payload: any) => {
        console.log('Catalog: Adding to cart', payload)

        // Cross-branch call to checkout
        catalogBranch.call('ecommerce-app/checkout/add-item', {
          productId: payload.productId,
          quantity: payload.quantity,
          source: 'catalog'
        })

        return {success: true, productId: payload.productId}
      }
    },
    {
      id: 'search-products',
      handler: (payload: any) => {
        console.log('Catalog: Searching products', payload.query)

        // Simulate product search
        const mockResults = [
          {id: 'p1', name: 'Product 1', price: 29.99},
          {id: 'p2', name: 'Product 2', price: 49.99}
        ]

        return {query: payload.query, results: mockResults}
      }
    }
  ]
}

catalogBranch.setup(catalogSetup)

// Setup checkout functionality
const checkoutSetup: BranchSetup = {
  actions: [
    {id: 'add-item', payload: {cart: {items: [], total: 0}}},
    {id: 'remove-item', payload: {itemId: ''}},
    {id: 'apply-coupon', payload: {couponCode: ''}},
    {id: 'place-order', payload: {orderData: {}}}
  ],
  subscriptions: [
    {
      id: 'add-item',
      handler: (payload: any) => {
        console.log('Checkout: Item added to cart', payload)

        // Update cart total and notify account about activity
        const newItem = {
          id: payload.productId,
          quantity: payload.quantity,
          timestamp: Date.now()
        }

        checkoutBranch.call('ecommerce-app/account/activity-logged', {
          type: 'cart_addition',
          data: newItem
        })

        return {
          cart: {
            items: [...payload.cart.items, newItem],
            total: payload.cart.total + payload.quantity * 29.99 // Mock price
          }
        }
      }
    },
    {
      id: 'place-order',
      handler: (payload: any) => {
        console.log('Checkout: Order placed', payload.orderData)

        // Notify admin about new order
        checkoutBranch.call('ecommerce-app/admin/new-order', {
          orderId: `ord-${Date.now()}`,
          orderData: payload.orderData,
          timestamp: Date.now()
        })

        return {
          success: true,
          orderId: `ord-${Date.now()}`,
          status: 'confirmed'
        }
      }
    }
  ]
}

checkoutBranch.setup(checkoutSetup)

// Setup user account functionality
userAccountBranch.action({id: 'activity-logged', payload: {activities: []}})
userAccountBranch.action({id: 'update-profile', payload: {profile: {}}})

userAccountBranch.on('activity-logged', (payload: any) => {
  console.log('Account: Activity logged', payload)
  return {
    activities: [
      ...payload.activities,
      {
        type: payload.type,
        data: payload.data,
        timestamp: Date.now()
      }
    ]
  }
})

// Setup admin functionality
adminBranch2.action({id: 'new-order', payload: {orders: []}})
adminBranch2.action({id: 'get-analytics', payload: {analytics: {}}})

adminBranch2.on('new-order', (payload: any) => {
  console.log('Admin: New order received', payload.orderId)
  return {
    orders: [
      ...payload.orders,
      {
        id: payload.orderId,
        data: payload.orderData,
        status: 'processing',
        receivedAt: payload.timestamp
      }
    ]
  }
})

// Test complete e-commerce flow
console.log('Testing complete e-commerce flow...')

// 1. User searches for products
await catalogBranch.call('search-products', {query: 'laptop'})

// 2. User adds product to cart
await catalogBranch.call('add-to-cart', {productId: 'p1', quantity: 2})

// 3. User places order
await checkoutBranch.call('place-order', {
  orderData: {
    items: [{id: 'p1', quantity: 2}],
    total: 59.98,
    userEmail: 'user@example.com'
  }
})

console.log('E-commerce flow completed successfully!')

// Final system overview
const finalSnapshot = cyre.dev.snapshot()
console.log('\n=== Final System State ===')
console.log('Total branches:', finalSnapshot.branches.total)
console.log('Active branches:', finalSnapshot.branches.active)
console.log('Total channels:', finalSnapshot.channels.total)
console.log('Total calls made:', finalSnapshot.system.totalCalls)

// Performance insights
const performanceInsights = cyre.getPerformanceInsights()
if (performanceInsights.length > 0) {
  console.log('\nPerformance insights:')
  performanceInsights.forEach(insight => console.log('-', insight))
} else {
  console.log('\nSystem performance: All good! ✅')
}

console.log('\n🎉 Branch system examples completed successfully!')
console.log('Key benefits demonstrated:')
console.log('- ✅ Component isolation and reuse')
console.log('- ✅ No ID namespace collisions')
console.log('- ✅ Cross-branch communication')
console.log('- ✅ Path-based addressing')
console.log('- ✅ Real-world application patterns')
console.log('- ✅ Memory management and cleanup')

export {
  // Export example factories for reuse
  carouselSetup,
  createUserSession,
  createModalComponent,
  createGameRoom
}
