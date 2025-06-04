// example/detailed-logging-test.ts
// Comprehensive logging example to debug state talents and pipeline execution

import {cyre} from '../src'

/*

      C.Y.R.E - D.E.T.A.I.L.E.D - L.O.G.G.I.N.G - E.X.A.M.P.L.E
      
      This example demonstrates:
      - State talent execution (selector, condition, transform)
      - Debounce behavior with detailed timing
      - Pipeline execution flow
      - Comprehensive logging at each step

*/

// Custom logger with detailed formatting
const logger = {
  step: (step: number, description: string, data?: any) => {
    console.log(`\n🔹 STEP ${step}: ${description}`)
    if (data) {
      console.log(`   Data:`, JSON.stringify(data, null, 2))
    }
  },

  result: (description: string, result: any) => {
    console.log(`\n✅ RESULT: ${description}`)
    console.log(`   Success: ${result.ok}`)
    console.log(`   Message: ${result.message}`)
    if (result.payload !== undefined) {
      console.log(`   Payload:`, JSON.stringify(result.payload, null, 2))
    }
    if (result.metadata) {
      console.log(`   Metadata:`, JSON.stringify(result.metadata, null, 2))
    }
  },

  handler: (description: string, payload: any) => {
    console.log(`\n🎯 HANDLER CALLED: ${description}`)
    console.log(`   Received payload:`, JSON.stringify(payload, null, 2))
    console.log(`   Payload type: ${typeof payload}`)
  },

  section: (title: string) => {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`   ${title}`)
    console.log(`${'='.repeat(60)}`)
  },

  timing: (description: string) => {
    const timestamp = new Date().toISOString()
    console.log(`\n⏰ ${timestamp}: ${description}`)
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function runDetailedLoggingTest() {
  logger.section('CYRE DETAILED LOGGING TEST')

  // Initialize Cyre
  logger.step(1, 'Initializing Cyre system')
  await cyre.initialize()
  cyre.clear()

  // TEST 1: Basic State Talents Pipeline
  logger.section('TEST 1: STATE TALENTS PIPELINE')

  logger.step(2, 'Setting up action with state talents', {
    selector: 'extracts payload.value',
    condition: 'value > 10',
    transform: 'adds processed: true',
    detectChanges: true
  })

  cyre.action({
    id: 'state-pipeline-test',
    selector: (payload: any) => {
      logger.handler('SELECTOR EXECUTING', payload)
      const selected = payload.value
      logger.handler('SELECTOR RESULT', selected)
      return selected
    },
    condition: (value: any) => {
      logger.handler('CONDITION EXECUTING', value)
      const conditionMet = value > 10
      logger.handler('CONDITION RESULT', {value, conditionMet})
      return conditionMet
    },
    transform: (value: any) => {
      logger.handler('TRANSFORM EXECUTING', value)
      const transformed = {
        originalValue: value,
        processed: true,
        timestamp: Date.now()
      }
      logger.handler('TRANSFORM RESULT', transformed)
      return transformed
    },
    detectChanges: true
  })

  // Setup handler to see final result
  const handlerResults: any[] = []
  cyre.on('state-pipeline-test', (payload: any) => {
    logger.handler('FINAL HANDLER', payload)
    handlerResults.push(payload)
    return {received: true}
  })

  logger.step(3, 'Calling with valid payload (value > 10)')
  const result1 = await cyre.call('state-pipeline-test', {
    value: 15,
    other: 'data'
  })
  logger.result('First call result', result1)

  logger.step(4, 'Calling with invalid payload (value <= 10)')
  const result2 = await cyre.call('state-pipeline-test', {
    value: 5,
    other: 'data'
  })
  logger.result('Second call result (should fail condition)', result2)

  logger.step(5, 'Handler results summary', {
    totalHandlerCalls: handlerResults.length,
    handlerResults
  })

  // TEST 2: Debounce Behavior
  logger.section('TEST 2: DEBOUNCE BEHAVIOR')

  const debounceResults: any[] = []

  logger.step(6, 'Setting up debounced action', {
    debounce: 100,
    selector: 'extracts search term',
    transform: 'lowercases and adds timestamp'
  })

  cyre.action({
    id: 'debounce-test',
    selector: (payload: any) => {
      logger.handler('DEBOUNCE SELECTOR', payload)
      return payload.search
    },
    transform: (search: any) => {
      logger.handler('DEBOUNCE TRANSFORM', search)
      return {
        query: search.toLowerCase(),
        timestamp: Date.now(),
        processed: true
      }
    },
    debounce: 100
  })

  cyre.on('debounce-test', (payload: any) => {
    logger.handler('DEBOUNCE FINAL HANDLER', payload)
    debounceResults.push(payload)
  })

  logger.step(7, 'Making rapid calls (should be debounced)')
  logger.timing('Call 1')
  const debounce1 = await cyre.call('debounce-test', {search: 'ABC', page: 1})
  logger.result('Debounce call 1', debounce1)

  logger.timing('Call 2 (10ms later)')
  await sleep(10)
  const debounce2 = await cyre.call('debounce-test', {search: 'ABCD', page: 1})
  logger.result('Debounce call 2', debounce2)

  logger.timing('Call 3 (20ms later)')
  await sleep(10)
  const debounce3 = await cyre.call('debounce-test', {search: 'ABCDE', page: 1})
  logger.result('Debounce call 3', debounce3)

  logger.step(8, 'Waiting for debounce execution (120ms)')
  await sleep(120)

  logger.step(9, 'Debounce results summary', {
    totalResults: debounceResults.length,
    results: debounceResults
  })

  // TEST 3: Schema Validation + State Pipeline
  logger.section('TEST 3: SCHEMA + STATE PIPELINE')

  const schemaResults: any[] = []

  logger.step(10, 'Setting up schema validation with state pipeline')

  cyre.action({
    id: 'schema-pipeline-test',
    schema: cyre.schema.object({
      user: cyre.schema.object({
        id: cyre.schema.number(),
        name: cyre.schema.string()
      }),
      timestamp: cyre.schema.number()
    }),
    selector: (payload: any) => {
      logger.handler('SCHEMA SELECTOR', payload)
      const selected = payload.user
      logger.handler('SCHEMA SELECTOR RESULT', selected)
      return selected
    },
    condition: (user: any) => {
      logger.handler('SCHEMA CONDITION', user)
      const valid = user.id > 0
      logger.handler('SCHEMA CONDITION RESULT', {user, valid})
      return valid
    },
    transform: (user: any) => {
      logger.handler('SCHEMA TRANSFORM', user)
      const transformed = {
        ...user,
        processed: true,
        transformedAt: Date.now()
      }
      logger.handler('SCHEMA TRANSFORM RESULT', transformed)
      return transformed
    }
  })

  cyre.on('schema-pipeline-test', (payload: any) => {
    logger.handler('SCHEMA FINAL HANDLER', payload)
    schemaResults.push(payload)
  })

  logger.step(11, 'Valid schema + valid condition')
  const schema1 = await cyre.call('schema-pipeline-test', {
    user: {id: 1, name: 'John'},
    timestamp: Date.now()
  })
  logger.result('Valid schema result', schema1)

  logger.step(12, 'Invalid schema test')
  const schema2 = await cyre.call('schema-pipeline-test', {
    user: {id: 'invalid', name: 'John'},
    timestamp: Date.now()
  })
  logger.result('Invalid schema result', schema2)

  logger.step(13, 'Valid schema + invalid condition')
  const schema3 = await cyre.call('schema-pipeline-test', {
    user: {id: 0, name: 'John'}, // id = 0 fails condition
    timestamp: Date.now()
  })
  logger.result('Valid schema, invalid condition result', schema3)

  logger.step(14, 'Schema test results summary', {
    totalResults: schemaResults.length,
    results: schemaResults
  })

  // TEST 4: Throttle + State Pipeline
  logger.section('TEST 4: THROTTLE + STATE PIPELINE')

  const throttleResults: any[] = []

  logger.step(15, 'Setting up throttled action with state pipeline')

  cyre.action({
    id: 'throttle-pipeline-test',
    selector: (payload: any) => {
      logger.handler('THROTTLE SELECTOR', payload)
      return payload.value
    },
    condition: (value: any) => {
      logger.handler('THROTTLE CONDITION', value)
      return value > 10
    },
    transform: (value: any) => {
      logger.handler('THROTTLE TRANSFORM', value)
      return {
        processedValue: value * 2,
        throttled: true,
        timestamp: Date.now()
      }
    },
    throttle: 100
  })

  cyre.on('throttle-pipeline-test', (payload: any) => {
    logger.handler('THROTTLE FINAL HANDLER', payload)
    throttleResults.push(payload)
  })

  logger.step(16, 'First throttled call (should execute)')
  const throttle1 = await cyre.call('throttle-pipeline-test', {
    value: 15,
    other: 'data'
  })
  logger.result('Throttle call 1', throttle1)

  logger.step(17, 'Second throttled call (should be blocked)')
  const throttle2 = await cyre.call('throttle-pipeline-test', {
    value: 20,
    other: 'data'
  })
  logger.result('Throttle call 2 (should be throttled)', throttle2)

  logger.step(18, 'Waiting for throttle to clear (120ms)')
  await sleep(120)

  logger.step(19, 'Third throttled call (should execute)')
  const throttle3 = await cyre.call('throttle-pipeline-test', {
    value: 25,
    other: 'data'
  })
  logger.result('Throttle call 3', throttle3)

  logger.step(20, 'Throttle test results summary', {
    totalResults: throttleResults.length,
    results: throttleResults
  })

  // TEST 5: Change Detection
  logger.section('TEST 5: CHANGE DETECTION')

  const changeResults: any[] = []

  logger.step(21, 'Setting up change detection with selector')

  cyre.action({
    id: 'change-detection-test',
    selector: (payload: any) => {
      logger.handler('CHANGE SELECTOR', payload)
      return payload.counter
    },
    transform: (counter: any) => {
      logger.handler('CHANGE TRANSFORM', counter)
      return {
        counter,
        doubled: counter * 2,
        timestamp: Date.now()
      }
    },
    detectChanges: true
  })

  cyre.on('change-detection-test', (payload: any) => {
    logger.handler('CHANGE FINAL HANDLER', payload)
    changeResults.push(payload)
  })

  logger.step(22, 'First call (should execute)')
  const change1 = await cyre.call('change-detection-test', {
    counter: 1,
    other: 'a'
  })
  logger.result('Change detection call 1', change1)

  logger.step(23, 'Second call with same selected value (should skip)')
  const change2 = await cyre.call('change-detection-test', {
    counter: 1,
    other: 'b'
  })
  logger.result('Change detection call 2 (same counter)', change2)

  logger.step(24, 'Third call with different selected value (should execute)')
  const change3 = await cyre.call('change-detection-test', {
    counter: 2,
    other: 'c'
  })
  logger.result('Change detection call 3 (different counter)', change3)

  logger.step(25, 'Change detection results summary', {
    totalResults: changeResults.length,
    results: changeResults
  })

  // FINAL SUMMARY
  logger.section('FINAL SUMMARY')

  console.log(`
📊 Test Results Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 State Pipeline Test:     ${handlerResults.length} handler calls
🔹 Debounce Test:          ${debounceResults.length} handler calls  
🔹 Schema Pipeline Test:    ${schemaResults.length} handler calls
🔹 Throttle Pipeline Test:  ${throttleResults.length} handler calls
🔹 Change Detection Test:   ${changeResults.length} handler calls

Total Handler Executions: ${
    handlerResults.length +
    debounceResults.length +
    schemaResults.length +
    throttleResults.length +
    changeResults.length
  }

Expected Results:
- State Pipeline: 1 (only valid condition)
- Debounce: 1 (last call after delay)  
- Schema Pipeline: 1 (only valid schema + condition)
- Throttle Pipeline: 2 (first + third calls)
- Change Detection: 2 (first + different counter)

📝 Key Observations:
- Selector functions should extract specific data
- Condition functions should receive selected data
- Transform functions should receive condition-passed data
- Final handlers should receive transformed data
- Debounce should delay execution until window closes
- Throttle should block rapid successive calls
- Change detection should compare selected values, not full payloads

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  // Get system metrics for final analysis
  const metrics = cyre.getMetricsReport()
  console.log('\n🔍 System Metrics:')
  console.log(`   Total Calls: ${metrics.global.totalCalls}`)
  console.log(`   Total Executions: ${metrics.global.totalExecutions}`)
  console.log(`   Total Errors: ${metrics.global.totalErrors}`)
  console.log(`   Call Rate: ${metrics.global.callRate}/sec`)
  console.log(`   Events Logged: ${metrics.events}`)

  console.log('\n✅ Detailed logging test completed!')
}

// Export for running
export default runDetailedLoggingTest

runDetailedLoggingTest().catch(console.error)
