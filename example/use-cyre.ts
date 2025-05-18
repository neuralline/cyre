import {cyre, useCyre, cyreCompose} from '../src/'

// Define a type for our payload
interface UserPayload {
  userId: string
  status?: 'online' | 'offline' | 'away'
  lastSeen?: number
}

// Create a typed channel
const userChannel = useCyre<UserPayload>('user', {
  debug: true,
  initialPayload: {userId: 'default', status: 'offline'},
  protection: {
    throttle: 500,
    debounce: 300,
    detectChanges: true
  },
  priority: {level: 'high'}
})

// Add middleware for logging
userChannel.middleware(async (payload, next) => {
  console.log('Processing user update:', payload)
  const response = await next(payload)
  console.log('User update response:', response)
  return response
})

// Subscribe to channel events
const {unsubscribe} = userChannel.on(payload => {
  console.log(`User ${payload.userId} is now ${payload.status}`)
})

// Call the channel
await userChannel.call({
  userId: 'user123',
  status: 'online',
  lastSeen: Date.now()
})

// Check system stress
const breathingState = userChannel.getBreathingState()
console.log(`System stress: ${breathingState.stress * 100}%`)

// Get call history
const history = userChannel.getHistory()
console.log('Recent calls:', history)

// Clean up subscription
unsubscribe()

// Create a notification channel
const notificationChannel = useCyre('notification')

// Compose channels
const userSystem = cyreCompose([userChannel, notificationChannel])

// Call all channels at once
await userSystem.call({
  userId: 'user123',
  status: 'away'
})

// Later forget the channel
userChannel.forget()
//cyre.shutdown()
