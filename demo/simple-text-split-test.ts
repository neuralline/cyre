// demo/simple-text-split-test.ts
// Simple test to verify text.split fix

import {cyre} from '../src'

async function testTextSplitFix() {
  console.log('🧪 Testing text.split fix...')

  await cyre.init()

  let formatResult: any = null

  cyre.on('screenplay-format', (text: any) => {
    console.log('📝 Format handler called with:', {
      textType: typeof text,
      textValue: text
    })

    // Ensure text is a string
    const textString = typeof text === 'string' ? text : String(text || '')

    const formatted = textString
      .split('\n')
      .map(line => {
        const trimmed = line.trim()
        if (trimmed.match(/^(INT\.|EXT\.)/i)) {
          return trimmed.toUpperCase()
        }
        if (trimmed.match(/^[A-Z][A-Z\s]+$/)) {
          return trimmed.toUpperCase()
        }
        return trimmed
      })
      .join('\n')

    formatResult = {
      original: textString.length,
      formatted: formatted.length,
      timestamp: Date.now()
    }

    console.log('✅ Format result:', formatResult)

    return {
      ok: true,
      payload: formatted,
      message: 'Text formatted successfully'
    }
  })

  cyre.action({id: 'screenplay-format', debounce: 100})

  // Test with realistic screenplay content
  const testContent = `INT. COFFEE SHOP - DAY

ALICE sits at a corner table, typing frantically.

ALICE
This Cyre system better work or I'm switching to Redux.`

  console.log('📤 Calling format with test content...')
  const formatCall = await cyre.call('screenplay-format', testContent)

  // Wait for debounce to complete
  await new Promise(resolve => setTimeout(resolve, 150))

  console.log('📊 Results:')
  console.log('- Format call success:', formatCall?.ok)
  console.log('- Format result exists:', !!formatResult)
  console.log('- Original length:', formatResult?.original)
  console.log('- Formatted length:', formatResult?.formatted)

  const success = formatCall?.ok && formatResult && formatResult.original > 0
  console.log('🎯 Test result:', success ? '✅ PASSED' : '❌ FAILED')

  return success
}

testTextSplitFix().catch(console.error)
