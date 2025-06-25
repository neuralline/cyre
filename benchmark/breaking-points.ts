// benchmark/breaking-points.ts
// CYRE SYSTEM STRESS TESTS - Finding the Breaking Point
// Challenge: Make Cyre throw errors or log critical system failures

import cyre from '../src'

// ========================================
// ATTACK VECTOR 1: Memory Exhaustion Attack
// ========================================

async function memoryExhaustionAttack() {
  console.log('🔥 ATTACK 1: Memory Exhaustion Attack')

  try {
    // Create massive payloads to exhaust memory
    const massiveArray = new Array(1000000).fill('x'.repeat(10000))

    // Register thousands of actions with massive payloads
    for (let i = 0; i < 10000; i++) {
      cyre.action({
        id: `memory-bomb-${i}`,
        detectChanges: true // Forces payload storage
      })

      cyre.on(`memory-bomb-${i}`, async payload => {
        // Force memory allocation in handler
        const localMassive = new Array(100000).fill(payload)
        return {processed: localMassive.length}
      })

      // Call with massive payload
      await cyre.call(`memory-bomb-${i}`, {
        data: massiveArray,
        timestamp: Date.now(),
        metadata: new Array(1000).fill('metadata')
      })
    }
  } catch (error) {
    console.error('🎯 CAUGHT SYSTEM ERROR:', error)
    return true
  }
  return false
}

// ========================================
// ATTACK VECTOR 2: Recursive Stack Overflow
// ========================================

async function recursiveStackOverflow() {
  console.log('🔥 ATTACK 2: Recursive Stack Overflow')

  try {
    let callDepth = 0

    cyre.action({id: 'recursive-bomb'})
    cyre.on('recursive-bomb', async payload => {
      callDepth++
      console.log(`Recursion depth: ${callDepth}`)

      if (callDepth < 50000) {
        // Force deep recursion
        // Recursive call - should trigger stack overflow
        return await cyre.call('recursive-bomb', {
          depth: callDepth,
          data: new Array(1000).fill(`level-${callDepth}`)
        })
      }
      return {maxDepth: callDepth}
    })

    await cyre.call('recursive-bomb', {initial: true})
  } catch (error) {
    console.error('🎯 CAUGHT STACK OVERFLOW:', error)
    return true
  }
  return false
}

// ========================================
// ATTACK VECTOR 3: Quantum State Corruption
// ========================================

async function quantumStateCorruption() {
  console.log('🔥 ATTACK 3: Quantum State Corruption')

  try {
    // Try to corrupt internal state by overwhelming the breathing system
    for (let i = 0; i < 1000; i++) {
      cyre.action({
        id: `stress-${i}`,
        priority: {level: 'critical'}, // All critical to bypass recuperation
        throttle: 1 // Minimal throttle
      })

      cyre.on(`stress-${i}`, async () => {
        // Simulate heavy CPU work to stress the system
        const start = Date.now()
        while (Date.now() - start < 100) {
          Math.random() * Math.random()
        }

        // Try to force system into critical stress
        throw new Error(`Stress bomb ${i} - system overload`)
      })
    }

    // Fire all at once to overwhelm quantum breathing
    const promises = []
    for (let i = 0; i < 1000; i++) {
      promises.push(cyre.call(`stress-${i}`, {bomb: i}))
    }

    await Promise.all(promises)
  } catch (error) {
    console.error('🎯 CAUGHT QUANTUM STATE ERROR:', error)
    return true
  }
  return false
}

// ========================================
// ATTACK VECTOR 4: TimeKeeper Formation Bomb
// ========================================

async function timeKeeperFormationBomb() {
  console.log('🔥 ATTACK 4: TimeKeeper Formation Bomb')

  try {
    // Create thousands of timers to exhaust system resources
    for (let i = 0; i < 10000; i++) {
      cyre.action({
        id: `timer-bomb-${i}`,
        interval: 1, // 1ms intervals - extremely aggressive
        repeat: true,
        payload: {bomb: i, data: new Array(1000).fill('timer-data')}
      })
    }

    // Let it run for a bit to build up formation pressure
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Now try to manipulate locked system state
    const systemState = cyre.getSystemHealth()
    if (systemState.breathing.stress > 0.95) {
      console.log('🎯 ACHIEVED CRITICAL SYSTEM STRESS!')
    }
  } catch (error) {
    console.error('🎯 CAUGHT TIMEKEEPER ERROR:', error)
    return true
  }
  return false
}

// ========================================
// ATTACK VECTOR 5: Schema Validation Bomb
// ========================================

async function schemaValidationBomb() {
  console.log('🔥 ATTACK 5: Schema Validation Bomb')

  try {
    // Create deeply nested schema that's expensive to validate
    const deepSchema = cyre.schema.object({
      level1: cyre.schema.object({
        level2: cyre.schema.object({
          level3: cyre.schema.object({
            level4: cyre.schema.object({
              level5: cyre.schema.array(cyre.schema.string()),
              data: cyre.schema.string()
            })
          })
        })
      })
    })

    cyre.action({
      id: 'schema-bomb',
      schema: deepSchema
    })

    cyre.on('schema-bomb', async payload => {
      return {validated: true}
    })

    // Send malformed data to trigger validation errors
    const malformedPayloads = [
      null,
      undefined,
      {level1: null},
      {level1: {level2: {level3: {level4: {level5: 'not-an-array'}}}}},
      new Array(100000).fill('massive-array-item'),
      {
        level1: {
          level2: {level3: {level4: {level5: new Array(100000).fill('x')}}}
        }
      }
    ]

    for (const payload of malformedPayloads) {
      await cyre.call('schema-bomb', payload)
    }
  } catch (error) {
    console.error('🎯 CAUGHT SCHEMA VALIDATION ERROR:', error)
    return true
  }
  return false
}

// ========================================
// ATTACK VECTOR 6: System Lock Manipulation
// ========================================

async function systemLockManipulation() {
  console.log('🔥 ATTACK 6: System Lock Manipulation')

  try {
    // Try to trigger system lock failure
    const lockResult = cyre.lock()
    console.log('Lock result:', lockResult)

    // Try to add actions after lock (should fail gracefully)
    try {
      cyre.action({id: 'post-lock-action'})
      console.log('🚨 SYSTEM ALLOWED ACTION AFTER LOCK!')
    } catch (lockError) {
      console.log('Lock working as expected')
    }

    // Try to trigger shutdown failure by manipulating state
    setTimeout(() => {
      try {
        cyre.shutdown()
      } catch (shutdownError) {
        console.error('🎯 CAUGHT SHUTDOWN ERROR:', shutdownError)
      }
    }, 100)
  } catch (error) {
    console.error('🎯 CAUGHT LOCK MANIPULATION ERROR:', error)
    return true
  }
  return false
}

// ========================================
// ATTACK VECTOR 7: Circular Reference Bomb
// ========================================

async function circularReferenceBomb() {
  console.log('🔥 ATTACK 7: Circular Reference Bomb')

  try {
    // Create circular reference payload
    const circular1: any = {name: 'circular1'}
    const circular2: any = {name: 'circular2'}
    circular1.ref = circular2
    circular2.ref = circular1
    circular1.self = circular1

    // Add deeply nested circular references
    for (let i = 0; i < 1000; i++) {
      circular1[`prop${i}`] = circular2
      circular2[`prop${i}`] = circular1
    }

    cyre.action({
      id: 'circular-bomb',
      detectChanges: true // This should trigger deep comparison
    })

    cyre.on('circular-bomb', async payload => {
      // Try to JSON.stringify circular reference
      try {
        JSON.stringify(payload)
      } catch (jsonError) {
        console.log('JSON stringify failed as expected')
      }

      // Return circular reference to trigger change detection comparison
      return circular1
    })

    await cyre.call('circular-bomb', circular1)
    await cyre.call('circular-bomb', circular2) // Should trigger change detection
  } catch (error) {
    console.error('🎯 CAUGHT CIRCULAR REFERENCE ERROR:', error)
    return true
  }
  return false
}

// ========================================
// MAIN ATTACK ORCHESTRATION
// ========================================

async function executeAllAttacks() {
  console.log('🚀 STARTING CYRE STRESS TEST ATTACKS')
  console.log('=====================================')

  const attacks = [
    {name: 'Memory Exhaustion', fn: memoryExhaustionAttack},
    {name: 'Recursive Stack Overflow', fn: recursiveStackOverflow},
    {name: 'Quantum State Corruption', fn: quantumStateCorruption},
    //{name: 'TimeKeeper Formation Bomb', fn: timeKeeperFormationBomb},
    {name: 'Schema Validation Bomb', fn: schemaValidationBomb},
    {name: 'System Lock Manipulation', fn: systemLockManipulation},
    {name: 'Circular Reference Bomb', fn: circularReferenceBomb}
  ]

  let successfulAttacks = 0

  for (const attack of attacks) {
    console.log(`\n--- Executing ${attack.name} ---`)
    try {
      const didCrash = await attack.fn()
      if (didCrash) {
        successfulAttacks++
        console.log(`✅ ${attack.name} triggered system error!`)
      } else {
        console.log(`❌ ${attack.name} failed to break Cyre`)
      }
    } catch (attackError) {
      successfulAttacks++
      console.error(`🎯 ${attack.name} caused unhandled error:`, attackError)
    }

    // Brief pause between attacks
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log('\n🏆 FINAL RESULTS')
  console.log('================')
  console.log(`Successful attacks: ${successfulAttacks}/${attacks.length}`)
  console.log(
    `Cyre resilience: ${(
      ((attacks.length - successfulAttacks) / attacks.length) *
      100
    ).toFixed(1)}%`
  )

  if (successfulAttacks === 0) {
    console.log('🛡️ CYRE IS UNBREAKABLE! All attacks were gracefully handled.')
  } else {
    console.log("💥 Found weaknesses in Cyre's armor!")
  }
}

// Initialize and run the attacks
async function main() {
  // Initialize Cyre
  try {
    await cyre.initialize()
    console.log('Cyre initialized successfully')

    // Execute all stress tests
    await executeAllAttacks()
  } catch (initError) {
    console.error('🎯 CAUGHT INITIALIZATION ERROR:', initError)
  }
}

// Run the stress tests
main().catch(console.error)
