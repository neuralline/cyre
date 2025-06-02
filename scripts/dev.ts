// scripts/dev.ts
// Development scripts for Cyre using Bun

import {watch} from 'fs'
import {spawn} from 'bun'

/*

      C.Y.R.E - D.E.V - S.C.R.I.P.T.S
      
      Development workflow automation:
      - File watching
      - Auto-rebuild
      - Test runner
      - Type checking
      - Performance monitoring

*/

interface DevOptions {
  test?: boolean
  types?: boolean
  build?: boolean
  benchmark?: boolean
}

const runCommand = async (cmd: string[], description: string) => {
  console.log(`🔄 ${description}...`)

  const proc = spawn(cmd, {
    stdout: 'pipe',
    stderr: 'pipe'
  })

  const exitCode = await proc.exited

  if (exitCode === 0) {
    console.log(`✅ ${description} completed`)
  } else {
    const error = await new Response(proc.stderr).text()
    console.error(`❌ ${description} failed:`, error)
  }

  return exitCode === 0
}

const watchFiles = (pattern: string, callback: () => void) => {
  const watcher = watch('./src', {recursive: true}, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
      console.log(`📁 File changed: ${filename}`)
      callback()
    }
  })

  return watcher
}

const developmentMode = async (options: DevOptions) => {
  console.log('🚀 Starting Cyre development mode...')

  let building = false

  const rebuild = async () => {
    if (building) return
    building = true

    try {
      if (options.types) {
        await runCommand(['bun', 'run', 'typecheck'], 'Type checking')
      }

      if (options.build) {
        await runCommand(['bun', 'run', 'build'], 'Building')
      }

      if (options.test) {
        await runCommand(['bun', 'test'], 'Running tests')
      }

      if (options.benchmark) {
        await runCommand(['bun', 'run', 'benchmark'], 'Running benchmarks')
      }
    } finally {
      building = false
    }
  }

  // Initial build
  await rebuild()

  // Watch for changes
  const watcher = watchFiles('src/**/*.ts', rebuild)

  console.log('👀 Watching for changes... (Press Ctrl+C to exit)')

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development mode...')
    watcher.close()
    process.exit(0)
  })
}

const testMode = async () => {
  console.log('🧪 Starting test watch mode...')

  const proc = spawn(['bun', 'test', '--watch'], {
    stdout: 'inherit',
    stderr: 'inherit'
  })

  await proc.exited
}

const typeCheckMode = async () => {
  console.log('🔍 Starting type check mode...')

  let checking = false

  const typeCheck = async () => {
    if (checking) return
    checking = true

    try {
      await runCommand(['bun', 'run', 'typecheck'], 'Type checking')
    } finally {
      checking = false
    }
  }

  // Initial check
  await typeCheck()

  // Watch for changes
  const watcher = watchFiles('src/**/*.ts', typeCheck)

  console.log('👀 Watching for type changes... (Press Ctrl+C to exit)')

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down type check mode...')
    watcher.close()
    process.exit(0)
  })
}

const benchmarkMode = async () => {
  console.log('📊 Running performance benchmarks...')

  const success = await runCommand(
    ['bun', 'run', 'example/industry-standard-tests.ts'],
    'Benchmarking'
  )

  if (success) {
    console.log('📈 Benchmark completed successfully')
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'dev':
      await developmentMode({
        build: true,
        types: true,
        test: false
      })
      break

    case 'dev:full':
      await developmentMode({
        build: true,
        types: true,
        test: true,
        benchmark: false
      })
      break

    case 'test':
      await testMode()
      break

    case 'types':
      await typeCheckMode()
      break

    case 'benchmark':
      await benchmarkMode()
      break

    default:
      console.log(`
🔧 Cyre Development Scripts

Usage: bun run scripts/dev.ts <command>

Commands:
  dev       - Watch and rebuild on changes
  dev:full  - Watch, rebuild, and test on changes  
  test      - Watch and run tests on changes
  types     - Watch and type-check on changes
  benchmark - Run performance benchmarks

Examples:
  bun run scripts/dev.ts dev
  bun run scripts/dev.ts test
  bun run scripts/dev.ts benchmark
      `)
      break
  }
}

if (import.meta.main) {
  main()
}
