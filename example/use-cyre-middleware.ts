// example/use-cyre-middleware.ts

import {useCyre} from '../src/hooks/use-cyre'
import {CyreMiddleware, CyreResponse} from '../src/interfaces/hooks-interface'

// Create a user validation channel
const userChannel = useCyre({
  name: 'user-management',
  debug: true, // Enable logging
  protection: {
    debounce: 300,
    detectChanges: true
  }
})

// Register a validation middleware
const validationMiddleware: CyreMiddleware = async (payload, next) => {
  console.log('User validation middleware running...')

  // Validate username
  if (!payload.username || payload.username.length < 3) {
    console.log('Validation failed: Username too short')
    return {
      ok: false,
      payload: null,
      message: 'Username must be at least 3 characters'
    }
  }

  // Validate email
  if (!payload.email || !payload.email.includes('@')) {
    console.log('Validation failed: Invalid email')
    return {
      ok: false,
      payload: null,
      message: 'Email must be valid'
    }
  }

  // Add validation timestamp
  const enrichedPayload = {
    ...payload,
    validated: true,
    validatedAt: new Date().toISOString()
  }

  // Continue to next middleware or handler
  console.log('Validation passed, continuing...')
  return await next(enrichedPayload)
}

// Register middleware with the channel
userChannel.middleware(validationMiddleware)

// Initialize the channel
userChannel.action({
  type: 'user-operations',
  priority: {level: 'medium'}
})

// Handle user creation
userChannel.on(payload => {
  console.log('Creating user:', payload)

  // Simulate user creation
  const user = {
    id: Math.random().toString(36).substring(2, 9),
    ...payload,
    createdAt: new Date().toISOString()
  }

  console.log('User created:', user)
  return {ok: true, message: 'User created successfully', payload: user}
})

// Test invalid data
const runInvalidTest = async () => {
  console.log('\n--- Testing Invalid Data ---')
  const invalidResult = await userChannel.call({
    username: 'a',
    email: 'not-an-email'
  })

  console.log('Invalid call result:', invalidResult)
}

// Test valid data
const runValidTest = async () => {
  console.log('\n--- Testing Valid Data ---')
  const validResult = await userChannel.call({
    username: 'john_doe',
    email: 'john@example.com'
  })

  console.log('Valid call result:', validResult)
}

// Check history
const checkHistory = () => {
  console.log('\n--- History ---')
  const history = userChannel.getHistory()
  console.log(`Found ${history.length} history entries:`)

  history.forEach((entry, index) => {
    console.log(`[${index + 1}] ${new Date(entry.timestamp).toISOString()}:`)
    console.log(`  Payload:`, entry.payload)
    console.log(`  Result: ${entry.response.ok ? 'SUCCESS' : 'FAILED'}`)
    if (!entry.response.ok) {
      console.log(`  Message: ${entry.response.message}`)
    }
  })
}

// Run the example
const runExample = async () => {
  await runInvalidTest()
  await runValidTest()
  checkHistory()

  // Clean up
  userChannel.forget()
}

runExample().catch(console.error)
