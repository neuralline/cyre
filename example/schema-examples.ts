// example/schema-examples.ts
// Schema validation usage examples

import {cyre, schema} from '../src'

/*

      C.Y.R.E - S.C.H.E.M.A - E.X.A.M.P.L.E.S
      
      Smart schema validation examples:
      - Action payload validation
      - Type-safe handlers
      - Error handling
      - Performance validation

*/

// Basic schema validation
const userSchema = schema.object({
  id: schema.pipe(schema.number(), schema.positive),
  name: schema.pipe(schema.string(), schema.minLength(2), schema.maxLength(50)),
  email: schema.email_string(),
  age: schema.pipe(schema.number(), schema.min(0), schema.max(150)).optional()
})

// Register action with schema
cyre.action({
  id: 'create-user',
  schema: userSchema,
  payload: null
})

// Type-safe handler
cyre.on('create-user', payload => {
  // payload is now type-safe and validated
  console.log(`Creating user: ${payload.name} (${payload.email})`)
  return {created: true, userId: payload.id}
})

// API endpoint schema
const apiRequestSchema = schema.object({
  method: schema.enums('GET', 'POST', 'PUT', 'DELETE'),
  url: schema.url_string(),
  headers: schema
    .object({
      'content-type': schema.string().default('application/json'),
      authorization: schema.string().optional()
    })
    .optional(),
  body: schema.any().optional()
})

cyre.action({
  id: 'api-request',
  schema: apiRequestSchema,
  throttle: 100 // Rate limit API calls
})

cyre.on('api-request', async payload => {
  // Payload is validated API request
  const response = await fetch(payload.url, {
    method: payload.method,
    headers: payload.headers,
    body: payload.body ? JSON.stringify(payload.body) : undefined
  })
  return {status: response.status, data: await response.json()}
})

// Form validation schema
const contactFormSchema = schema.object({
  name: schema.pipe(schema.string(), schema.minLength(1)),
  email: schema.email_string(),
  message: schema.pipe(
    schema.string(),
    schema.minLength(10),
    schema.maxLength(1000)
  ),
  priority: schema.enums('low', 'medium', 'high').default('medium'),
  attachments: schema
    .array(
      schema.object({
        name: schema.string(),
        size: schema.pipe(schema.number(), schema.max(10000000)), // 10MB max
        type: schema.string()
      })
    )
    .optional()
})

cyre.action({
  id: 'submit-contact-form',
  schema: contactFormSchema,
  debounce: 500, // Prevent double submissions
  detectChanges: true
})

// Configuration schema with transforms
const configSchema = schema
  .object({
    debug: schema.boolean().default(false),
    timeout: schema.pipe(schema.number(), schema.min(1000), schema.max(30000)),
    retries: schema.pipe(
      schema.number(),
      schema.int,
      schema.min(0),
      schema.max(5)
    ),
    environment: schema.enums('development', 'staging', 'production'),
    features: schema
      .object({
        cache: schema.boolean().default(true),
        analytics: schema.boolean().default(false),
        logging: schema.boolean().default(true)
      })
      .optional()
  })
  .transform(config => ({
    ...config,
    isProduction: config.environment === 'production',
    timeoutSeconds: config.timeout / 1000
  }))

cyre.action({
  id: 'update-config',
  schema: configSchema
})

// Complex validation with custom refinements
const orderSchema = schema
  .object({
    orderId: schema.id_string(),
    items: schema.array(
      schema.object({
        productId: schema.id_string(),
        quantity: schema.pipe(schema.number(), schema.positive_int),
        price: schema.pipe(schema.number(), schema.positive)
      })
    ),
    shippingAddress: schema.object({
      street: schema.safe_string(),
      city: schema.safe_string(),
      zipCode: schema.pipe(schema.string(), schema.pattern(/^\d{5}(-\d{4})?$/)),
      country: schema.string().default('US')
    }),
    paymentMethod: schema.enums('credit', 'debit', 'paypal', 'apple_pay')
  })
  .refine(order => {
    const total = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    return total > 0
  }, 'Order total must be greater than 0')

cyre.action({
  id: 'process-order',
  schema: orderSchema,
  priority: {level: 'high'} // High priority for orders
})

// Union type validation
const notificationSchema = schema.object({
  id: schema.id_string(),
  type: schema.enums('email', 'sms', 'push'),
  recipient: schema.string(),
  content: schema.union(
    // Email notification
    schema.object({
      subject: schema.string(),
      body: schema.string(),
      html: schema.boolean().default(false)
    }),
    // SMS notification
    schema.object({
      message: schema.pipe(schema.string(), schema.maxLength(160))
    }),
    // Push notification
    schema.object({
      title: schema.string(),
      body: schema.string(),
      icon: schema.url_string().optional(),
      badge: schema.number().optional()
    })
  )
})

cyre.action({
  id: 'send-notification',
  schema: notificationSchema,
  throttle: 1000 // Rate limit notifications
})

// Performance validation example
async function testSchemaPerformance() {
  console.log('Testing schema validation performance...')

  // Test data
  const testUser = {
    id: 123,
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  }

  const iterations = 10000

  // Test without schema
  cyre.action({id: 'test-no-schema', log: true})
  cyre.on('test-no-schema', payload => ({processed: true}))

  const startNoSchema = performance.now()
  for (let i = 0; i < iterations; i++) {
    await cyre.call('test-no-schema', testUser)
  }
  const endNoSchema = performance.now()

  // Test with schema
  cyre.action({
    id: 'test-with-schema',
    schema: userSchema,
    log: true
  })
  cyre.on('test-with-schema', payload => ({processed: true}))

  const startWithSchema = performance.now()
  for (let i = 0; i < iterations; i++) {
    await cyre.call('test-with-schema', testUser)
  }
  const endWithSchema = performance.now()

  console.log(`No schema: ${(endNoSchema - startNoSchema).toFixed(2)}ms`)
  console.log(`With schema: ${(endWithSchema - startWithSchema).toFixed(2)}ms`)
  console.log(
    `Overhead: ${(
      endWithSchema -
      startWithSchema -
      (endNoSchema - startNoSchema)
    ).toFixed(2)}ms`
  )
}

// Error handling examples
async function testErrorHandling() {
  console.log('Testing schema error handling...')

  // Invalid user data
  const invalidUser = {
    id: -1, // Negative ID
    name: 'A', // Too short
    email: 'invalid-email', // Invalid format
    age: 200 // Too old
  }

  try {
    const result = await cyre.call('create-user', invalidUser)
    console.log('Validation result:', result)
  } catch (error) {
    console.log('Validation failed as expected:', error)
  }

  // Test transformation
  const configData = {
    timeout: 5000,
    retries: 3,
    environment: 'production'
  }

  const configResult = await cyre.call('update-config', configData)
  console.log('Config transformation result:', configResult)
}

// Export test functions
export {
  testSchemaPerformance,
  testErrorHandling,
  userSchema,
  apiRequestSchema,
  contactFormSchema,
  configSchema,
  orderSchema,
  notificationSchema
}
//testErrorHandling()
testSchemaPerformance()
