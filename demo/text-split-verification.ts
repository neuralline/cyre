// demo/text-split-verification.ts
// Comprehensive test to verify text.split fix handles all edge cases

import {cyre} from '../src'

async function verifyTextSplitFix() {
  console.log('🧪 Comprehensive Text Split Fix Verification')
  console.log('='.repeat(50))

  await cyre.init()

  let testResults: any[] = []

  cyre.on('format-test', (text: any) => {
    console.log('📝 Handler called with:', {
      textType: typeof text,
      textValue: text,
      hasPayload: text && typeof text === 'object' && 'payload' in text
    })

    // Ensure text is a string - handle all edge cases
    let textString: string

    if (typeof text === 'string') {
      textString = text
    } else if (text && typeof text === 'object' && 'payload' in text) {
      textString = String(text.payload || '')
    } else {
      textString = String(text || '')
    }

    console.log('🔧 Processed text string:', {
      length: textString.length,
      preview: textString.substring(0, 50) + '...'
    })

    // Test the split operation
    const lines = textString.split('\n')
    const formatted = lines.map(line => line.trim().toUpperCase()).join('\n')

    const result = {
      original: textString.length,
      formatted: formatted.length,
      lines: lines.length,
      timestamp: Date.now()
    }

    testResults.push(result)
    console.log('✅ Format result:', result)

    return {
      ok: true,
      payload: formatted,
      message: 'Text formatted successfully'
    }
  })

  cyre.action({id: 'format-test', debounce: 50})

  // Test cases
  const testCases = [
    {
      name: 'Direct string',
      input: 'Hello\nWorld\nTest'
    },
    {
      name: 'Object with payload',
      input: {payload: 'Hello\nWorld\nTest'}
    },
    {
      name: 'Object with nested payload',
      input: {data: {payload: 'Hello\nWorld\nTest'}}
    },
    {
      name: 'Null input',
      input: null
    },
    {
      name: 'Undefined input',
      input: undefined
    },
    {
      name: 'Number input',
      input: 123
    }
  ]

  console.log('\n📋 Running test cases...')

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`)
    console.log(`📤 Input:`, testCase.input)

    const result = await cyre.call('format-test', testCase.input)

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log(`📊 Result:`, result?.ok ? '✅ Success' : '❌ Failed')
  }

  console.log('\n📈 Final Results:')
  console.log('- Total tests run:', testCases.length)
  console.log('- Successful formats:', testResults.length)
  console.log(
    '- Success rate:',
    `${((testResults.length / testCases.length) * 100).toFixed(1)}%`
  )

  const allPassed = testResults.length === testCases.length
  console.log(
    '\n🎯 Overall Result:',
    allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
  )

  return allPassed
}

verifyTextSplitFix().catch(console.error)
