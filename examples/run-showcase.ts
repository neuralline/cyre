// run-showcase.ts
// Simple runner for the system orchestration showcase

import runShowcase, {manualTests} from './system-orchestration-showcase'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    // Run full showcase
    await runShowcase()
  } else {
    // Run specific test
    const testName = args[0]

    switch (testName) {
      case 'stress':
        await manualTests.stressTest()
        break
      case 'memory':
        await manualTests.memoryTest()
        break
      case 'control':
        await manualTests.controlTest()
        break
      case 'performance':
        await manualTests.performanceReport()
        break
      default:
        console.log('Available tests: stress, memory, control, performance')
        console.log('Or run without arguments for full showcase')
    }
  }
}

main().catch(console.error)

// Package.json scripts you could add:
/*
{
  "scripts": {
    "showcase": "ts-node run-showcase.ts",
    "showcase:stress": "ts-node run-showcase.ts stress",
    "showcase:memory": "ts-node run-showcase.ts memory",
    "showcase:control": "ts-node run-showcase.ts control",
    "showcase:performance": "ts-node run-showcase.ts performance"
  }
}
*/
