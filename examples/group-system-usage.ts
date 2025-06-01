// examples/group-system-usage.ts
// Comprehensive examples of the Cyre group system

// Note: Adjust import path based on your project structure
import {cyre, schema} from 'cyre' // or from '../src/index' if running from examples folder

/*

      C.Y.R.E - G.R.O.U.P - E.X.A.M.P.L.E.S
      
      Real-world examples of the group system:
      - Building sensor management
      - Microservice coordination
      - User interface state management
      - IoT device orchestration

*/

// Example 1: Building Sensor Management
// All sensors in a building floor share common middleware

const timestampValidator = async (payload: any, next: any) => {
  console.log(
    '🛡️ Building Security: Validating timestamp for sensor',
    payload.sensorId
  )
  if (!payload.timestamp || Date.now() - payload.timestamp > 30000) {
    return {
      ok: false,
      payload: null,
      message: 'Sensor data is stale or missing timestamp'
    }
  }
  console.log('✅ Timestamp validation passed')
  return next(payload)
}

const buildingSecurityCheck = async (payload: any, next: any) => {
  console.log(
    '🔐 Building Security: Checking security token for sensor',
    payload.sensorId
  )
  // Simulate security validation
  if (payload.securityToken !== 'valid-building-token') {
    return {
      ok: false,
      payload: null,
      message: 'Security validation failed'
    }
  }
  console.log('✅ Security check passed')
  return next(payload)
}

const energyOptimization = async (payload: any, next: any) => {
  console.log(
    '⚡ Building Energy: Applying optimization for sensor',
    payload.sensorId
  )
  // Add energy optimization metadata
  const optimizedPayload = {
    ...payload,
    energyOptimized: true,
    optimizationLevel: 'standard'
  }
  console.log('✅ Energy optimization applied')
  return next(optimizedPayload)
}

// Building sensor schema
const buildingSensorSchema = schema.object({
  sensorId: schema.string(),
  value: schema.number(),
  timestamp: schema.number(),
  securityToken: schema.string(),
  floor: schema.number(),
  room: schema.string().optional()
})

// Create the building sensor group
const setupBuildingSensors = () => {
  // Create group for floor 2 sensors
  const groupResult = cyre.group('floor-2-sensors', {
    channels: ['temp-floor2-*', 'motion-floor2-*', 'light-floor2-*'],
    shared: {
      // Every channel gets these middleware
      middleware: [
        timestampValidator,
        buildingSecurityCheck,
        energyOptimization
      ],

      // Common configuration
      throttle: 1000,
      schema: buildingSensorSchema,
      priority: {level: 'medium'},

      // Shared alerting
      alerts: {
        offline: {
          threshold: 30000,
          action: 'notify-maintenance',
          handler: (channelId: string, alertType: string, data: any) => {
            console.log(`🚨 ALERT: Sensor ${channelId} is offline`, data)
            // Could trigger notification system, log to database, etc.
          }
        },
        anomaly: {
          threshold: 5000,
          action: 'escalate-security',
          handler: (channelId: string, alertType: string, data: any) => {
            console.log(
              `⚠️ ANOMALY: Sensor ${channelId} detected anomaly`,
              data
            )
            // Could trigger security protocols
          }
        }
      }
    }
  })

  if (groupResult.ok) {
    console.log('Building sensor group created successfully')
  } else {
    console.error(
      'Failed to create building sensor group:',
      groupResult.message
    )
  }

  // Create individual sensor channels - they'll automatically join the group
  cyre.action({
    id: 'temp-floor2-room-101',
    payload: {
      sensorId: 'temp-001',
      value: 22.5,
      timestamp: Date.now(),
      securityToken: 'valid-building-token',
      floor: 2,
      room: '101'
    }
  })

  cyre.action({
    id: 'motion-floor2-hallway',
    payload: {
      sensorId: 'motion-001',
      value: 0,
      timestamp: Date.now(),
      securityToken: 'valid-building-token',
      floor: 2
    }
  })

  cyre.action({
    id: 'light-floor2-room-102',
    payload: {
      sensorId: 'light-001',
      value: 800,
      timestamp: Date.now(),
      securityToken: 'valid-building-token',
      floor: 2,
      room: '102'
    }
  })

  // Subscribe to sensor data
  cyre.on('temp-floor2-room-101', data => {
    console.log('🌡️ Temperature data:', data)
  })

  cyre.on('motion-floor2-hallway', data => {
    console.log('🚶 Motion data:', data)
  })

  cyre.on('light-floor2-room-102', data => {
    console.log('💡 Light data:', data)
  })
}

// Example 2: Microservice Coordination
// Group microservices by domain with shared authentication and logging

const authMiddleware = async (payload: any, next: any) => {
  console.log(
    '🔑 Auth Middleware: Checking authorization for',
    payload.method,
    payload.path
  )
  // Simulate JWT validation
  if (!payload.headers?.authorization) {
    return {
      ok: false,
      payload: null,
      message: 'Missing authorization header'
    }
  }

  const enrichedPayload = {
    ...payload,
    user: {id: 'user-123', role: 'admin'} // Simulated user extraction
  }
  console.log('✅ Auth check passed, user:', enrichedPayload.user.id)
  return next(enrichedPayload)
}

const requestLogging = async (payload: any, next: any) => {
  console.log(`📝 API Request: ${payload.method} ${payload.path}`)
  const startTime = Date.now()

  const result = await next(payload)

  const duration = Date.now() - startTime
  console.log(`⏱️ Request completed in ${duration}ms`)

  return result
}

const setupMicroserviceGroups = () => {
  // User service group
  cyre.group('user-services', {
    channels: ['user-*', 'auth-*', 'profile-*'],
    shared: {
      middleware: [authMiddleware, requestLogging],
      throttle: 500,
      priority: {level: 'high'},
      schema: schema.object({
        method: schema.string(),
        path: schema.string(),
        headers: schema.object({
          authorization: schema.string()
        }),
        body: schema.any().optional()
      })
    }
  })

  // Payment service group
  cyre.group('payment-services', {
    channels: ['payment-*', 'billing-*', 'invoice-*'],
    shared: {
      middleware: [authMiddleware, requestLogging],
      throttle: 2000, // Stricter throttling for payment services
      priority: {level: 'critical'},
      alerts: {
        error: {
          threshold: 1,
          action: 'immediate-alert',
          handler: (channelId, alertType, data) => {
            console.log(
              `🚨 CRITICAL: Payment service error in ${channelId}`,
              data
            )
          }
        }
      }
    }
  })

  // Create service channels
  cyre.action({id: 'user-login'})
  cyre.action({id: 'user-register'})
  cyre.action({id: 'payment-process'})
  cyre.action({id: 'billing-generate'})

  // Service handlers
  cyre.on('user-login', data => {
    console.log('👤 User login request:', data.user)
  })

  cyre.on('payment-process', data => {
    console.log('💳 Payment processing for user:', data.user?.id)
  })
}

// Example 3: UI State Management
// Group related UI components with shared state validation

const stateValidator = async (payload: any, next: any) => {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      payload: null,
      message: 'Invalid state object'
    }
  }
  return next(payload)
}

const stateChangeLogger = async (payload: any, next: any) => {
  console.log('🔄 State change:', JSON.stringify(payload, null, 2))
  return next(payload)
}

const setupUIStateGroups = () => {
  // Form state group
  cyre.group('form-state', {
    channels: ['form-*', 'input-*', 'validation-*'],
    shared: {
      middleware: [stateValidator, stateChangeLogger],
      debounce: 300, // Debounce rapid state changes
      detectChanges: true, // Only update when state actually changes
      schema: schema.object({
        componentId: schema.string(),
        value: schema.any(),
        isValid: schema.boolean().optional(),
        errors: schema.array(schema.string()).optional()
      })
    }
  })

  // Modal state group
  cyre.group('modal-state', {
    channels: ['modal-*', 'dialog-*', 'popup-*'],
    shared: {
      middleware: [stateValidator],
      schema: schema.object({
        isOpen: schema.boolean(),
        content: schema.string().optional(),
        size: schema.enums('small', 'medium', 'large').optional()
      }),
      alerts: {
        anomaly: {
          threshold: 100,
          action: 'log-anomaly',
          handler: (channelId, alertType, data) => {
            console.log(
              `⚠️ UI Anomaly: Too many modal state changes in ${channelId}`
            )
          }
        }
      }
    }
  })

  // Create UI state channels
  cyre.action({
    id: 'form-user-registration',
    payload: {componentId: 'user-reg-form', value: {}, isValid: false}
  })

  cyre.action({
    id: 'modal-confirmation',
    payload: {isOpen: false}
  })

  // UI state handlers
  cyre.on('form-user-registration', state => {
    console.log('📋 Form state updated:', state.componentId, state.isValid)
  })

  cyre.on('modal-confirmation', state => {
    console.log('🔳 Modal state:', state.isOpen ? 'OPEN' : 'CLOSED')
  })
}

// Example 4: IoT Device Orchestration
// Group IoT devices by location and type with shared device management

const deviceHealthCheck = async (payload: any, next: any) => {
  // Simulate device health validation
  if (payload.batteryLevel < 10) {
    console.warn(`🔋 Low battery warning for device ${payload.deviceId}`)
  }

  if (payload.signalStrength < 20) {
    console.warn(`📶 Weak signal warning for device ${payload.deviceId}`)
  }

  return next(payload)
}

const deviceDataNormalization = async (payload: any, next: any) => {
  // Normalize device data format
  const normalizedPayload = {
    ...payload,
    timestamp: payload.timestamp || Date.now(),
    deviceType: payload.deviceType || 'unknown',
    location: payload.location || 'unspecified',
    normalizedAt: Date.now()
  }
  return next(normalizedPayload)
}

const setupIoTDeviceGroups = () => {
  // Smart home devices group
  cyre.group('smart-home-devices', {
    channels: ['smart-*', 'home-*', 'iot-home-*'],
    shared: {
      middleware: [deviceHealthCheck, deviceDataNormalization],
      throttle: 5000, // Limit device updates
      schema: schema.object({
        deviceId: schema.string(),
        deviceType: schema.enums('sensor', 'actuator', 'controller'),
        value: schema.any(),
        batteryLevel: schema.number().min(0).max(100).optional(),
        signalStrength: schema.number().min(0).max(100).optional(),
        location: schema.string().optional()
      }),
      alerts: {
        offline: {
          threshold: 60000, // 1 minute offline threshold
          action: 'device-offline-alert',
          handler: (channelId, alertType, data) => {
            console.log(`📱 Device ${channelId} has gone offline`, data)
          }
        }
      }
    }
  })

  // Industrial sensors group
  cyre.group('industrial-sensors', {
    channels: ['industrial-*', 'factory-*', 'machine-*'],
    shared: {
      middleware: [deviceHealthCheck, deviceDataNormalization],
      throttle: 1000, // More frequent updates for industrial
      priority: {level: 'high'},
      schema: schema.object({
        deviceId: schema.string(),
        machineId: schema.string(),
        sensorType: schema.enums(
          'temperature',
          'pressure',
          'vibration',
          'flow'
        ),
        value: schema.number(),
        unit: schema.string(),
        criticalThreshold: schema.number().optional()
      }),
      alerts: {
        critical: {
          threshold: 1,
          action: 'emergency-shutdown',
          handler: (channelId, alertType, data) => {
            console.log(
              `🚨 CRITICAL: Industrial sensor ${channelId} critical alert!`,
              data
            )
          }
        }
      }
    }
  })

  // Create IoT device channels
  cyre.action({
    id: 'smart-thermostat-living-room',
    payload: {
      deviceId: 'thermo-001',
      deviceType: 'sensor',
      value: 21.5,
      batteryLevel: 85,
      signalStrength: 95,
      location: 'living-room'
    }
  })

  cyre.action({
    id: 'industrial-pressure-sensor-line-1',
    payload: {
      deviceId: 'pressure-001',
      machineId: 'machine-line-1',
      sensorType: 'pressure',
      value: 45.2,
      unit: 'PSI',
      criticalThreshold: 100
    }
  })

  // Device handlers
  cyre.on('smart-thermostat-living-room', data => {
    console.log('🏠 Smart thermostat data:', data.value, '°C')
  })

  cyre.on('industrial-pressure-sensor-line-1', data => {
    console.log('🏭 Industrial pressure:', data.value, data.unit)
    if (data.value > data.criticalThreshold * 0.9) {
      console.warn('⚠️ Pressure approaching critical threshold!')
    }
  })
}

// Demo function to run all examples
export const runGroupSystemDemo = async () => {
  console.log('🚀 Starting Cyre Group System Demo...\n')

  // Initialize Cyre
  await cyre.initialize()

  console.log('1️⃣ Setting up Building Sensor Management...')
  setupBuildingSensors()

  console.log('\n2️⃣ Setting up Microservice Coordination...')
  setupMicroserviceGroups()

  console.log('\n3️⃣ Setting up UI State Management...')
  setupUIStateGroups()

  console.log('\n4️⃣ Setting up IoT Device Orchestration...')
  setupIoTDeviceGroups()

  console.log('\n📊 Group System Status:')
  const allGroups = cyre.getAllGroups()
  allGroups.forEach(group => {
    console.log(
      `  - ${group.id}: ${group.matchedChannels.size} channels, ${group.middlewareIds.length} middleware`
    )
  })

  console.log('\n🧪 Testing group functionality...')

  // Test building sensors with middleware
  console.log('Testing building sensor with group middleware...')
  const sensorResult = await cyre.call('temp-floor2-room-101', {
    sensorId: 'temp-001',
    value: 23.0,
    timestamp: Date.now(),
    securityToken: 'valid-building-token',
    floor: 2,
    room: '101'
  })
  console.log(
    'Sensor call result:',
    sensorResult.ok ? 'SUCCESS' : 'FAILED',
    sensorResult.message
  )

  // Test microservices with middleware
  console.log('Testing microservice with group middleware...')
  const userResult = await cyre.call('user-login', {
    method: 'POST',
    path: '/api/auth/login',
    headers: {authorization: 'Bearer token123'},
    body: {username: 'john', password: 'password'}
  })
  console.log(
    'User service call result:',
    userResult.ok ? 'SUCCESS' : 'FAILED',
    userResult.message
  )

  // Test UI state with middleware
  console.log('Testing UI state with group middleware...')
  const formResult = await cyre.call('form-user-registration', {
    componentId: 'user-reg-form',
    value: {name: 'John Doe', email: 'john@example.com'},
    isValid: true
  })
  console.log(
    'Form state call result:',
    formResult.ok ? 'SUCCESS' : 'FAILED',
    formResult.message
  )

  // Test IoT devices with middleware
  console.log('Testing IoT device with group middleware...')
  const iotResult = await cyre.call('smart-thermostat-living-room', {
    deviceId: 'thermo-001',
    deviceType: 'sensor',
    value: 22.0,
    batteryLevel: 84,
    signalStrength: 93,
    location: 'living-room'
  })
  console.log(
    'IoT device call result:',
    iotResult.ok ? 'SUCCESS' : 'FAILED',
    iotResult.message
  )

  console.log('\n✅ Group System Demo completed!')
}

// Example of dynamic group management
export const dynamicGroupManagement = () => {
  console.log('🔄 Dynamic Group Management Demo...')

  // Create a group
  cyre.group('dynamic-test', {
    channels: ['test-*'],
    shared: {
      middleware: [
        async (payload, next) => {
          console.log('🔧 Dynamic middleware executed for:', payload)
          return next(payload)
        }
      ],
      throttle: 1000
    }
  })

  // Add some channels
  cyre.action({id: 'test-alpha', payload: {name: 'alpha'}})
  cyre.action({id: 'test-beta', payload: {name: 'beta'}})

  console.log(
    'Initial group state:',
    cyre.getGroup('dynamic-test')?.matchedChannels.size
  )

  // Update group configuration
  cyre.updateGroup('dynamic-test', {
    shared: {
      throttle: 2000, // Change throttle
      middleware: [
        async (payload, next) => {
          console.log('🔧 Updated middleware for:', payload)
          return next({...payload, processed: true})
        }
      ]
    }
  })

  // Add more channels with different patterns
  cyre.action({id: 'test-gamma', payload: {name: 'gamma'}})

  console.log(
    'Updated group state:',
    cyre.getGroup('dynamic-test')?.matchedChannels.size
  )

  // Test the updated configuration
  cyre.on('test-alpha', data => console.log('Alpha received:', data))
  cyre.call('test-alpha', {name: 'alpha-updated'})

  // Remove the group
  setTimeout(() => {
    console.log('🗑️ Removing group...')
    cyre.removeGroup('dynamic-test')
    console.log('Group removed:', !cyre.getGroup('dynamic-test'))
  }, 2000)
}
runGroupSystemDemo()
