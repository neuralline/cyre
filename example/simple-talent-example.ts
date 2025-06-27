// example/simple-talent-example.ts
// Example showing the simplified approach with fast existing structure

import {cyre} from '../src'
import {talents} from '../src/schema/talent-definitions'

/*

      C.Y.R.E - S.I.M.P.L.E - T.A.L.E.N.T - E.X.A.M.P.L.E
      
      Keeping fast existing structure with:
      1. Simple if checks for protection talents (block, throttle, debounce) before pipeline
      2. Pipeline only contains processing talents (schema, transform, condition, etc.)
      3. Runtime uses talent functions from talents directory
      4. Clean debounce handling without pipeline complexity

*/

async function demonstrateSimpleTalentSystem() {
  console.log('🚀 CYRE Simple Talent System Demonstration\n')

  // Initialize CYRE
  await cyre.init()

  // ===========================================
  // 1. PROTECTION TALENTS (Pre-pipeline checks)
  // ===========================================
  console.log('1️⃣  Protection Talents (Simple pre-pipeline checks)')

  // These are checked BEFORE pipeline execution
  cyre.action({
    id: 'protected-api',
    block: false, // ✅ Simple if check
    throttle: 1000, // ✅ Simple if check
    // debounce: 300, // ✅ Simple if check
    // These go to pipeline
    schema: cyre.schema.object({
      endpoint: cyre.schema.string()
    }),
    transform: (payload: any) => ({
      ...payload,
      timestamp: Date.now()
    })
  })

  cyre.on('protected-api', payload => {
    console.log(`  🌐 API: ${payload.endpoint} at ${payload.timestamp}`)
    return {success: true}
  })

  // ===========================================
  // 2. PIPELINE TALENTS (Uses talent functions)
  // ===========================================
  console.log('\n2️⃣  Pipeline Talents (Uses talent functions from directory)')

  cyre.action({
    id: 'user-processor',
    // Protection talents - simple checks
    throttle: 500,

    // Pipeline talents - uses talent functions
    //required: true, // Uses talents.required
    schema: cyre.schema.object({
      name: cyre.schema.string().minLength(2),
      email: cyre.schema.string().email()
    }), // Uses talents.schema
    transform: (user: any) => ({
      ...user,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    }), // Uses talents.transform
    condition: (user: any) => user.name.length > 1 // Uses talents.condition
  })

  cyre.on('user-processor', user => {
    console.log(`  👤 User processed: ${user.name} (${user.id})`)
    return {userId: user.id}
  })

  // ===========================================
  // 3. FAST PATH (No protections, no pipeline)
  // ===========================================
  console.log('\n3️⃣  Fast Path (No protections, direct execution)')

  cyre.action({
    id: 'simple-logger',
    // No protections, no pipeline = FAST PATH
    payload: {message: ''}
  })

  cyre.on('simple-logger', payload => {
    console.log(`  📝 Log: ${payload.message}`)
    return {logged: true}
  })

  // ===========================================
  // 4. EXECUTION FLOW DEMONSTRATION
  // ===========================================
  console.log('\n4️⃣  Execution Flow Demonstration\n')

  // Test fast path
  console.log('  🏃 Fast Path Execution:')
  const fastResult = await cyre.call('simple-logger', {
    message: 'Fast execution!'
  })
  console.log(`    Result: ${fastResult.ok ? 'Success' : fastResult.message}`)

  // Test protection talents (simple checks)
  console.log('\n  🛡️  Protection Talent Checks:')

  // First call - should work
  const firstCall = await cyre.call('protected-api', {endpoint: '/users'})
  console.log(`    First call: ${firstCall.ok ? 'Success' : firstCall.message}`)

  // Second call immediately - should be throttled
  const throttledCall = await cyre.call('protected-api', {endpoint: '/posts'})
  console.log(`    Immediate second call: ${throttledCall.message}`)

  // Test pipeline talents
  console.log('\n  🔄 Pipeline Talent Execution:')

  // Invalid user (will fail schema)
  const invalidUser = await cyre.call('user-processor', {
    name: 'X', // Too short
    email: 'invalid' // Invalid email
  })
  console.log(`    Invalid user: ${invalidUser.message}`)

  // Valid user (will go through full pipeline)
  const validUser = await cyre.call('user-processor', {
    name: 'John Doe',
    email: 'john@example.com'
  })
  console.log(`    Valid user: ${validUser.ok ? 'Success' : validUser.message}`)

  // ===========================================
  // 5. DEBOUNCE DEMONSTRATION (Clean handling)
  // ===========================================
  console.log('\n5️⃣  Debounce Demonstration (Clean handling)\n')

  cyre.action({
    id: 'search-input',
    debounce: 300, // Simple pre-pipeline check
    maxWait: 1000, // Maximum wait time
    transform: (payload: any) => ({
      ...payload,
      searchTime: Date.now()
    }) // Pipeline talent
  })

  cyre.on('search-input', payload => {
    console.log(
      `  🔍 Search executed: "${payload.query}" at ${payload.searchTime}`
    )
    return {results: [`Result for: ${payload.query}`]}
  })

  // Rapid search calls - should be debounced
  console.log('  📝 Rapid search calls (should be debounced):')
  await cyre.call('search-input', {query: 'a'})
  console.log('    Called with "a" - debounced')

  await cyre.call('search-input', {query: 'ab'})
  console.log('    Called with "ab" - debounced')

  await cyre.call('search-input', {query: 'abc'})
  console.log('    Called with "abc" - will execute after 300ms')

  // ===========================================
  // 6. INTROSPECTION
  // ===========================================
  console.log('\n6️⃣  System Introspection\n')

  // Check action compilation
  const userAction = cyre.get('user-processor')
  if (userAction) {
    console.log(`  📊 User Processor Action:`)
    console.log(`    Fast Path: ${userAction._hasFastPath}`)
    console.log(
      `    Pipeline Length: ${userAction._protectionPipeline?.length || 0}`
    )
    console.log(
      `    Has Protection Talents: ${!!(
        userAction.throttle ||
        userAction.debounce ||
        userAction.block
      )}`
    )
    console.log(
      `    Protection Types: ${
        userAction._protectionTypes?.join(', ') || 'none'
      }`
    )
  }

  const simpleAction = cyre.get('simple-logger')
  if (simpleAction) {
    console.log(`\n  ⚡ Simple Logger Action:`)
    console.log(`    Fast Path: ${simpleAction._hasFastPath}`)
    console.log(
      `    Pipeline Length: ${simpleAction._protectionPipeline?.length || 0}`
    )
  }

  // Available talents
  console.log('\n  🛠️  Available Talents by Category:')
  const protectionTalents = Object.keys(talents).filter(
    name => talents[name as keyof typeof talents].category === 'protection'
  )
  const processingTalents = Object.keys(talents).filter(
    name => talents[name as keyof typeof talents].category === 'processing'
  )
  const flowTalents = Object.keys(talents).filter(
    name => talents[name as keyof typeof talents].category === 'flow'
  )

  console.log(`    Protection (pre-pipeline): ${protectionTalents.join(', ')}`)
  console.log(`    Processing (pipeline): ${processingTalents.join(', ')}`)
  console.log(`    Flow (pipeline): ${flowTalents.join(', ')}`)

  console.log('\n✅ Simple talent system demonstration complete!')
  console.log('\nKey Features:')
  console.log('  • 🚀 Keeps existing fast structure')
  console.log(
    '  • 🛡️  Simple if checks for protection talents (block, throttle, debounce)'
  )
  console.log('  • 🔄 Pipeline uses talent functions from talents directory')
  console.log('  • 🧹 Clean debounce handling without pipeline complexity')
  console.log('  • ⚡ Fast path for actions with no protections')
  console.log('  • 🔗 Runtime links to talent functions for reusability')
}

demonstrateSimpleTalentSystem().catch(console.error)

export {demonstrateSimpleTalentSystem}
