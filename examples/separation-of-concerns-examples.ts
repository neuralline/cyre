// examples/separation-of-concerns-examples.ts
// Examples showing clear separation between channel and action concerns

import {cyre} from '../src/app'

/*

      C.Y.R.E - S.E.P.A.R.A.T.I.O.N - E.X.A.M.P.L.E.S
      
      Examples demonstrating the clear separation:
      
      Channel Responsibilities:
      - ID validation and uniqueness
      - Basic defaults (payload, timestamp, type)
      - Storage in state
      
      Action Responsibilities:
      - Structure validation with schema
      - Function validation
      - Protection pipeline compilation
      - Final action assembly

*/

// Initialize Cyre
await cyre.initialize()

console.log('=== Channel Creation Examples ===')

// Example 1: Simple Channel Creation
console.log('\n1. Simple Channel (handled by CyreChannel)')
cyre.action({
  id: 'simple-notification',
  payload: {message: 'Hello World'}
})
// Channel handles: ID validation, defaults, storage
// Action handles: No protections needed, simple registration

cyre.on('simple-notification', data => {
  console.log(`📢 ${data.message}`)
})

await cyre.call('simple-notification') // Uses default payload

// Example 2: Channel with Custom Defaults
console.log('\n2. Channel with Custom Defaults')
cyre.action({
  id: 'custom-defaults',
  type: 'custom-type', // Channel preserves this
  payload: {initial: 'value'} // Channel sets this as default
  // No validation or protections - pure channel creation
})

const stored = cyre.get('custom-defaults')
console.log('Stored channel:', {
  id: stored?.id,
  type: stored?.type,
  payload: stored?.payload,
  timestamp: stored?.timestamp ? 'set' : 'missing'
})

console.log('\n=== Action Processing Examples ===')

// Example 3: Action with Validation Only
console.log('\n3. Action with Structure Validation')
cyre.action({
  id: 'validated-action',
  throttle: 100, // Action validates this is a positive number
  debounce: 50, // Action validates this is a positive number
  detectChanges: true // Action validates this is boolean
})
// Channel handles: ID, defaults
// Action handles: Validates throttle/debounce values, compiles 3 protections

console.log('Action registered with throttle and debounce protections')

// Example 4: Action with Function Validation
console.log('\n4. Action with Function Validation')
cyre.action({
  id: 'function-validation',
  condition: data => data.enabled === true, // Action validates this is a function
  selector: data => data.user, // Action validates this is a function
  transform: user => ({...user, processed: true}) // Action validates this is a function
})
// Channel handles: ID, defaults
// Action handles: Validates functions, compiles 3 protections

console.log('Action registered with 3 function-based protections')

// Example 5: Complex Action with Full Pipeline
console.log('\n5. Complex Action with Full Protection Pipeline')
cyre.action({
  id: 'complex-user-processor',

  // Schema validation (handled by action)
  schema: cyre.schema.object({
    user: cyre.schema.object({
      id: cyre.schema.string(),
      name: cyre.schema.string(),
      email: cyre.schema.string(),
      active: cyre.schema.boolean()
    }),
    metadata: cyre.schema.object({}).optional()
  }),

  // State reactivity (handled by action)
  selector: data => data.user,
  condition: user => user.active && user.email.includes('@'),
  transform: user => ({
    id: user.id,
    displayName: user.name.toUpperCase(),
    email: user.email.toLowerCase(),
    processedAt: Date.now(),
    isValid: true
  }),

  // Protection features (handled by action)
  detectChanges: true,
  throttle: 200,
  debounce: 100,

  // Timing (handled by action)
  priority: {level: 'high'}
})

// Channel handled: ID validation, defaults, storage
// Action handled: Schema validation, function validation, compiled 8 protections

cyre.on('complex-user-processor', processedUser => {
  console.log(
    `👤 Processed user: ${processedUser.displayName} (${processedUser.email})`
  )
})

// Test the complex action
const userData = {
  user: {
    id: 'u123',
    name: 'john doe',
    email: 'JOHN@EXAMPLE.COM',
    active: true
  },
  metadata: {source: 'api'}
}

await cyre.call('complex-user-processor', userData)

console.log('\n=== Error Handling Examples ===')

// Example 6: Channel-level Errors
console.log('\n6. Channel-level Error (Invalid ID)')
try {
  const result = cyre.action({
    id: '', // Empty ID - fails at channel level
    throttle: 100
  })
  console.log('Channel error result:', result)
} catch (error) {
  console.log('Channel validation caught:', error.message)
}

// Example 7: Action-level Errors
console.log('\n7. Action-level Error (Invalid Functions)')
const actionResult = cyre.action({
  id: 'invalid-functions',
  condition: 'not-a-function', // Fails at action level
  throttle: -100, // Fails at action level
  selector: 123 // Fails at action level
} as any)

console.log('Action validation result:', {
  ok: actionResult.ok,
  message: actionResult.message
})

console.log('\n=== Performance Comparison ===')

// Example 8: Performance Demonstration
console.log('\n8. Performance Test - Registration Speed')

const startTime = performance.now()

// Register multiple actions to show performance
for (let i = 0; i < 100; i++) {
  cyre.action({
    id: `perf-test-${i}`,
    selector: data => data.value,
    condition: value => value > 0,
    detectChanges: true,
    throttle: 50
  })
}

const endTime = performance.now()
console.log(`Registered 100 actions in ${(endTime - startTime).toFixed(2)}ms`)
console.log(
  'Average per action:',
  ((endTime - startTime) / 100).toFixed(3) + 'ms'
)

console.log('\n=== Pipeline Inspection ===')

// Example 9: Inspecting Compiled Pipeline
console.log('\n9. Pipeline Inspection')
const inspectionAction = cyre.action({
  id: 'pipeline-inspector',
  block: false, // Will not create protection
  schema: cyre.schema.string(), // Will create protection
  condition: data => data.length > 0, // Will create protection
  detectChanges: true, // Will create protection
  throttle: 100, // Will create protection
  transform: data => data.toUpperCase() // Will create protection
})

const inspectedAction = cyre.get('pipeline-inspector')
console.log(
  'Pipeline protections:',
  inspectedAction?._protectionPipeline?.length || 0
)

// Show what each concern handled:
console.log('\nWhat CyreChannel handled:')
console.log('- ID validation: ✅')
console.log('- Set type default: ✅')
console.log('- Set payload default: ✅')
console.log('- Set timestamps: ✅')
console.log('- Store in state: ✅')

console.log('\nWhat registerSingleAction handled:')
console.log('- Schema validation: ✅')
console.log('- Function validation: ✅')
console.log('- Attribute validation: ✅')
console.log('- Pipeline compilation: ✅')
console.log('- Final assembly: ✅')

console.log('\n=== Real-world Patterns ===')

// Example 10: User Authentication Flow
console.log('\n10. User Authentication Pattern')
cyre.action({
  id: 'auth-handler',
  schema: cyre.schema.object({
    action: cyre.schema.enums('login', 'logout', 'refresh'),
    user: cyre.schema
      .object({
        id: cyre.schema.string(),
        token: cyre.schema.string()
      })
      .optional(),
    session: cyre.schema.object({}).optional()
  }),
  selector: data => ({action: data.action, user: data.user}),
  condition: auth => {
    if (auth.action === 'login') return auth.user !== undefined
    if (auth.action === 'logout') return auth.user !== undefined
    return true // refresh can happen without user
  },
  transform: auth => ({
    ...auth,
    timestamp: Date.now(),
    sessionId: `session-${Date.now()}`
  }),
  detectChanges: true,
  throttle: 1000 // Prevent rapid auth attempts
})

cyre.on('auth-handler', authEvent => {
  console.log(
    `🔐 Auth ${authEvent.action}: ${authEvent.user?.id || 'anonymous'}`
  )
})

// Test authentication
await cyre.call('auth-handler', {
  action: 'login',
  user: {id: 'user123', token: 'abc123'}
})

// Example 11: Data Synchronization Pattern
console.log('\n11. Data Synchronization Pattern')
cyre.action({
  id: 'data-sync',
  selector: state => state.data,
  condition: data => data.needsSync === true,
  transform: data => ({
    ...data,
    syncStarted: Date.now(),
    syncId: `sync-${Math.random().toString(36).substring(2)}`,
    needsSync: false
  }),
  detectChanges: true,
  debounce: 500, // Batch sync requests
  priority: {level: 'low'} // Background operation
})

cyre.on('data-sync', syncData => {
  console.log(`🔄 Syncing data: ${syncData.syncId}`)
})

// Test data sync
await cyre.call('data-sync', {
  data: {
    items: [1, 2, 3],
    needsSync: true,
    lastUpdate: Date.now() - 5000
  }
})

console.log('\n✨ Separation of Concerns Examples Complete!')
console.log('\nKey Benefits Demonstrated:')
console.log('1. 🎯 Clear responsibilities: Channel vs Action')
console.log('2. ⚡ Faster registration: Single-pass validation')
console.log('3. 🔧 Better maintainability: Focused code')
console.log('4. 🐛 Easier debugging: Clear error sources')
console.log('5. 📊 Better performance: Optimized pipeline compilation')
