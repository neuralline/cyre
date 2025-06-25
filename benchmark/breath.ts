// benchmark/breath.ts

import cyre from '../src'

// ADVANCED CYRE CORE SYSTEM ATTACK TESTS
// Going beyond the existing stress tests to find new breaking points

// ========================================
// ATTACK 1: Quantum Breathing System Hijack
// ========================================

async function quantumBreathingHijack() {
  console.log('🫁 ATTACK: Quantum Breathing System Hijack')

  try {
    // Create actions that specifically target breathing thresholds
    const breathingBombs = []

    for (let i = 0; i < 100; i++) {
      const actionId = `breathing-bomb-${i}`

      cyre.action({
        id: actionId,
        priority: {level: 'critical'}, // All critical to stress the breathing system
        throttle: 1 // Minimal throttle to maximize calls
      })

      cyre.on(actionId, async payload => {
        // Simulate expensive operations to stress CPU/memory
        const heavyWork = []
        for (let j = 0; j < 10000; j++) {
          heavyWork.push(Math.random() * Math.random() * Date.now())
        }

        // Try to trigger breathing pattern changes
        const stress = Math.random()
        if (stress > 0.8) {
          // Recursive breathing stress
          await cyre.call(`breathing-bomb-${(i + 1) % 100}`, {
            stress: stress,
            heavyWork: heavyWork.slice(0, 1000)
          })
        }

        return {processed: heavyWork.length, stress}
      })

      breathingBombs.push(actionId)
    }

    // Fire all breathing bombs simultaneously
    const promises = breathingBombs.map(async (actionId, index) => {
      for (let burst = 0; burst < 50; burst++) {
        cyre.call(actionId, {
          burst,
          timestamp: Date.now(),
          stress: Math.random()
        })
        await new Promise(resolve => setTimeout(resolve, 1)) // Tiny delay
      }
    })

    await Promise.all(promises)

    // Check if we triggered breathing system changes
    const systemHealth = cyre.getSystemHealth()
    console.log('Breathing system stress:', systemHealth.breathing.stress)
    console.log('Breathing rate:', systemHealth.breathing.rate)

    return systemHealth.breathing.stress > 0.9 // Success if high stress
  } catch (error) {
    console.error('🎯 BREATHING HIJACK ERROR:', error)
    return true
  }
}

// ========================================
// ATTACK 2: Timeline State Corruption
// ========================================

async function timelineStateCorruption() {
  console.log('📅 ATTACK: Timeline State Corruption')

  try {
    // Attack the timeline by creating conflicting timer patterns
    const conflicts = []

    for (let i = 0; i < 200; i++) {
      const timerId = `timeline-bomb-${i}`

      // Create overlapping intervals with same IDs
      const interval1 = 10 + (i % 5) // 10, 11, 12, 13, 14, 10, 11...
      const interval2 = 15 + (i % 3) // 15, 16, 17, 15, 16...

      // First timer
      cyre.action({
        id: timerId,
        interval: interval1,
        repeat: 'infinite'
      })

      cyre.on(timerId, async payload => {
        console.log(`Timer ${timerId} executing at ${Date.now()}`)

        // Try to manipulate timeline during execution
        if (Math.random() > 0.7) {
          cyre.forget(timerId) // Try to forget self

          // Immediately recreate with different interval
          cyre.action({
            id: timerId,
            interval: interval2,
            repeat: 'infinite'
          })
        }

        return {executed: true, interval: interval1}
      })

      conflicts.push(timerId)
    }

    // Wait for timeline chaos
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Try to clear all at once
    conflicts.forEach(id => cyre.forget(id))
  } catch (error) {
    console.error('🎯 TIMELINE CORRUPTION ERROR:', error)
    return true
  }

  return false
}

// ========================================
// ATTACK 3: Schema Validation Overflow
// ========================================

async function schemaValidationOverflow() {
  console.log('📋 ATTACK: Schema Validation Overflow')

  try {
    // Create extremely complex nested schemas
    const createDeepSchema = (depth: number): any => {
      if (depth <= 0) {
        return cyre.schema.string()
      }

      return cyre.schema.object({
        level: cyre.schema.number(),
        data: cyre.schema.array(createDeepSchema(depth - 1)),
        nested: createDeepSchema(depth - 1),
        optional: cyre.schema.string().optional(),
        union: cyre.schema.union(
          cyre.schema.string(),
          cyre.schema.number(),
          createDeepSchema(depth - 1)
        )
      })
    }

    // Create action with incredibly deep schema
    const deepSchema = createDeepSchema(20) // 20 levels deep!

    cyre.action({
      id: 'schema-overflow-test',
      schema: deepSchema
    })

    cyre.on('schema-overflow-test', async payload => {
      return {validated: true, depth: payload?.level || 0}
    })

    // Send payloads that will stress the validation
    const maliciousPayloads = [
      // Massive nested object
      {
        level: 1,
        data: Array.from({length: 1000}, (_, i) => ({
          level: i,
          data: Array.from({length: 100}, (_, j) => `item-${j}`)
        }))
      },

      // Circular reference attempt
      (() => {
        const circular: any = {level: 1, data: []}
        circular.nested = circular
        circular.data.push(circular)
        return circular
      })(),

      // Type confusion attack
      {
        level: 'not-a-number',
        data: 'not-an-array',
        nested: {completely: 'wrong', structure: true},
        union: {another: 'wrong', type: 'here'}
      },

      // Null injection
      null,
      undefined,

      // Array instead of object
      [1, 2, 3, 4, 5]
    ]

    // Rapid-fire all malicious payloads
    const promises = maliciousPayloads.map(async (payload, index) => {
      for (let i = 0; i < 100; i++) {
        await cyre.call('schema-overflow-test', payload)
      }
    })

    await Promise.all(promises)
  } catch (error) {
    console.error('🎯 SCHEMA OVERFLOW ERROR:', error)
    return true
  }

  return false
}

// ========================================
// ATTACK 4: Memory Leak Formation Attack
// ========================================

async function memoryLeakFormationAttack() {
  console.log('🧠 ATTACK: Memory Leak Formation Attack')

  try {
    const formations = []
    let memoryBefore = 0

    if (typeof process !== 'undefined' && process.memoryUsage) {
      memoryBefore = process.memoryUsage().heapUsed
    }

    // Create formations that accumulate memory
    for (let i = 0; i < 1000; i++) {
      const formationId = `memory-leak-${i}`

      cyre.action({
        id: formationId,
        interval: 50, // Fast interval
        repeat: 'infinite',
        detectChanges: true // Forces payload storage
      })

      cyre.on(formationId, async payload => {
        // Accumulate large objects that shouldn't be garbage collected
        const largeObject = {
          id: formationId,
          timestamp: Date.now(),
          data: new Array(1000).fill(`memory-consuming-data-${Date.now()}`),
          history: payload?.history || [],
          references: Array.from({length: 100}, () => ({
            ref: Date.now(),
            data: 'x'.repeat(1000)
          }))
        }

        // Add to history creating a growing chain
        if (!payload?.history) {
          largeObject.history = [largeObject]
        } else {
          largeObject.history = [...payload.history, largeObject]
        }

        // Return the large object to force Cyre to store it
        return largeObject
      })

      formations.push(formationId)

      // Trigger initial execution
      await cyre.call(formationId, {
        initialData: new Array(500).fill(`init-${i}`)
      })
    }

    // Let formations run to accumulate memory
    await new Promise(resolve => setTimeout(resolve, 5000))

    let memoryAfter = 0
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memoryAfter = process.memoryUsage().heapUsed
    }

    const memoryIncrease = memoryAfter - memoryBefore
    console.log(
      `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
    )

    // Clean up
    formations.forEach(id => cyre.forget(id))

    // Check if memory increase was significant
    return memoryIncrease > 50 * 1024 * 1024 // 50MB increase = potential leak
  } catch (error) {
    console.error('🎯 MEMORY LEAK ERROR:', error)
    return true
  }
}

// ========================================
// ATTACK 5: Chain Reaction Overflow
// ========================================

async function chainReactionOverflow() {
  console.log('⛓️ ATTACK: Chain Reaction Overflow')

  try {
    // Create a web of interconnected actions that trigger each other
    const chainLength = 50
    const chainIds = Array.from({length: chainLength}, (_, i) => `chain-${i}`)

    chainIds.forEach((id, index) => {
      cyre.action({id})

      cyre.on(id, async payload => {
        const depth = (payload?.depth || 0) + 1
        console.log(`Chain ${id} executing at depth ${depth}`)

        if (depth > 1000) {
          console.log(`Chain reached maximum depth: ${depth}`)
          return {terminated: true, depth}
        }

        // Trigger multiple other chains
        const nextChains = [
          (index + 1) % chainLength,
          (index + 3) % chainLength,
          (index + 7) % chainLength
        ]

        const results = await Promise.all(
          nextChains.map(nextIndex =>
            cyre.call(chainIds[nextIndex], {
              depth,
              triggerBy: id,
              payload: new Array(100).fill(`chain-data-${depth}`)
            })
          )
        )

        return {
          triggered: nextChains.length,
          depth,
          results: results.map(r => r.ok)
        }
      })
    })

    // Start multiple chain reactions simultaneously
    const starters = [0, 10, 20, 30, 40]
    const promises = starters.map(index =>
      cyre.call(chainIds[index], {
        depth: 0,
        starter: true
      })
    )

    await Promise.all(promises)
  } catch (error) {
    console.error('🎯 CHAIN REACTION ERROR:', error)
    return true
  }

  return false
}

// ========================================
// ATTACK 6: Event Loop Saturation
// ========================================

async function eventLoopSaturation() {
  console.log('🔄 ATTACK: Event Loop Saturation')

  try {
    // Create actions that saturate the event loop
    const saturators = []

    for (let i = 0; i < 100; i++) {
      const actionId = `saturator-${i}`

      cyre.action({
        id: actionId,
        throttle: 1, // Minimal throttle
        priority: {level: 'high'}
      })

      cyre.on(actionId, async payload => {
        // Block event loop with synchronous work
        const startTime = Date.now()
        while (Date.now() - startTime < 10) {
          // Busy wait for 10ms
          Math.random() * Math.random() * Math.random()
        }

        // Queue more work
        process.nextTick(() => {
          cyre.call(actionId, {
            iteration: (payload?.iteration || 0) + 1,
            timestamp: Date.now()
          })
        })

        return {processed: true, iteration: payload?.iteration || 0}
      })

      saturators.push(actionId)
    }

    // Start all saturators
    saturators.forEach(id => {
      cyre.call(id, {initial: true})
    })

    // Let them run for a bit
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Clean up
    saturators.forEach(id => cyre.forget(id))
  } catch (error) {
    console.error('🎯 EVENT LOOP SATURATION ERROR:', error)
    return true
  }

  return false
}

// ========================================
// MAIN ATTACK ORCHESTRATION
// ========================================

async function executeAdvancedAttacks() {
  console.log('🚀 STARTING ADVANCED CYRE CORE ATTACK TESTS')
  console.log('===========================================')

  const attacks = [
    {name: 'Quantum Breathing Hijack', fn: quantumBreathingHijack},
    {name: 'Timeline State Corruption', fn: timelineStateCorruption},
    //{name: 'Schema Validation Overflow', fn: schemaValidationOverflow},
    {name: 'Memory Leak Formation Attack', fn: memoryLeakFormationAttack},
    {name: 'Chain Reaction Overflow', fn: chainReactionOverflow},
    {name: 'Event Loop Saturation', fn: eventLoopSaturation}
  ]

  let successfulAttacks = 0
  const results = []

  for (const attack of attacks) {
    console.log(`\n--- Executing ${attack.name} ---`)

    const startTime = Date.now()
    try {
      const didBreak = await attack.fn()
      const duration = Date.now() - startTime

      if (didBreak) {
        successfulAttacks++
        console.log(`✅ ${attack.name} found vulnerability! (${duration}ms)`)
        results.push({name: attack.name, success: true, duration})
      } else {
        console.log(`❌ ${attack.name} failed to break Cyre (${duration}ms)`)
        results.push({name: attack.name, success: false, duration})
      }
    } catch (attackError) {
      successfulAttacks++
      const duration = Date.now() - startTime
      console.error(
        `🎯 ${attack.name} caused system error: (${duration}ms)`,
        attackError
      )
      results.push({
        name: attack.name,
        success: true,
        duration,
        error: String(attackError)
      })
    }

    // Clear system between attacks
    try {
      cyre.clear()
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (clearError) {
      console.log('⚠️ System clear had issues:', clearError)
    }
  }

  console.log('\n🏆 ADVANCED ATTACK RESULTS')
  console.log('==========================')
  console.log(`Successful attacks: ${successfulAttacks}/${attacks.length}`)
  console.log(
    `Cyre advanced resilience: ${(
      ((attacks.length - successfulAttacks) / attacks.length) *
      100
    ).toFixed(1)}%`
  )

  results.forEach(result => {
    const status = result.success ? '🎯 BROKE' : '🛡️ DEFENDED'
    console.log(`${status} ${result.name} (${result.duration}ms)`)
    if (result.error) {
      console.log(`    Error: ${result.error}`)
    }
  })

  if (successfulAttacks === 0) {
    console.log('🏰 CYRE IS A FORTRESS! Advanced attacks all failed.')
  } else {
    console.log(`💥 Found ${successfulAttacks} advanced vulnerabilities!`)
  }
}

// Initialize and execute
async function main() {
  try {
    await cyre.initialize()
    console.log('Cyre initialized for advanced attacks')

    await executeAdvancedAttacks()
  } catch (initError) {
    console.error('🎯 INITIALIZATION ERROR:', initError)
  }
}

// Run the advanced attacks
main().catch(console.error)
