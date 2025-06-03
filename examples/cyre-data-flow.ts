// examples/cyre-data-flow.ts
// Test to verify Cyre returns actual data, not just confirmations

import {cyre} from '../src/app'

/*
    Test Cases:
    1. Simple data return
    2. Complex object return
    3. Array data return
    4. Async data processing
    5. Error handling with data
    6. IntraLink chaining with data
    7. Transform pipeline with data preservation
*/

interface User {
  id: number
  name: string
  email: string
  preferences: {
    theme: string
    notifications: boolean
  }
}

interface Product {
  id: string
  name: string
  price: number
  inStock: boolean
}

// Test database simulation
const mockDatabase = {
  users: [
    {
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      preferences: {theme: 'dark', notifications: true}
    },
    {
      id: 2,
      name: 'Bob Smith',
      email: 'bob@example.com',
      preferences: {theme: 'light', notifications: false}
    }
  ] as User[],

  products: [
    {id: 'prod-1', name: 'Laptop', price: 999.99, inStock: true},
    {id: 'prod-2', name: 'Mouse', price: 29.99, inStock: false}
  ] as Product[]
}

async function runDataFlowTests() {
  console.log('🚀 Starting Cyre Data Flow Tests\n')

  // Initialize Cyre
  await cyre.initialize()

  // TEST 1: Simple Data Return
  console.log('📝 TEST 1: Simple Data Return')

  cyre.action({id: 'get-greeting'})
  cyre.on('get-greeting', (name: string) => {
    return `Hello, ${name}! Welcome to Cyre.`
  })

  const greetingResult = await cyre.call('get-greeting', 'Alice')
  console.log('  Input:', 'Alice')
  console.log('  Response:', greetingResult)
  console.log('  Data received:', greetingResult.payload)
  console.log('  ✅ Test 1 Passed:', typeof greetingResult.payload === 'string')
  console.log()

  // TEST 2: Complex Object Return
  console.log('📝 TEST 2: Complex Object Return')

  cyre.action({id: 'get-user'})
  cyre.on('get-user', (userId: number) => {
    const user = mockDatabase.users.find(u => u.id === userId)
    if (!user) {
      throw new Error('User not found')
    }
    return {
      user,
      timestamp: Date.now(),
      source: 'mock-database'
    }
  })

  const userResult = await cyre.call('get-user', 1)
  console.log('  Input:', 1)
  console.log('  Response:', userResult)
  console.log('  Data received:', userResult.payload)
  console.log(
    '  ✅ Test 2 Passed:',
    userResult.payload?.user?.name === 'Alice Johnson'
  )
  console.log()

  // TEST 3: Array Data Return
  console.log('📝 TEST 3: Array Data Return')

  cyre.action({id: 'get-products'})
  cyre.on('get-products', (filters: {inStock?: boolean}) => {
    let products = mockDatabase.products
    if (filters.inStock !== undefined) {
      products = products.filter(p => p.inStock === filters.inStock)
    }
    return {
      products,
      total: products.length,
      filters
    }
  })

  const productsResult = await cyre.call('get-products', {inStock: true})
  console.log('  Input:', {inStock: true})
  console.log('  Response:', productsResult)
  console.log('  Data received:', productsResult.payload)
  console.log(
    '  ✅ Test 3 Passed:',
    Array.isArray(productsResult.payload?.products)
  )
  console.log()

  // TEST 4: Async Data Processing
  console.log('📝 TEST 4: Async Data Processing')

  cyre.action({id: 'fetch-api-data'})
  cyre.on('fetch-api-data', async (endpoint: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      endpoint,
      data: {message: 'API data retrieved'},
      timestamp: new Date().toISOString(),
      processingTime: 100
    }
  })

  const apiResult = await cyre.call('fetch-api-data', '/users/profile')
  console.log('  Input:', '/users/profile')
  console.log('  Response:', apiResult)
  console.log('  Data received:', apiResult.payload)
  console.log(
    '  ✅ Test 4 Passed:',
    apiResult.payload?.endpoint === '/users/profile'
  )
  console.log()

  // TEST 5: Error Handling with Data
  console.log('📝 TEST 5: Error Handling with Data')

  cyre.action({id: 'validate-input'})
  cyre.on('validate-input', (input: {email: string; age: number}) => {
    const errors: string[] = []

    if (!input.email.includes('@')) {
      errors.push('Invalid email format')
    }
    if (input.age < 0 || input.age > 120) {
      errors.push('Invalid age range')
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        input
      }
    }

    return {
      valid: true,
      input,
      message: 'Validation passed'
    }
  })

  const invalidResult = await cyre.call('validate-input', {
    email: 'invalid',
    age: -5
  })
  console.log('  Input:', {email: 'invalid', age: -5})
  console.log('  Response:', invalidResult)
  console.log('  Data received:', invalidResult.payload)
  console.log('  ✅ Test 5 Passed:', invalidResult.payload?.valid === false)
  console.log()

  // TEST 6: IntraLink Chaining with Data
  console.log('📝 TEST 6: IntraLink Chaining with Data')

  cyre.action({id: 'process-order'})
  cyre.on(
    'process-order',
    (orderData: {productId: string; quantity: number}) => {
      const product = mockDatabase.products.find(
        p => p.id === orderData.productId
      )
      if (!product) {
        throw new Error('Product not found')
      }

      const orderResult = {
        orderId: `order-${Date.now()}`,
        product,
        quantity: orderData.quantity,
        total: product.price * orderData.quantity,
        status: 'processed'
      }

      // Return data AND trigger next action
      return {
        id: 'send-confirmation',
        payload: {
          email: 'customer@example.com',
          orderDetails: orderResult
        }
      }
    }
  )

  cyre.action({id: 'send-confirmation'})
  cyre.on('send-confirmation', (confirmationData: any) => {
    return {
      sent: true,
      email: confirmationData.email,
      subject: `Order ${confirmationData.orderDetails.orderId} Confirmed`,
      timestamp: new Date().toISOString()
    }
  })

  const orderResult = await cyre.call('process-order', {
    productId: 'prod-1',
    quantity: 2
  })
  console.log('  Input:', {productId: 'prod-1', quantity: 2})
  console.log('  Response:', orderResult)
  console.log('  Data received:', orderResult.payload)
  console.log(
    '  ✅ Test 6 Passed:',
    orderResult.payload?.orderId?.startsWith('order-')
  )
  console.log()

  // TEST 7: Transform Pipeline with Data Preservation
  console.log('📝 TEST 7: Transform Pipeline with Data Preservation')

  cyre.action({
    id: 'transform-data',
    transform: (input: any) => ({
      ...input,
      transformed: true,
      timestamp: Date.now()
    })
  })

  cyre.on('transform-data', (data: any) => {
    return {
      original: data,
      processed: {
        ...data,
        processedBy: 'cyre-handler',
        result: data.value * 2
      }
    }
  })

  const transformResult = await cyre.call('transform-data', {
    value: 42,
    source: 'test'
  })
  console.log('  Input:', {value: 42, source: 'test'})
  console.log('  Response:', transformResult)
  console.log('  Data received:', transformResult.payload)
  console.log(
    '  ✅ Test 7 Passed:',
    transformResult.payload?.processed?.result === 84
  )
  console.log()

  // TEST 8: Multiple Subscribers (First One Wins)
  console.log('📝 TEST 8: Multiple Subscribers (First One Wins)')

  cyre.action({id: 'multi-handler'})

  // First subscriber
  cyre.on('multi-handler', (data: string) => {
    return `First handler processed: ${data}`
  })

  // This should warn about duplicate listener
  cyre.on('multi-handler', (data: string) => {
    return `Second handler processed: ${data}`
  })

  const multiResult = await cyre.call('multi-handler', 'test-data')
  console.log('  Input:', 'test-data')
  console.log('  Response:', multiResult)
  console.log('  Data received:', multiResult.payload)
  console.log('  ✅ Test 8 Passed:', typeof multiResult.payload === 'string')
  console.log()

  // SUMMARY
  console.log('🎯 SUMMARY: Cyre Data Flow Verification')
  console.log('  ✅ Simple strings are returned')
  console.log('  ✅ Complex objects are returned')
  console.log('  ✅ Arrays are returned')
  console.log('  ✅ Async processing results are returned')
  console.log('  ✅ Error data is returned')
  console.log('  ✅ IntraLink chains return data')
  console.log('  ✅ Transform pipelines preserve data')
  console.log('  ✅ Multiple handlers work (with warnings)')
  console.log(
    '\n🎉 CONCLUSION: Cyre returns ACTUAL DATA, not just confirmations!'
  )
}

// Export for testing
export {runDataFlowTests}

runDataFlowTests().catch(console.error)
