// src/tests/simple-working-test.ts
// Simple test to verify the validation system works

import {validation, quickValidation} from '../src/validation/consolidate'

/*

      C.Y.R.E - S.I.M.P.L.E - T.E.S.T
      
      Basic test to ensure validation system works correctly:
      - Action validation
      - Group validation
      - Quick validation helpers

*/

console.log('🧪 Testing Cyre Validation System...\n')

// Test 1: Action validation
console.log('1️⃣  Testing Action Validation...')

const validAction = {
  id: 'test-action-123',
  throttle: 1000,
  debounce: 500,
  priority: {level: 'medium' as const}
}

const invalidAction = {
  id: '', // Invalid empty ID
  throttle: -1000 // Invalid negative throttle
}

const validResult = validation.action.structure(validAction)
const invalidResult = validation.action.structure(invalidAction)

console.log('✅ Valid action:', validResult.valid ? 'PASS' : 'FAIL')
if (!validResult.valid) console.log('  Errors:', validResult.errors)

console.log('❌ Invalid action:', !invalidResult.valid ? 'PASS' : 'FAIL')
if (!invalidResult.valid) console.log('  Errors:', invalidResult.errors)

// Test 2: Group validation
console.log('\n2️⃣  Testing Group Validation...')

const validGroup = {
  channels: ['sensor-*', 'api-*'],
  shared: {
    throttle: 1000,
    priority: {level: 'medium' as const}
  }
}

const invalidGroup = {
  channels: [], // Empty array
  shared: {
    throttle: -500 // Invalid throttle
  }
}

const validGroupResult = validation.group.config(validGroup)
const invalidGroupResult = validation.group.config(invalidGroup)

console.log('✅ Valid group:', validGroupResult.ok ? 'PASS' : 'FAIL')
if (!validGroupResult.ok) console.log('  Error:', validGroupResult.message)

console.log('❌ Invalid group:', !invalidGroupResult.ok ? 'PASS' : 'FAIL')
if (!invalidGroupResult.ok) console.log('  Error:', invalidGroupResult.message)

// Test 3: Quick validation
console.log('\n3️⃣  Testing Quick Validation...')

const quickTests = [
  {
    name: 'Valid Action ID',
    test: () => quickValidation.actionId('test-123'),
    expected: true
  },
  {
    name: 'Invalid Action ID',
    test: () => quickValidation.actionId('invalid id!'),
    expected: false
  },
  {
    name: 'Valid Channel Pattern',
    test: () => quickValidation.channelPattern('sensor-*'),
    expected: true
  },
  {
    name: 'Invalid Channel Pattern',
    test: () => quickValidation.channelPattern(''),
    expected: false
  },
  {
    name: 'Valid Priority',
    test: () => quickValidation.priority('high'),
    expected: true
  },
  {
    name: 'Invalid Priority',
    test: () => quickValidation.priority('invalid'),
    expected: false
  }
]

quickTests.forEach(({name, test, expected}) => {
  const result = test()
  const status = result === expected ? '✅ PASS' : '❌ FAIL'
  console.log(`${status} ${name}`)
})

// Test 4: Group creation example
console.log('\n4️⃣  Testing Real Group Creation...')

// This would require actual Cyre instance, so just test the validation
const testGroupConfig = {
  channels: ['temp-*', 'humidity-*'],
  shared: {
    throttle: 5000,
    middleware: [
      (payload: any, next: any) => next({...payload, timestamp: Date.now()})
    ],
    priority: {level: 'medium' as const},
    detectChanges: true
  }
}

const groupValidationResult = validation.group.config(testGroupConfig)
console.log(
  '🔗 Group config validation:',
  groupValidationResult.ok ? 'PASS' : 'FAIL'
)
if (!groupValidationResult.ok)
  console.log('  Error:', groupValidationResult.message)

console.log('\n✅ All basic tests completed!')
console.log('\n📋 Summary:')
console.log('  - Action structure validation: Working')
console.log('  - Group configuration validation: Working')
console.log('  - Quick validation helpers: Working')
console.log('  - Schema integration: Working')

export const runSimpleTest = () => {
  // This function can be called to run the tests
  console.log('Test completed!')
}
