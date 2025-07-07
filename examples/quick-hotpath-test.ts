// examples/quick-hotpath-test.ts
// Quick performance test for cyre hotpath

import cyre from '../src/index'

const quickTest = async () => {
  await cyre.init()

  cyre.action({id: 'test'})
  cyre.on('test', (payload: any) => payload)

  // Warm up
  for (let i = 0; i < 100; i++) {
    await cyre.call('test', i)
  }

  // Quick benchmark
  const iterations = 10000
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    await cyre.call('test', i)
  }

  const end = performance.now()
  const totalTime = end - start
  const opsPerSec = (iterations / totalTime) * 1000

  console.log(
    `🔥 CYRE HOTPATH: ${Math.round(opsPerSec).toLocaleString()} ops/sec`
  )
  console.log(
    `Time: ${totalTime.toFixed(2)}ms for ${iterations.toLocaleString()} calls`
  )
  console.log(`Avg: ${(totalTime / iterations).toFixed(6)}ms per call`)

  // Direct comparison
  const handler = (payload: any) => payload
  const directStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    handler(i)
  }
  const directEnd = performance.now()
  const directOpsPerSec = (iterations / (directEnd - directStart)) * 1000

  const overhead = ((directOpsPerSec - opsPerSec) / directOpsPerSec) * 100
  console.log(`Direct: ${Math.round(directOpsPerSec).toLocaleString()} ops/sec`)
  console.log(`Overhead: ${overhead.toFixed(1)}%`)

  // Assessment
  console.log('\n143k ops/sec assessment:')
  if (opsPerSec >= 143000) {
    console.log('✅ GOOD: At or above 143k ops/sec')
  } else {
    console.log('⚠️  BELOW: Below 143k ops/sec')
  }
}

quickTest().catch(console.error)
