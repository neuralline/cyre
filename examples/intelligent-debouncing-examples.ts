// intelligent-debouncing-examples.ts
// Real-world examples of intelligent, state-reactive debouncing

import {cyre, schema} from '../src/index'
import {
  createIntelligentAction,
  createStateReactiveDebouncing,
  intelligentDebounce
} from '../src/intelligence/smart-debouncing'

async function runIntelligentDebouncingDemo() {
  console.log('🧠 Intelligent Debouncing Demo - Reactive State Management\n')

  await cyre.initialize()

  // Enable global state-reactive optimization
  const stateReactive = createStateReactiveDebouncing()

  // 1. SEARCH INPUT - Adapts to typing speed and system load
  console.log('📝 Setting up intelligent search debouncing...')

  const searchAction = createIntelligentAction({
    id: 'search-input',
    baseDebounce: 300,
    interactionType: 'typing',
    enableIntelligentDebounce: true,
    schema: schema.object({query: schema.string()}),
    successValidator: result =>
      result && result.results && result.results.length > 0
  })

  cyre.action(searchAction.actionConfig)
  cyre.on('search-input', async data => {
    console.log(`🔍 Searching for: "${data.query}"`)

    // Simulate search API call
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200))

    // Simulate success/failure for learning
    const hasResults = Math.random() > 0.3 // 70% success rate
    searchAction.recordSuccess(hasResults)

    return {
      query: data.query,
      results: hasResults ? ['result1', 'result2'] : [],
      timestamp: Date.now()
    }
  })

  // 2. FORM INPUT - Reacts to user interaction patterns
  console.log('📋 Setting up intelligent form debouncing...')

  const formAction = createIntelligentAction({
    id: 'form-validation',
    baseDebounce: 500,
    interactionType: 'form',
    enableIntelligentDebounce: true,
    schema: schema.object({
      field: schema.string(),
      value: schema.string(),
      isValid: schema.boolean().optional()
    })
  })

  cyre.action(formAction.actionConfig)
  cyre.on('form-validation', async data => {
    console.log(`📝 Validating ${data.field}: "${data.value}"`)

    // Simulate validation
    const isValid = data.value.length > 3
    await new Promise(resolve => setTimeout(resolve, 50))

    formAction.recordSuccess(isValid)

    return {
      field: data.field,
      value: data.value,
      isValid,
      errors: isValid ? [] : [`${data.field} must be longer than 3 characters`]
    }
  })

  // 3. SCROLL EVENTS - Adapts to scroll velocity
  console.log('📜 Setting up intelligent scroll debouncing...')

  const scrollAction = createIntelligentAction({
    id: 'scroll-handler',
    baseDebounce: 100,
    interactionType: 'scrolling',
    enableIntelligentDebounce: true,
    schema: schema.object({
      position: schema.number(),
      velocity: schema.number()
    })
  })

  cyre.action(scrollAction.actionConfig)
  cyre.on('scroll-handler', async data => {
    console.log(
      `📜 Scroll position: ${data.position}px (velocity: ${data.velocity})`
    )

    // Simulate UI updates
    await new Promise(resolve => setTimeout(resolve, 10))

    scrollAction.recordSuccess(true) // Scroll is always successful

    return data
  })

  // 4. API CALLS - Reacts to system stress and network conditions
  console.log('🌐 Setting up intelligent API debouncing...')

  const apiAction = createIntelligentAction({
    id: 'api-request',
    baseDebounce: 1000,
    interactionType: 'api',
    enableIntelligentDebounce: true,
    schema: schema.object({endpoint: schema.string(), data: schema.any()})
  })

  cyre.action(apiAction.actionConfig)
  cyre.on('api-request', async data => {
    console.log(`🌐 API call to: ${data.endpoint}`)

    // Simulate API latency and potential failures
    const latency = Math.random() * 500 + 100
    await new Promise(resolve => setTimeout(resolve, latency))

    const success = Math.random() > 0.2 // 80% success rate
    apiAction.recordSuccess(success)

    if (!success) {
      throw new Error('API request failed')
    }

    return {
      endpoint: data.endpoint,
      response: {success: true, data: 'API response'},
      latency
    }
  })

  console.log('\n🎯 Starting intelligent debouncing simulation...\n')

  // Simulation: Different interaction patterns
  const simulateInteractions = async () => {
    const patterns = [
      'fast-typing',
      'slow-typing',
      'burst-clicking',
      'form-filling',
      'heavy-scrolling',
      'api-heavy'
    ]

    for (let cycle = 0; cycle < 30; cycle++) {
      const pattern = patterns[Math.floor(cycle / 5) % patterns.length]

      console.log(`\n🔄 Cycle ${cycle + 1}: ${pattern} pattern`)

      switch (pattern) {
        case 'fast-typing':
          // Simulate fast typing in search
          for (let i = 0; i < 5; i++) {
            await cyre.call('search-input', {query: `search query ${i}`})
            await new Promise(resolve => setTimeout(resolve, 50)) // Fast typing
          }
          break

        case 'slow-typing':
          // Simulate slow, deliberate typing
          for (let i = 0; i < 3; i++) {
            await cyre.call('search-input', {query: `slow search ${i}`})
            await new Promise(resolve => setTimeout(resolve, 800)) // Slow typing
          }
          break

        case 'burst-clicking':
          // Simulate rapid form interactions
          for (let i = 0; i < 7; i++) {
            await cyre.call('form-validation', {
              field: 'username',
              value: `user${i}`
            })
            await new Promise(resolve => setTimeout(resolve, 30)) // Rapid clicking
          }
          break

        case 'form-filling':
          // Simulate normal form filling
          const fields = ['username', 'email', 'password']
          for (const field of fields) {
            await cyre.call('form-validation', {
              field,
              value: `${field}_value`
            })
            await new Promise(resolve => setTimeout(resolve, 400)) // Normal typing
          }
          break

        case 'heavy-scrolling':
          // Simulate scroll events
          for (let i = 0; i < 10; i++) {
            await cyre.call('scroll-handler', {
              position: i * 100,
              velocity: Math.random() * 20
            })
            await new Promise(resolve => setTimeout(resolve, 20)) // Fast scrolling
          }
          break

        case 'api-heavy':
          // Simulate API-heavy usage
          for (let i = 0; i < 3; i++) {
            try {
              await cyre.call('api-request', {
                endpoint: `/api/data/${i}`,
                data: {query: 'heavy load'}
              })
            } catch (error) {
              // Handle API failures
            }
            await new Promise(resolve => setTimeout(resolve, 200))
          }
          break
      }

      // Show pattern learning every 5 cycles
      if ((cycle + 1) % 5 === 0) {
        console.log('\n📊 PATTERN LEARNING REPORT:')

        // Show search pattern info
        const searchInfo = searchAction.getPatternInfo()
        console.log(
          `   🔍 Search: ${searchInfo.pattern?.type} pattern, ${searchInfo.currentOptimal}ms optimal debounce`
        )

        // Show form pattern info
        const formInfo = formAction.getPatternInfo()
        console.log(
          `   📝 Form: ${formInfo.pattern?.type} pattern, ${formInfo.currentOptimal}ms optimal debounce`
        )

        // Show global stats
        const globalStats = stateReactive.getGlobalStats()
        console.log(
          `   📈 Global: ${
            globalStats.totalManagedActions
          } actions, avg ${globalStats.averageDebounce.toFixed(0)}ms debounce`
        )
        console.log(
          `   🧠 System stress: ${(globalStats.systemStress * 100).toFixed(1)}%`
        )

        // Force optimization to see changes
        searchAction.optimize()
        formAction.optimize()
        scrollAction.optimize()
        apiAction.optimize()
      }

      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // Run simulation
  await simulateInteractions()

  console.log('\n🏁 Intelligent Debouncing Demo Complete!\n')

  // Final report
  console.log('🎊 FINAL INTELLIGENT DEBOUNCING REPORT:')

  const finalStats = stateReactive.getGlobalStats()
  console.log(`\n📊 System Performance:`)
  console.log(`   • Managed Actions: ${finalStats.totalManagedActions}`)
  console.log(
    `   • Average Debounce: ${finalStats.averageDebounce.toFixed(0)}ms`
  )
  console.log(
    `   • System Stress: ${(finalStats.systemStress * 100).toFixed(1)}%`
  )
  console.log(`   • Last Optimization: ${finalStats.lastOptimization}`)

  console.log(`\n🧠 Pattern Learning Results:`)

  // Get final pattern info for each action
  const patterns = [
    {name: 'Search', action: searchAction},
    {name: 'Form', action: formAction},
    {name: 'Scroll', action: scrollAction},
    {name: 'API', action: apiAction}
  ]

  patterns.forEach(({name, action}) => {
    const info = action.getPatternInfo()
    if (info.pattern) {
      console.log(
        `   • ${name}: ${info.pattern.type} (${(
          info.pattern.successRate * 100
        ).toFixed(1)}% success) → ${info.currentOptimal}ms`
      )
    }
  })

  console.log(`\n✨ Key Achievements:`)
  console.log(`   ✅ Learned user interaction patterns automatically`)
  console.log(`   ✅ Adapted debouncing to system stress levels`)
  console.log(`   ✅ Optimized based on success/failure feedback`)
  console.log(`   ✅ Reduced unnecessary API calls and processing`)
  console.log(`   ✅ Improved responsiveness during low-stress periods`)

  process.exit(0)
}

runIntelligentDebouncingDemo().catch(console.error)
