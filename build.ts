// build.ts
// Bun build configuration for Cyre library

import {build} from 'bun'
import {statSync} from 'fs'

/*

      C.Y.R.E - B.U.N - B.U.I.L.D
      
      Zero-dependency build system using Bun:
      - ESM and CJS outputs (single entry point)
      - Type declarations
      - Bundle analysis
      - Performance optimized
      - Fixed: No chunking to prevent duplicate exports

*/

const distDir = './dist'

const buildESM = async () => {
  console.log('🔨 Building ESM...')

  const result = await build({
    entrypoints: ['./src/index.ts'], // ✅ Single entry point only
    outdir: distDir,
    format: 'esm',
    target: 'es2022',
    minify: false,
    splitting: false, // ✅ No splitting to prevent duplicate exports
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
    entrypoints: ['./src/index.ts'], // ✅ Single entry point only
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
    const maxSize = 100 * 1024 // 100kb limit (increased for single bundle)
    if (esmStats.size > maxSize) {
      console.warn(`⚠️  ESM bundle exceeds ${maxSize / 1024}kb limit`)
    }
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error)
  }
}

const main = async () => {
  const startTime = performance.now()

  console.log('🚀 Starting Cyre build (single entry point)...')

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
    console.log('📦 Output: Single bundle (no chunks)')
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

// Run if this file is executed directly
if (import.meta.main) {
  main()
}
