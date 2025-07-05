// demo/simple-cyre-test.ts
// Concise test for .on handlers + batch registration

import {cyre} from '../src'

/*

      S.I.M.P.L.E - C.Y.R.E - T.E.S.T
      
      Focused testing:
      - Basic .on handler functionality
      - Error handling inside handlers
      - Batch registration: .action([array]) and .on([array])
      - Performance validation

*/

const test = async (
  name: string,
  fn: () => Promise<boolean>
): Promise<void> => {
  try {
    const result = await fn()
    console.log(`${result ? '✅' : '❌'} ${name}`)
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error}`)
  }
}

export const simpleCyreTest = async (): Promise<void> => {
  console.log('🚀 Simple Cyre Test Suite')
  console.log('=========================\n')

  await cyre.init()

  // Test 1: Basic handler
  await test('Basic .on handler', async () => {
    cyre.action({id: 'basic-test'})
    cyre.on('basic-test', payload => ({received: payload}))
    const result = await cyre.call('basic-test', {hello: 'world'})
    return result.ok && result.payload.received.hello === 'world'
  })

  // Test 2: Error handling in .on
  await test('Error handling in .on', async () => {
    cyre.action({id: 'error-test'})
    cyre.on('error-test', payload => {
      if (payload.shouldError) throw new Error('Test error')
      return {success: true}
    })

    const good = await cyre.call('error-test', {shouldError: false})
    const bad = await cyre.call('error-test', {shouldError: true})
    return good.ok && !bad.ok
  })

  // Test 3: Missing handler
  await test('Missing handler scenario', async () => {
    const result = await cyre.call('non-existent', {test: true})
    return !result.ok
  })

  console.log('\n🔧 Testing Batch Registration...')

  // Test 4: Batch action registration
  await test('Batch .action([array])', async () => {
    const actions = [
      {id: 'batch-1', payload: {type: 'first'}},
      {id: 'batch-2', payload: {type: 'second'}},
      {id: 'batch-3', payload: {type: 'third'}}
    ]

    const result = cyre.action(actions)
    return result.ok && result.payload.length === 3
  })

  // Test 5: Batch handler registration
  await test('Batch .on([array])', async () => {
    const handlers = [
      {id: 'batch-1', handler: (p: any) => ({batch: 1, data: p})},
      {id: 'batch-2', handler: (p: any) => ({batch: 2, data: p})},
      {id: 'batch-3', handler: (p: any) => ({batch: 3, data: p})}
    ]

    const result = cyre.on(handlers)
    return result.ok
  })

  // Test 6: Verify batch functionality works
  await test('Batch functionality verification', async () => {
    const results = await Promise.all([
      cyre.call('batch-1', {test: 'data1'}),
      cyre.call('batch-2', {test: 'data2'}),
      cyre.call('batch-3', {test: 'data3'})
    ])

    return (
      results.every(r => r.ok) &&
      results[0].payload.batch === 1 &&
      results[1].payload.batch === 2 &&
      results[2].payload.batch === 3
    )
  })

  // Test 7: Performance test
  await test('Performance (100 rapid calls)', async () => {
    cyre.action({id: 'perf-test'})
    cyre.on('perf-test', () => ({processed: true}))

    const start = Date.now()
    const promises = Array.from({length: 100}, () =>
      cyre.call('perf-test', {data: Math.random()})
    )
    const results = await Promise.all(promises)
    const duration = Date.now() - start

    console.log(
      `   ⏱️  100 calls in ${duration}ms (${(duration / 100).toFixed(2)}ms avg)`
    )
    return results.every(r => r.ok) && duration < 1000
  })

  console.log('\n✨ Simple test completed!')
}

// Add batch registration to cyre if not already implemented
declare module '../src/app' {
  interface CyreInstance {
    on(handlers: Array<{id: string; handler: any}>): any
  }
}

// Run test
simpleCyreTest().catch(console.error)
