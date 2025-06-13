// demo/verify-talent-fix.ts
// Quick test to verify talent implementations are working

import {cyre} from '../src'
import {clearAllOptimizationCaches} from '../src/schema/channel-operators'
import {string, object, number} from '../src/schema/cyre-schema'

/**
 * Quick verification test for talent functionality
 */
async function verifyTalentFix() {
  console.log('🔧 VERIFYING TALENT FIX')
  console.log('======================')

  // CRITICAL: Clear all caches to ensure we use fixed implementations
  clearAllOptimizationCaches()

  let passed = 0
  let failed = 0
  const results: string[] = []

  // Test 1: Schema validation
  console.log('\n1. Testing Schema Validation...')
  try {
    cyre.action({
      id: 'schema-test-fix',
      throttle: 100,

      schema: string()
    })
    cyre.on('schema-test-fix', (payload: any) => ({received: payload}))

    // Valid payload
    const validResult = await cyre.call('schema-test-fix', 'valid string')
    if (validResult.ok) {
      passed++
      results.push('✅ Schema: Valid payload accepted')
    } else {
      failed++
      results.push('❌ Schema: Valid payload rejected - ' + validResult.message)
    }

    // Invalid payload
    const invalidResult = await cyre.call('schema-test-fix', 123)
    if (!invalidResult.ok) {
      passed++
      results.push('✅ Schema: Invalid payload correctly rejected')
    } else {
      failed++
      results.push('❌ Schema: Invalid payload incorrectly accepted')
    }
  } catch (error) {
    failed++
    results.push('❌ Schema: Test failed with error - ' + error)
  }

  // Test 2: Required validation
  console.log('2. Testing Required Validation...')
  try {
    cyre.action({
      id: 'required-test-fix',
      required: true
    })
    cyre.on('required-test-fix', (payload: any) => ({received: payload}))

    // Valid payload
    const validResult = await cyre.call('required-test-fix', {data: 'present'})
    if (validResult.ok) {
      passed++
      results.push('✅ Required: Valid payload accepted')
    } else {
      failed++
      results.push(
        '❌ Required: Valid payload rejected - ' + validResult.message
      )
    }

    // Missing payload
    const missingResult = await cyre.call('required-test-fix', undefined)
    if (!missingResult.ok) {
      passed++
      results.push('✅ Required: Missing payload correctly rejected')
    } else {
      failed++
      results.push('❌ Required: Missing payload incorrectly accepted')
    }
  } catch (error) {
    failed++
    results.push('❌ Required: Test failed with error - ' + error)
  }

  // Test 3: Condition validation
  console.log('3. Testing Condition Validation...')
  try {
    cyre.action({
      id: 'condition-test-fix',
      condition: (payload: any) => payload.value > 10
    })
    cyre.on('condition-test-fix', (payload: any) => ({received: payload}))

    // Condition met
    const validResult = await cyre.call('condition-test-fix', {value: 15})
    if (validResult.ok) {
      passed++
      results.push('✅ Condition: Valid condition accepted')
    } else {
      failed++
      results.push(
        '❌ Condition: Valid condition rejected - ' + validResult.message
      )
    }

    // Condition not met
    const invalidResult = await cyre.call('condition-test-fix', {value: 5})
    if (!invalidResult.ok) {
      passed++
      results.push('✅ Condition: Failed condition correctly rejected')
    } else {
      failed++
      results.push('❌ Condition: Failed condition incorrectly accepted')
    }
  } catch (error) {
    failed++
    results.push('❌ Condition: Test failed with error - ' + error)
  }

  // Test 4: Transform functionality
  console.log('4. Testing Transform Functionality...')
  try {
    cyre.action({
      id: 'transform-test-fix',
      transform: (payload: any) => ({...payload, transformed: true})
    })
    cyre.on('transform-test-fix', (payload: any) => ({received: payload}))

    const result = await cyre.call('transform-test-fix', {original: 'data'})
    if (result.ok && result.payload.received.transformed === true) {
      passed++
      results.push('✅ Transform: Payload correctly transformed')
    } else {
      failed++
      results.push('❌ Transform: Payload not transformed correctly')
    }
  } catch (error) {
    failed++
    results.push('❌ Transform: Test failed with error - ' + error)
  }

  // Test 5: Selector functionality
  console.log('5. Testing Selector Functionality...')
  try {
    cyre.action({
      id: 'selector-test-fix',
      selector: (payload: any) => ({id: payload.userId, name: payload.userName})
    })
    cyre.on('selector-test-fix', (payload: any) => ({received: payload}))

    const result = await cyre.call('selector-test-fix', {
      userId: 123,
      userName: 'John',
      extra: 'ignored'
    })

    if (
      result.ok &&
      result.payload.received.id === 123 &&
      result.payload.received.name === 'John' &&
      !result.payload.received.extra
    ) {
      passed++
      results.push('✅ Selector: Payload correctly selected')
    } else {
      failed++
      results.push('❌ Selector: Payload not selected correctly')
    }
  } catch (error) {
    failed++
    results.push('❌ Selector: Test failed with error - ' + error)
  }

  // Display results
  console.log('\n📊 VERIFICATION RESULTS')
  console.log('======================')
  results.forEach(result => console.log(result))

  console.log(
    `\n📈 SUMMARY: ${passed}/${passed + failed} tests passed (${(
      (passed / (passed + failed)) *
      100
    ).toFixed(1)}%)`
  )

  if (failed === 0) {
    console.log('\n🎉 ALL TALENT FIXES WORKING CORRECTLY!')
    console.log(
      '✅ You can now run the full test suite and expect 100% functional test pass rate'
    )
  } else {
    console.log('\n⚠️ SOME TALENT IMPLEMENTATIONS STILL NEED FIXES')
    console.log(`❌ ${failed} tests failed - review the implementations above`)
  }

  return failed === 0
}

/**
 * Run verification
 */

verifyTalentFix()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Verification failed:', error)
    process.exit(1)
  })

export {verifyTalentFix}
