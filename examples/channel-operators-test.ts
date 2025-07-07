// examples/channel-operators-test.ts
// Comprehensive test suite for channel operators and error handling

import {cyre} from '../src'
import {schema} from '../src/schema/cyre-schema'

/*

      C.Y.R.E - C.H.A.N.N.E.L - O.P.E.R.A.T.O.R.S - T.E.S.T
      
      Test all channel operators:
      - Individual operator functionality
      - Error handling and edge cases
      - Operator combinations
      - Performance validation
      - Real-world scenarios

*/

async function runChannelOperatorsTest() {
  console.log('🧪 CYRE CHANNEL OPERATORS TEST SUITE')
  console.log('=====================================\n')

  await cyre.init()

  let testCount = 0
  let passCount = 0
  let failCount = 0

  const test = (name: string, testFn: () => Promise<boolean> | boolean) => {
    return async () => {
      testCount++
      try {
        const result = await testFn()
        if (result) {
          console.log(`✅ ${name}`)
          passCount++
        } else {
          console.log(`❌ ${name} - FAILED`)
          failCount++
        }
      } catch (error) {
        console.log(`❌ ${name} - ERROR: ${error}`)
        failCount++
      }
    }
  }

  // ========================================
  // SCHEMA OPERATOR TESTS
  // ========================================

  console.log('📋 SCHEMA OPERATOR TESTS')
  console.log('========================')

  await test('Schema operator - valid data', async () => {
    cyre.action({
      id: 'schema-valid-test',
      schema: schema.object({
        name: schema.string(),
        age: schema.number()
      })
    })

    cyre.on('schema-valid-test', payload => {
      return {success: true, validated: payload}
    })

    const result = await cyre.call('schema-valid-test', {
      name: 'John',
      age: 30
    })

    return result.ok && result.payload.validated.name === 'John'
  })()

  await test('Schema operator - invalid data should block', async () => {
    cyre.action({
      id: 'schema-invalid-test',
      schema: schema.object({
        name: schema.string(),
        age: schema.number()
      })
    })

    cyre.on('schema-invalid-test', payload => {
      return {success: true, shouldNotReachHere: true}
    })

    const result = await cyre.call('schema-invalid-test', {
      name: 'John',
      age: 'not-a-number' // Invalid
    })

    return !result.ok && result.message.includes('Schema failed')
  })()

  await test('Schema operator - data transformation', async () => {
    cyre.action({
      id: 'schema-transform-test',
      schema: schema.object({
        email: schema.string().transform(email => email.toLowerCase())
      })
    })

    cyre.on('schema-transform-test', payload => {
      return {transformed: payload}
    })

    const result = await cyre.call('schema-transform-test', {
      email: 'USER@EXAMPLE.COM'
    })

    return result.ok && result.payload.transformed.email === 'user@example.com'
  })()

  // ========================================
  // REQUIRED OPERATOR TESTS
  // ========================================

  console.log('\n📝 REQUIRED OPERATOR TESTS')
  console.log('===========================')

  await test('Required operator - blocks undefined payload', async () => {
    cyre.action({
      id: 'required-undefined-test',
      required: true
    })

    cyre.on('required-undefined-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('required-undefined-test', undefined)
    return !result.ok && result.message.includes('required')
  })()

  await test('Required operator - blocks empty string', async () => {
    cyre.action({
      id: 'required-empty-test',
      required: true
    })

    cyre.on('required-empty-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('required-empty-test', '')
    return !result.ok && result.message.includes('empty string')
  })()

  await test('Required operator - allows valid data', async () => {
    cyre.action({
      id: 'required-valid-test',
      required: true
    })

    cyre.on('required-valid-test', payload => {
      return {received: payload}
    })

    const result = await cyre.call('required-valid-test', {data: 'valid'})
    return result.ok && result.payload.received.data === 'valid'
  })()

  // ========================================
  // SELECTOR OPERATOR TESTS
  // ========================================

  console.log('\n🎯 SELECTOR OPERATOR TESTS')
  console.log('===========================')

  await test('Selector operator - extracts data', async () => {
    cyre.action({
      id: 'selector-extract-test',
      selector: payload => payload.user.profile
    })

    cyre.on('selector-extract-test', payload => {
      return {selected: payload}
    })

    const result = await cyre.call('selector-extract-test', {
      user: {
        id: 123,
        profile: {name: 'Alice', email: 'alice@example.com'}
      },
      metadata: {timestamp: Date.now()}
    })

    return (
      result.ok &&
      result.payload.selected.name === 'Alice' &&
      result.payload.selected.email === 'alice@example.com'
    )
  })()

  await test('Selector operator - handles errors gracefully', async () => {
    cyre.action({
      id: 'selector-error-test',
      selector: payload => payload.nonexistent.property
    })

    cyre.on('selector-error-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('selector-error-test', {data: 'test'})
    return !result.ok && result.message.includes('Selector execution failed')
  })()

  // ========================================
  // CONDITION OPERATOR TESTS
  // ========================================

  console.log('\n⚖️ CONDITION OPERATOR TESTS')
  console.log('============================')

  await test('Condition operator - allows when condition met', async () => {
    cyre.action({
      id: 'condition-met-test',
      condition: payload => payload.status === 'active'
    })

    cyre.on('condition-met-test', payload => {
      return {conditionMet: true, data: payload}
    })

    const result = await cyre.call('condition-met-test', {
      status: 'active',
      user: 'john'
    })

    return result.ok && result.payload.conditionMet
  })()

  await test('Condition operator - blocks when condition not met', async () => {
    cyre.action({
      id: 'condition-not-met-test',
      condition: payload => payload.status === 'active'
    })

    cyre.on('condition-not-met-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('condition-not-met-test', {
      status: 'inactive',
      user: 'john'
    })

    return !result.ok && result.message.includes('Condition not met')
  })()

  await test('Condition operator - handles function errors', async () => {
    cyre.action({
      id: 'condition-error-test',
      condition: payload => {
        throw new Error('Condition function error')
      }
    })

    cyre.on('condition-error-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('condition-error-test', {data: 'test'})
    return !result.ok && result.message.includes('Condition execution failed')
  })()

  // ========================================
  // TRANSFORM OPERATOR TESTS
  // ========================================

  console.log('\n🔄 TRANSFORM OPERATOR TESTS')
  console.log('============================')

  await test('Transform operator - modifies data', async () => {
    cyre.action({
      id: 'transform-modify-test',
      transform: payload => ({
        ...payload,
        processed: true,
        timestamp: Date.now(),
        uppercaseName: payload.name.toUpperCase()
      })
    })

    cyre.on('transform-modify-test', payload => {
      return {transformed: payload}
    })

    const result = await cyre.call('transform-modify-test', {
      name: 'alice',
      age: 25
    })

    return (
      result.ok &&
      result.payload.transformed.processed === true &&
      result.payload.transformed.uppercaseName === 'ALICE' &&
      result.payload.transformed.age === 25
    )
  })()

  await test('Transform operator - handles errors', async () => {
    cyre.action({
      id: 'transform-error-test',
      transform: payload => {
        throw new Error('Transform failed')
      }
    })

    cyre.on('transform-error-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('transform-error-test', {data: 'test'})
    return !result.ok && result.message.includes('Transform execution failed')
  })()

  // ========================================
  // DETECT CHANGES OPERATOR TESTS
  // ========================================

  console.log('\n🔍 DETECT CHANGES OPERATOR TESTS')
  console.log('=================================')

  await test('DetectChanges operator - allows first call', async () => {
    cyre.action({
      id: 'detect-changes-first-test',
      detectChanges: true
    })

    cyre.on('detect-changes-first-test', payload => {
      return {firstCall: true, data: payload}
    })

    const result = await cyre.call('detect-changes-first-test', {value: 1})
    return result.ok && result.payload.firstCall
  })()

  await test('DetectChanges operator - blocks identical calls', async () => {
    cyre.action({
      id: 'detect-changes-block-test',
      detectChanges: true
    })

    cyre.on('detect-changes-block-test', payload => {
      return {executed: true, data: payload}
    })

    // First call should succeed
    const result1 = await cyre.call('detect-changes-block-test', {value: 42})

    // Second call with same payload should be blocked
    const result2 = await cyre.call('detect-changes-block-test', {value: 42})

    return (
      result1.ok &&
      !result2.ok &&
      result2.message.includes('No changes detected')
    )
  })()

  await test('DetectChanges operator - allows changed calls', async () => {
    cyre.action({
      id: 'detect-changes-allow-test',
      detectChanges: true
    })

    cyre.on('detect-changes-allow-test', payload => {
      return {executed: true, value: payload.value}
    })

    // First call
    const result1 = await cyre.call('detect-changes-allow-test', {value: 1})

    // Second call with different payload should succeed
    const result2 = await cyre.call('detect-changes-allow-test', {value: 2})

    return (
      result1.ok &&
      result2.ok &&
      result1.payload.value === 1 &&
      result2.payload.value === 2
    )
  })()

  // ========================================
  // OPERATOR COMBINATIONS TESTS
  // ========================================

  console.log('\n🔗 OPERATOR COMBINATIONS TESTS')
  console.log('===============================')

  await test('Pipeline: Required + Schema + Transform', async () => {
    cyre.action({
      id: 'pipeline-combo-test',
      required: true,
      schema: schema.object({
        name: schema.string(),
        email: schema.string().email()
      }),
      transform: payload => ({
        ...payload,
        name: payload.name.trim(),
        email: payload.email.toLowerCase(),
        processed: true
      })
    })

    cyre.on('pipeline-combo-test', payload => {
      return {pipelineResult: payload}
    })

    const result = await cyre.call('pipeline-combo-test', {
      name: '  Alice  ',
      email: 'ALICE@EXAMPLE.COM'
    })

    return (
      result.ok &&
      result.payload.pipelineResult.name === 'Alice' &&
      result.payload.pipelineResult.email === 'alice@example.com' &&
      result.payload.pipelineResult.processed === true
    )
  })()

  await test('Pipeline: Selector + Condition + Transform', async () => {
    cyre.action({
      id: 'pipeline-advanced-test',
      selector: payload => payload.user,
      condition: user => user.isActive,
      transform: user => ({
        id: user.id,
        displayName: `${user.firstName} ${user.lastName}`,
        role: user.role.toUpperCase()
      })
    })

    cyre.on('pipeline-advanced-test', payload => {
      return {processedUser: payload}
    })

    const result = await cyre.call('pipeline-advanced-test', {
      user: {
        id: 123,
        firstName: 'John',
        lastName: 'Doe',
        role: 'admin',
        isActive: true
      },
      metadata: {timestamp: Date.now()}
    })

    return (
      result.ok &&
      result.payload.processedUser.id === 123 &&
      result.payload.processedUser.displayName === 'John Doe' &&
      result.payload.processedUser.role === 'ADMIN'
    )
  })()

  await test('Pipeline: Early termination on condition failure', async () => {
    cyre.action({
      id: 'pipeline-termination-test',
      selector: payload => payload.user,
      condition: user => user.isActive, // This will fail
      transform: user => ({shouldNotReach: true})
    })

    cyre.on('pipeline-termination-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('pipeline-termination-test', {
      user: {
        id: 123,
        isActive: false // Condition will fail
      }
    })

    return !result.ok && result.message.includes('Condition not met')
  })()

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  console.log('\n🚨 ERROR HANDLING TESTS')
  console.log('========================')

  await test('Pipeline preserves error information', async () => {
    cyre.action({
      id: 'error-info-test',
      transform: payload => {
        throw new Error('Custom transform error')
      }
    })

    cyre.on('error-info-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('error-info-test', {data: 'test'})

    return (
      !result.ok &&
      result.message.includes('Transform execution failed') &&
      result.message.includes('Custom transform error')
    )
  })()

  await test('Multiple operators - reports first failure', async () => {
    cyre.action({
      id: 'first-failure-test',
      required: false, // This passes
      condition: payload => false, // This fails first
      transform: payload => {
        throw new Error('Should not reach')
      }
    })

    cyre.on('first-failure-test', payload => {
      return {shouldNotReach: true}
    })

    const result = await cyre.call('first-failure-test', {data: 'test'})

    return !result.ok && result.message.includes('Condition not met')
  })()

  // ========================================
  // PERFORMANCE TESTS
  // ========================================

  console.log('\n⚡ PERFORMANCE TESTS')
  console.log('====================')

  await test('Function reference pipeline performance', async () => {
    cyre.action({
      id: 'performance-test',
      required: true,
      schema: schema.object({value: schema.number()}),
      transform: payload => ({...payload, processed: true})
    })

    cyre.on('performance-test', payload => {
      return {result: payload}
    })

    const startTime = performance.now()
    const iterations = 1000

    for (let i = 0; i < iterations; i++) {
      await cyre.call('performance-test', {value: i})
    }

    const endTime = performance.now()
    const avgTime = (endTime - startTime) / iterations

    console.log(
      `   📊 ${iterations} iterations: ${avgTime.toFixed(3)}ms avg per call`
    )

    return avgTime < 1.0 // Should be under 1ms per call
  })()

  // ========================================
  // SUMMARY
  // ========================================

  console.log('\n📊 TEST SUMMARY')
  console.log('===============')
  console.log(`Total Tests: ${testCount}`)
  console.log(`✅ Passed: ${passCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log(`Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%`)

  if (failCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Channel operators working correctly.')
  } else {
    console.log(
      `\n⚠️ ${failCount} test(s) failed. Check operator implementations.`
    )
  }

  return failCount === 0
}

// Export for external use
export {runChannelOperatorsTest}

// Run if called directly

runChannelOperatorsTest().catch(console.error)
