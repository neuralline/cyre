// demo/validation-pipeline-demo.ts
// Cyre's processing pipeline: schema, required, condition, selector, transform
// and detectChanges. These are "talents" attached directly on an action config
// - compileAction pre-compiles them into an ordered pipeline (in the same
// order the fields appear on the object) and executePipeline runs them
// before the payload ever reaches a .on handler. A talent that fails BLOCKS
// the call - the handler simply never runs, no try/catch needed downstream.
import {cyre, log} from '../src'
import {schema} from '../src/schema/cyre-schema'

await cyre.init()

// =============================================================================
// 1) SIGNUP VALIDATION  →  schema → transform → condition
//
// Field order on the action IS pipeline order: validate shape first, THEN
// normalize the data, THEN gate on business logic. Doing it in any other
// order would mean testing age against un-normalized data, or normalizing
// data that never should have reached this channel in the first place.
// =============================================================================
console.log('\n=== 1) signup: schema -> transform -> condition ===')
{
  cyre.action({
    id: 'user-signup://',
    schema: schema.object({
      name: schema.string().minLength(2),
      email: schema.string().email(),
      age: schema.number().int().positive()
    }),
    transform: (payload: any) => ({
      ...payload,
      email: payload.email.toLowerCase(),
      signedUpAt: Date.now()
    }),
    condition: (payload: any) => payload.age >= 18
  })

  cyre.on('user-signup://', (payload: any) => {
    log.debug(`  ✓ account created for ${payload.email} (age ${payload.age})`)
    return {accountId: crypto.randomUUID().slice(0, 8)}
  })

  const attempts = [
    {
      label: 'valid adult',
      payload: {name: 'Ada', email: 'ADA@Example.com', age: 34}
    },
    {
      label: 'minor (condition should block)',
      payload: {name: 'Ben', email: 'ben@example.com', age: 15}
    },
    {
      label: 'malformed (schema should block)',
      payload: {name: 'C', email: 'not-an-email', age: 22}
    }
  ]

  for (const {label, payload} of attempts) {
    const result = await cyre.call('user-signup://', payload)
    console.log(`  [${label}] ok=${result.ok} - ${result.message}`)
  }
}

// =============================================================================
// 2) NOISY TELEMETRY  →  selector → detectChanges
//
// A gateway forwards its FULL sensor frame on every tick (timestamp, battery,
// signal strength, ...) even when the reading we actually care about hasn't
// moved. selector narrows the payload down to just what matters BEFORE
// detectChanges compares it - so a battery-percentage wiggle or a fresh
// timestamp doesn't cause a false "changed" on every single tick.
// =============================================================================
console.log('\n=== 2) telemetry: selector -> detectChanges ===')
{
  let dispatched = 0

  cyre.action({
    id: 'gateway-telemetry://',
    selector: (payload: any) => ({
      temp: payload.sensor.temp,
      humidity: payload.sensor.humidity
    }),
    detectChanges: true
  })

  cyre.on('gateway-telemetry://', (reading: any) => {
    dispatched++
    log.debug(
      `  📡 dispatch #${dispatched}: temp=${reading.temp} humidity=${reading.humidity}`
    )
  })

  const frames = [
    {sensor: {temp: 21.5, humidity: 40}, battery: 91, ts: 1},
    {sensor: {temp: 21.5, humidity: 40}, battery: 90, ts: 2}, // only battery/ts moved
    {sensor: {temp: 21.5, humidity: 40}, battery: 88, ts: 3}, // still unchanged
    {sensor: {temp: 22.1, humidity: 40}, battery: 87, ts: 4}, // real change
    {sensor: {temp: 22.1, humidity: 39}, battery: 85, ts: 5} // real change
  ]

  for (const frame of frames) {
    await cyre.call('gateway-telemetry://', frame)
  }

  console.log(
    dispatched === 3
      ? `✅ ${frames.length} raw frames in, only ${dispatched} real changes dispatched`
      : `❌ expected 3 dispatches out of ${frames.length} frames, got ${dispatched}`
  )
}

// =============================================================================
// 3) PAYMENT WEBHOOK  →  required → schema → condition → transform
//
// An external webhook: reject empty bodies outright, validate shape, gate on
// business rules (positive amount), and only then normalize the data for the
// handler. Four independent failure reasons, each caught by the layer built
// for it - nothing leaks past required's "was there even a body" check into
// schema's "is it shaped correctly" check.
// =============================================================================
console.log(
  '\n=== 3) payment webhook: required -> schema -> condition -> transform ==='
)
{
  cyre.action({
    id: 'payment-webhook://',
    required: true,
    schema: schema.object({
      orderId: schema.string(),
      amount: schema.number(),
      currency: schema.string().len(3)
    }),
    condition: (payload: any) => payload.amount > 0,
    transform: (payload: any) => ({
      ...payload,
      amountCents: Math.round(payload.amount * 100),
      receivedAt: Date.now()
    })
  })

  cyre.on('payment-webhook://', (payload: any) => {
    log.debug(
      `  💳 charged ${payload.amountCents}¢ ${payload.currency} for order ${payload.orderId}`
    )
    return {charged: true}
  })

  const attempts = [
    {label: 'empty body (required should block)', payload: undefined},
    {
      label: 'missing currency (schema should block)',
      payload: {orderId: 'ord-1', amount: 20}
    },
    {
      label: 'negative amount (condition should block)',
      payload: {orderId: 'ord-2', amount: -5, currency: 'USD'}
    },
    {
      label: 'valid payment',
      payload: {orderId: 'ord-3', amount: 19.99, currency: 'USD'}
    }
  ]

  for (const {label, payload} of attempts) {
    const result = await cyre.call('payment-webhook://', payload)
    console.log(`  [${label}] ok=${result.ok} - ${result.message}`)
  }
}

cyre.lock()
console.log('\ndone.')
