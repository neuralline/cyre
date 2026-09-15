// demo/buffer-window-demo.ts
// Cargo Bay Buffer Demo — exercises Cyre's channel-level `buffer` protection
// (cyre.action({buffer: {window, strategy, maxSize}})) against every
// documented strategy, plus the couple of gaps between the README and the
// real implementation. Each section prints what the handler actually
// received so the behavior is confirmed empirically, not assumed.
//
// Scenario: barcode scanners on a loading dock report packages as they roll
// past. Buffer collapses a burst of scans into one manifest instead of
// firing a handler per scan.

import {cyre} from 'cyre'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// bufferState.get() currently returns its internal {payload, timestamp}
// wrapper instead of the raw buffered value, and that leaks straight into
// whatever the buffered handler receives. Unwrap defensively so this demo
// runs correctly whether or not that's been patched in your checkout.
function unwrapBuffered<T>(value: any): T {
  if (
    value &&
    typeof value === 'object' &&
    'payload' in value &&
    'timestamp' in value
  ) {
    return value.payload as T
  }
  return value as T
}

interface ScanEvent {
  packageId: string
  bay: number
}

async function main() {
  await cyre.init()

  console.log('📦 CARGO BAY BUFFER DEMO\n')

  // ─────────────────────────────────────────────────────────────
  // 1. Default strategy: 'overwrite' — only the last call in the
  //    window survives; earlier calls in the same window are discarded.
  // ─────────────────────────────────────────────────────────────
  console.log('1️⃣  overwrite (default) — last scan in the window wins\n')

  cyre.action({id: 'bay-scan-overwrite', buffer: {window: 400}})

  cyre.on('bay-scan-overwrite', raw => {
    const scan = unwrapBuffered<ScanEvent>(raw)
    console.log('   ⤷ handler received:', scan)
    return scan
  })

  cyre.call('bay-scan-overwrite', {packageId: 'PKG-001', bay: 1})
  cyre.call('bay-scan-overwrite', {packageId: 'PKG-002', bay: 1})
  cyre.call('bay-scan-overwrite', {packageId: 'PKG-003', bay: 1})
  console.log(
    '   fired 3 scans back-to-back, expecting only PKG-003 to reach the handler'
  )
  await sleep(500)

  // ─────────────────────────────────────────────────────────────
  // 2. 'append' strategy — calls accumulate into an array over the
  //    window and are delivered together.
  // ─────────────────────────────────────────────────────────────
  console.log('\n2️⃣  append — batch scans into one manifest\n')

  cyre.action({
    id: 'bay-scan-append',
    buffer: {window: 500, strategy: 'append'}
  })

  cyre.on('bay-scan-append', raw => {
    const batch = unwrapBuffered<ScanEvent | ScanEvent[]>(raw)
    console.log('   ⤷ handler received:', batch)
    console.log('   ⤷ Array.isArray:', Array.isArray(batch))
    return batch
  })

  cyre.call('bay-scan-append', {packageId: 'PKG-101', bay: 2})
  cyre.call('bay-scan-append', {packageId: 'PKG-102', bay: 2})
  cyre.call('bay-scan-append', {packageId: 'PKG-103', bay: 2})
  cyre.call('bay-scan-append', {packageId: 'PKG-104', bay: 2})
  console.log('   fired 4 scans, expecting an array of 4 packages')
  await sleep(600)

  // Known gotcha: a lone call in an 'append' window is NOT wrapped in an
  // array — the handler gets the bare payload instead of a 1-item array.
  console.log('\n   Known gotcha: exactly one scan in an append window...')
  cyre.action({
    id: 'bay-scan-append-single',
    buffer: {window: 300, strategy: 'append'}
  })
  cyre.on('bay-scan-append-single', raw => {
    const batch = unwrapBuffered<ScanEvent | ScanEvent[]>(raw)
    console.log(
      '   ⤷ handler received:',
      batch,
      '| Array.isArray:',
      Array.isArray(batch)
    )
  })
  cyre.call('bay-scan-append-single', {packageId: 'PKG-201', bay: 3})
  console.log('   → do not assume `batch` is always an array; check first')
  await sleep(400)

  // ─────────────────────────────────────────────────────────────
  // 3. 'ignore' strategy — documented to keep the first call and drop
  //    the rest; confirm what it actually does.
  // ─────────────────────────────────────────────────────────────
  console.log(
    '\n3️⃣  ignore — documented to keep the first call, drop the rest\n'
  )

  cyre.action({
    id: 'bay-scan-ignore',
    buffer: {window: 400, strategy: 'ignore'}
  })

  cyre.on('bay-scan-ignore', raw => {
    const scan = unwrapBuffered<ScanEvent>(raw)
    console.log('   ⤷ handler received:', scan)
    return scan
  })

  cyre.call('bay-scan-ignore', {packageId: 'PKG-301', bay: 4})
  cyre.call('bay-scan-ignore', {packageId: 'PKG-302', bay: 4})
  cyre.call('bay-scan-ignore', {packageId: 'PKG-303', bay: 4})
  console.log(
    '   fired 3 scans — if "ignore" worked as documented, expect PKG-301'
  )
  console.log(
    '   (there is no ignore branch in the current implementation, so this' +
      ' falls through to overwrite behavior — expect PKG-303, not PKG-301)'
  )
  await sleep(500)

  // ─────────────────────────────────────────────────────────────
  // 4. maxSize — documented as a cap on batch size; confirm whether
  //    it's actually enforced.
  // ─────────────────────────────────────────────────────────────
  console.log('\n4️⃣  maxSize — configured cap of 3, firing 6 scans\n')

  cyre.action({
    id: 'bay-scan-maxsize',
    buffer: {window: 500, strategy: 'append', maxSize: 3}
  })

  cyre.on('bay-scan-maxsize', raw => {
    const batch = unwrapBuffered<ScanEvent[]>(raw)
    const count = Array.isArray(batch) ? batch.length : 1
    console.log(`   ⤷ handler received ${count} item(s):`, batch)
    console.log(
      `   ⤷ maxSize respected: ${
        count <= 3 ? '✅ yes' : `❌ no — got ${count}, configured maxSize: 3`
      }`
    )
  })

  for (let i = 1; i <= 6; i++) {
    cyre.call('bay-scan-maxsize', {
      packageId: `PKG-4${i.toString().padStart(2, '0')}`,
      bay: 5
    })
  }
  console.log('   fired 6 scans against a buffer configured with maxSize: 3')
  await sleep(600)

  // ─────────────────────────────────────────────────────────────
  // 5. Realistic use — batching a scan burst into one manifest upload
  // ─────────────────────────────────────────────────────────────
  console.log(
    '\n5️⃣  Realistic use — batching a scan burst into one manifest upload\n'
  )

  cyre.action({
    id: 'manifest-upload',
    buffer: {window: 750, strategy: 'append'}
  })

  cyre.on('manifest-upload', raw => {
    const batch = unwrapBuffered<ScanEvent | ScanEvent[]>(raw)
    const items = Array.isArray(batch) ? batch : [batch]
    console.log(`   📤 uploading manifest with ${items.length} package(s):`)
    items.forEach(item =>
      console.log(`      - ${item.packageId} (bay ${item.bay})`)
    )
    return {uploaded: items.length}
  })

  const burst: ScanEvent[] = [
    {packageId: 'PKG-501', bay: 6},
    {packageId: 'PKG-502', bay: 6},
    {packageId: 'PKG-503', bay: 6},
    {packageId: 'PKG-504', bay: 6},
    {packageId: 'PKG-505', bay: 6}
  ]
  burst.forEach((scan, i) => {
    setTimeout(() => cyre.call('manifest-upload', scan), i * 100)
  })
  console.log(
    '   scanning 5 packages over ~500ms, expecting one manifest upload'
  )
  await sleep(900)

  console.log(
    '\n✨ Buffer demo complete. See README.md → "Buffer Usage in cyre.action"' +
      ' for a written summary of these behaviors and known limitations.'
  )

  cyre.shutdown()
}

main().catch(console.error)
