// example/middleware.ts

import cyre from '../src'

// Use the middleware in an action
cyre.action({
  id: 'user-register',
  payload: {initial: true},
  middleware: ['validate-user-data']
})
// Register a validation middleware
cyre.middleware('validate-user-data', async (action, payload) => {
  // Skip validation if not a user action
  if (!action.id.includes('user')) {
    return {action, payload}
  }

  // Validate user data
  if (!payload.username || payload.username.length < 3) {
    console.log('Validation failed: Username too short')
    return null // Reject the action
  }

  if (!payload.email || !payload.email.includes('@')) {
    console.log('Validation failed: Invalid email')
    return null // Reject the action
  }

  // Pass validation - return the action and payload unchanged
  return {action, payload}
})

cyre.on('user-register', payload => {
  console.log(payload)
})
// This call will be rejected by the middleware
cyre.call('user-register', {
  username: 'ab',
  email: 'not-an-email'
}) // Returns { ok: false, message: 'Action rejected by middleware' }

// This call will pass the middleware
cyre.call('user-register', {
  username: 'john_doe',
  email: 'john@example.com'
})

cyre.middleware('debug-middleware', async (action, payload) => {
  console.log('Debug middleware executing!')
  console.log('- Action:', action.id)
  console.log('- Payload:', payload)

  // Apply a simple transformation
  const enrichedPayload = {
    ...payload,
    debug: true,
    timestamp: Date.now()
  }

  console.log('- Returning enriched payload:', enrichedPayload)
  return {action, payload: enrichedPayload}
})

// Create an action with the debug middleware
cyre.action({
  id: 'debug-action',
  middleware: ['debug-middleware']
})

// Register a handler
cyre.on('debug-action', payload => {
  console.log('Handler received:', payload)
  return {handled: true}
})

// Call the action
console.log('About to call debug-action...')
const result = await cyre.call('debug-action', {test: true})
console.log('Call result:', result)
