// demo/debug.ts

// Debug the data-definitions structure

// Check if auth is actually in the dataDefinitions object
console.log('🔧 DEBUG: Checking dataDefinitions structure...')

// 1. First, let's see what's in dataDefinitions
import {dataDefinitions} from '../src/schema/data-definitions'

console.log('🔧 DEBUG: dataDefinitions keys:', Object.keys(dataDefinitions))
console.log('🔧 DEBUG: dataDefinitions has auth:', 'auth' in dataDefinitions)

// 2. Test the auth definition directly

// 3. Check if there are multiple auth definitions
const authKeys = Object.keys(dataDefinitions).filter(key =>
  key.includes('auth')
)
console.log('🔧 DEBUG: Keys containing "auth":', authKeys)

// 4. Test with the exact same data from your log
const testValue = {mode: 'session', sessionTimeout: 1800000}
console.log('🔧 DEBUG: Testing with exact log data...')

// 5. Check if there's a different auth definition being used
// Let's trace through the compilation process manually
console.log('\n🔧 DEBUG: Manual compilation trace...')
const actionKeys = ['id', 'auth', 'timeOfCreation', 'timestamp', 'type']

for (const key of actionKeys) {
  const definition = dataDefinitions[key as keyof typeof dataDefinitions]
  console.log(`🔧 DEBUG: Key "${key}" has definition: ${!!definition}`)
}

// 6. Check the exact structure of your dataDefinitions export
console.log('\n🔧 DEBUG: Full dataDefinitions structure:')
for (const [key, value] of Object.entries(dataDefinitions)) {
  console.log(`  ${key}: ${typeof value}`)
}

// 7. Alternative test - maybe there's an import issue
// Let's try importing and testing auth directly
try {
  // Check if auth is exported from the right place
  console.log('\n🔧 DEBUG: Testing auth import path...')

  // Test if the file can be imported
  console.log('🔧 DEBUG: dataDefinitions imported successfully')

  // Check if your auth function has the right signature
  if (typeof dataDefinitions.auth === 'function') {
    console.log('🔧 DEBUG: auth is a function, calling with test data...')
    console.log('🔧 DEBUG: CALLING AUTH NOW...')
    const directResult = dataDefinitions.auth({mode: 'test'})
    console.log('🔧 DEBUG: Direct auth call result:', directResult)
  }
} catch (error) {
  console.log('❌ DEBUG: Import/call error:', error)
}

// 8. Final check - maybe the console.log is being overridden or filtered
console.log('\n🔧 DEBUG: Testing console.log override...')
const originalLog = console.log
console.log = (...args) => {
  originalLog('🔧 INTERCEPTED:', ...args)
}

if (dataDefinitions.auth) {
  dataDefinitions.auth({mode: 'console-test'})
}

console.log = originalLog
console.log('🔧 DEBUG: Console.log test completed')

// Export a test function
export function testAuthDefinition() {
  console.log('\n🔧 DEBUG: Running testAuthDefinition...')

  if (!dataDefinitions.auth) {
    console.log('❌ auth definition missing from dataDefinitions')
    return false
  }

  console.log('✅ auth definition found')
  console.log('🔧 Calling auth definition with test data...')

  const result = dataDefinitions.auth({
    mode: 'session',
    sessionTimeout: 30000
  })

  console.log('🔧 Result:', result)
  return true
}
