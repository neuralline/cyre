// build.ts
// Bun build configuration for Cyre library

import {build} from 'bun'
import {readdirSync, statSync} from 'fs'
import {join} from 'path'

/*

      C.Y.R.E - B.U.N - B.U.I.L.D
      
      Zero-dependency build system using Bun:
      - ESM and CJS outputs
      - Type declarations
      - Tree shaking support
      - Bundle analysis
      - Performance optimized

*/

const srcDir = './src'
const distDir = './dist'

// Get all entry points for modular exports
const getEntryPoints = (dir: string, base = ''): Record<string, string> => {
  const entries: Record<string, string> = {}
  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory() && !item.startsWith('.')) {
      // Check if directory has index.ts
      const indexPath = join(fullPath, 'index.ts')
      try {
        statSync(indexPath)
        const entryName = base ? `${base}/${item}` : item
        entries[entryName] = indexPath
      } catch {
        // No index.ts, recurse into subdirectories
        Object.assign(
          entries,
          getEntryPoints(fullPath, base ? `${base}/${item}` : item)
        )
      }
    }
  }

  return entries
}

const buildESM = async () => {
  console.log('🔨 Building ESM...')

  const entryPoints = {
    index: './src/index.ts',
    ...getEntryPoints(srcDir)
  }

  const result = await build({
    entrypoints: Object.values(entryPoints),
    outdir: distDir,
    format: 'esm',
    target: 'es2022',
    minify: false,
    splitting: true,
    sourcemap: 'external',
    naming: '[name].js',
    external: [] // No external dependencies
  })

  if (!result.success) {
    console.error('❌ ESM build failed')
    process.exit(1)
  }

  console.log('✅ ESM build complete')
}

const buildCJS = async () => {
  console.log('🔨 Building CJS...')

  const result = await build({
    entrypoints: ['./src/index.ts'],
    outfile: './dist/index.cjs',
    format: 'cjs',
    target: 'es2022',
    minify: false,
    sourcemap: 'external',
    external: [] // No external dependencies
  })

  if (!result.success) {
    console.error('❌ CJS build failed')
    process.exit(1)
  }

  console.log('✅ CJS build complete')
}

const buildTypes = async () => {
  console.log('🔨 Building types...')

  const proc = Bun.spawn(['tsc', '--emitDeclarationOnly', '--outDir', 'dist'], {
    stdout: 'pipe',
    stderr: 'pipe'
  })

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const error = await new Response(proc.stderr).text()
    console.error('❌ Type generation failed:', error)
    process.exit(1)
  }

  console.log('✅ Types generated')
}

const analyzeBundles = async () => {
  console.log('📊 Analyzing bundles...')

  try {
    const esmStats = statSync('./dist/index.js')
    const cjsStats = statSync('./dist/index.cjs')

    console.log(`📦 Bundle sizes:`)
    console.log(`   ESM: ${(esmStats.size / 1024).toFixed(2)}kb`)
    console.log(`   CJS: ${(cjsStats.size / 1024).toFixed(2)}kb`)

    // Check if bundle size is within limits
    const maxSize = 50 * 1024 // 50kb
    if (esmStats.size > maxSize) {
      console.warn(`⚠️  ESM bundle exceeds ${maxSize / 1024}kb limit`)
    }
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error)
  }
}

const main = async () => {
  const startTime = performance.now()

  console.log('🚀 Starting Cyre build...')

  try {
    // Clean dist directory
    await Bun.spawn(['rm', '-rf', 'dist']).exited

    // Build in parallel where possible
    await Promise.all([buildTypes(), buildESM()])

    // CJS build after ESM (potential dependency)
    await buildCJS()

    // Analyze results
    await analyzeBundles()

    const endTime = performance.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    console.log(`✨ Build completed in ${duration}s`)
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

// Run if this file is executed directly
if (import.meta.main) {
  main()
}
