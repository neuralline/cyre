// demo/schema-composition-demo.ts
// validation-pipeline-demo.ts already covers the PIPELINE side of schema
// (schema as one talent among required/condition/selector/transform/
// detectChanges, and why their field order matters). This file stays out of
// that territory and goes deep on the schema BUILDER itself
// (src/schema/cyre-schema.ts) - the composition primitives none of the
// other demos touch: array(), union() + literal() (a lightweight
// discriminated-union pattern), enums(), the nullable-vs-optional
// distinction, refine() + schema-level transform() + pipe() chained
// together, and all() (validate a value against several independent
// schemas at once). Each one is wired into a real cyre.action/.on/.call
// round trip, not just called standalone - the point is confirming schema
// composition actually works the way cyre.action consumes it, not just that
// the builder functions type-check.
import {cyre, log} from '../src'
import {schema} from '../src/schema/cyre-schema'

await cyre.init()

// =============================================================================
// 0) REGISTER EVERY CHANNEL THIS DEMO USES  →  all up front, so lock() below
//    genuinely covers "every registration is done" before any call happens.
// =============================================================================
console.log(
  '\n=== registering channels for each schema-composition scenario ==='
)

// 1) array() of object() - a cart with a list of line items
cyre.action({
  id: 'cart/checkout',
  schema: schema.object({
    items: schema.array(
      schema.object({
        sku: schema.string().minLength(1),
        qty: schema.number().int().positive()
      })
    ),
    status: schema.enums('pending', 'paid', 'shipped')
  })
})
cyre.on('cart/checkout', (order: any) => {
  const total = order.items.reduce((sum: number, i: any) => sum + i.qty, 0)
  log.debug(
    `  🛒 checkout: ${order.items.length} line item(s), ${total} unit(s) total, status=${order.status}`
  )
  return {itemCount: order.items.length, totalUnits: total}
})

// 2) union() + literal() - a lightweight discriminated union: a shape is
//    EITHER a circle OR a square, and which fields are valid depends on
//    which literal `type` tag is present.
const circleSchema = schema.object({
  type: schema.literal('circle'),
  radius: schema.number().positive()
})
const squareSchema = schema.object({
  type: schema.literal('square'),
  side: schema.number().positive()
})
cyre.action({
  id: 'shape/area',
  schema: schema.union(circleSchema, squareSchema)
})
cyre.on('shape/area', (shape: any) => {
  const area =
    shape.type === 'circle' ? Math.PI * shape.radius ** 2 : shape.side ** 2
  log.debug(`  📐 ${shape.type} area: ${area.toFixed(2)}`)
  return {type: shape.type, area}
})

// 3) nullable() vs optional() - two different "absence" shapes on the same
//    object: `nickname` may be explicitly null (the user has one, chose to
//    clear it), `bio` may be entirely absent (the field was never set).
cyre.action({
  id: 'user/profile',
  schema: schema.object({
    handle: schema.string().minLength(1),
    nickname: schema.string().nullable(),
    bio: schema.string().optional()
  })
})
cyre.on('user/profile', (profile: any) => {
  log.debug(
    `  👤 profile: handle=${profile.handle} nickname=${JSON.stringify(profile.nickname)} bio=${JSON.stringify(profile.bio)}`
  )
  return profile
})

// 4) refine() + schema-level transform() + pipe() - a promo code that must
//    be exactly 6 characters, pass a custom business-rule check (refine),
//    and gets normalized to uppercase (transform) - composed with pipe()
//    rather than hand-chaining `.refine(...).transform(...)`.
const promoCodeSchema = schema.pipe(
  schema.string().len(6),
  s =>
    s.refine(
      (v: string) => /^[A-Za-z0-9]+$/.test(v),
      'promo code must be alphanumeric'
    ),
  s => s.transform((v: string) => v.toUpperCase())
)
cyre.action({
  id: 'discount/code',
  schema: schema.object({code: promoCodeSchema})
})
cyre.on('discount/code', (payload: any) => {
  log.debug(`  🎟️  applying promo code: ${payload.code}`)
  return {applied: payload.code}
})

// 5) all() - validate a payload against several independent schemas at
//    once, all of which must pass (distinct from object()'s single-shape
//    check: here each schema in the list gets the WHOLE value and can
//    enforce an unrelated cross-cutting rule).
const isPositive = schema
  .number()
  .refine((v: number) => v > 0, 'must be positive')
const isBelowCap = schema
  .number()
  .refine((v: number) => v <= 100, 'must not exceed the 100-unit cap')
cyre.action({
  id: 'inventory/adjust',
  schema: schema.all(isPositive, isBelowCap)
})
cyre.on('inventory/adjust', (units: number) => {
  log.debug(`  📦 inventory adjusted by +${units} units`)
  return {adjustedBy: units}
})

// Every channel this demo will ever call is registered by this point -
// lock() here, before any of the calls below, is what actually prevents a
// stray late registration or a duplicate handler from slipping in
// unnoticed while the rest of the script runs.
cyre.lock()

// =============================================================================
// 1) ARRAY VALIDATION  →  a malformed line item anywhere in the array should
//    block the whole call, with an error that names its index
// =============================================================================
console.log('\n=== 1) array() of object(): cart checkout ===')

const goodOrder = await cyre.call('cart/checkout', {
  status: 'pending',
  items: [
    {sku: 'widget-1', qty: 2},
    {sku: 'widget-2', qty: 1}
  ]
})
console.log(`  valid cart -> ok:${goodOrder.ok} - ${goodOrder.message}`)

const badOrder = await cyre.call('cart/checkout', {
  status: 'pending',
  items: [
    {sku: 'widget-1', qty: 2},
    {sku: '', qty: -1} // both fields invalid on this one line item
  ]
})
console.log(
  `  cart with a bad line item -> ok:${badOrder.ok} - ${badOrder.message}`
)
console.log(
  goodOrder.ok && !badOrder.ok && badOrder.message.includes('[1]')
    ? '✅ array validation passed the good cart and rejected the bad one, naming the offending index'
    : '❌ array validation did not behave as expected'
)

// =============================================================================
// 2) UNION + LITERAL  →  each variant only accepts ITS OWN shape; a payload
//    that matches neither variant should be rejected, not silently coerced
// =============================================================================
console.log('\n=== 2) union() + literal(): circle vs square ===')

const circleResult = await cyre.call('shape/area', {type: 'circle', radius: 3})
console.log(
  `  circle(radius=3) -> ok:${circleResult.ok}, area=${circleResult.payload?.area?.toFixed(2)}`
)

const squareResult = await cyre.call('shape/area', {type: 'square', side: 4})
console.log(
  `  square(side=4) -> ok:${squareResult.ok}, area=${squareResult.payload?.area?.toFixed(2)}`
)

const neitherResult = await cyre.call('shape/area', {
  type: 'triangle',
  base: 3,
  height: 4
})
console.log(
  `  triangle (matches neither variant) -> ok:${neitherResult.ok} - ${neitherResult.message}`
)

console.log(
  circleResult.ok && squareResult.ok && !neitherResult.ok
    ? '✅ both real variants validated correctly, an unrecognized variant was rejected'
    : '❌ union/literal discrimination did not behave as expected'
)

// =============================================================================
// 3) NULLABLE vs OPTIONAL  →  null and undefined are NOT interchangeable
//    once a field is declared one way or the other
// =============================================================================
console.log('\n=== 3) nullable() vs optional(): user profile ===')

const explicitNull = await cyre.call('user/profile', {
  handle: 'ada',
  nickname: null
})
console.log(
  `  nickname explicitly null, bio omitted -> ok:${explicitNull.ok} - ${explicitNull.message}`
)

const nicknameOmitted = await cyre.call('user/profile', {handle: 'ada'})
console.log(
  `  nickname omitted entirely (should fail - nullable() ≠ optional()) -> ok:${nicknameOmitted.ok} - ${nicknameOmitted.message}`
)

const bioNull = await cyre.call('user/profile', {
  handle: 'ada',
  nickname: 'Ada',
  bio: null
})
console.log(
  `  bio explicitly null (should fail - optional() ≠ nullable()) -> ok:${bioNull.ok} - ${bioNull.message}`
)

console.log(
  explicitNull.ok && !nicknameOmitted.ok && !bioNull.ok
    ? '✅ nullable() accepted null but not missing; optional() accepted missing but not null - genuinely different'
    : 'ℹ️  nullable()/optional() did not draw a hard line between null and undefined the way the API implies'
)

// =============================================================================
// 4) REFINE + TRANSFORM + PIPE  →  a business-rule check (refine) composed
//    with a normalization step (transform), chained via pipe() rather than
//    hand-written dot-chaining
// =============================================================================
console.log('\n=== 4) pipe(len -> refine -> transform): promo code ===')

const validCode = await cyre.call('discount/code', {code: 'save10'})
console.log(
  `  "save10" -> ok:${validCode.ok}, applied as: ${validCode.payload?.applied}`
)

const wrongLength = await cyre.call('discount/code', {code: 'short'})
console.log(
  `  "short" (5 chars, needs exactly 6) -> ok:${wrongLength.ok} - ${wrongLength.message}`
)

const notAlphanumeric = await cyre.call('discount/code', {code: 'sa-v10'})
console.log(
  `  "sa-v10" (fails the refine check) -> ok:${notAlphanumeric.ok} - ${notAlphanumeric.message}`
)

console.log(
  validCode.ok &&
    validCode.payload?.applied === 'SAVE10' &&
    !wrongLength.ok &&
    !notAlphanumeric.ok
    ? '✅ pipe() correctly chained length -> refine -> transform, uppercasing only the valid code'
    : '❌ pipe()-composed schema did not behave as expected'
)

// =============================================================================
// 5) all()  →  a value must satisfy every schema in the list, not just one
// =============================================================================
console.log(
  '\n=== 5) all(): inventory adjustment must be positive AND ≤100 ==='
)

const withinRange = await cyre.call('inventory/adjust', 40)
console.log(`  +40 -> ok:${withinRange.ok}`)

const negative = await cyre.call('inventory/adjust', -5)
console.log(
  `  -5 (fails the "positive" schema) -> ok:${negative.ok} - ${negative.message}`
)

const overCap = await cyre.call('inventory/adjust', 250)
console.log(
  `  +250 (fails the "≤100 cap" schema) -> ok:${overCap.ok} - ${overCap.message}`
)

console.log(
  withinRange.ok && !negative.ok && !overCap.ok
    ? '✅ all() correctly required both independent schemas to pass'
    : '❌ all() did not enforce every schema in the list'
)

// No recurring/scheduled channels were created in this demo, so there's
// nothing left running that a shutdown would cut off mid-flight - safe to
// end the process here rather than leaving it hanging around.
cyre.shutdown()
