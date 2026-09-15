// demo/branches-demo.ts
// Branches give every part of an app its own isolated channel namespace,
// without hand-prefixing every id yourself. useBranch(instance, {id}) hangs
// a new branch off an instance's path - channels registered ON that branch
// get a globally-unique id (parentPath/branchId/localId) automatically, but
// you keep addressing them by their short local id from inside the branch.
// This is the shape a multi-tenant / multi-site system actually has: many
// physically identical channel sets ("temperature", "alarm") that must never
// collide with each other.
//
// Note on verifying this stuff: cyre.get(id) returns that channel's last
// PAYLOAD (it's payloadState.get under the hood), not its config - so it's
// not the right tool for "does this channel exist" or "what's its full id".
// The demo below verifies isolation by calling the fully-qualified id
// directly through the root cyre instance and checking which handler fires,
// and verifies teardown by attempting a real call and checking ok/message -
// the same signal any real caller would see.
import {cyre, useBranch, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) BUILD THE HIERARCHY  →  one factory, two floors, each with its own sensors
//
// factory-a/floor-1/temperature and factory-a/floor-2/temperature are
// completely distinct channels even though both branches register a
// "temperature" action with the exact same local id.
// =============================================================================
console.log('\n=== 1) hierarchy: factory-a > floor-1 / floor-2 ===')

const factory = useBranch(cyre, {id: 'factory-a'})
if (!factory) throw new Error('failed to create factory branch')

const floor1 = useBranch(factory, {id: 'floor-1'})
const floor2 = useBranch(factory, {id: 'floor-2'})
if (!floor1 || !floor2) throw new Error('failed to create floor branches')

console.log(`  factory path: "${factory.path()}"`)
console.log(`  floor-1 path: "${floor1.path()}"`)
console.log(`  floor-2 path: "${floor2.path()}"`)

let floor1Reading: number | undefined
let floor2Reading: number | undefined

floor1.action({id: 'temperature', required: true})
floor1.on('temperature', (celsius: number) => {
  floor1Reading = celsius
  log.debug(`  🌡️  [floor-1] temperature -> ${celsius}°C`)
})

floor2.action({id: 'temperature', required: true})
floor2.on('temperature', (celsius: number) => {
  floor2Reading = celsius
  log.debug(`  🌡️  [floor-2] temperature -> ${celsius}°C`)
})

floor2.action({id: 'alarm'})
floor2.on('alarm', (reason: string) => {
  log.debug(`  🚨 [floor-2] ALARM: ${reason}`)
})

// Same local id "temperature" on both floors - calling by local id from
// INSIDE each branch resolves to that branch's own global channel, never
// the other one's.
await floor1.call('temperature', 21.4)
await floor2.call('temperature', 26.8)

// Prove the isolation directly: build each branch's fully-qualified id
// ourselves (path + "/" + localId, the same rule useBranch uses internally)
// and call it straight through the ROOT cyre instance, bypassing the branch
// helper entirely. If isolation is real, only the matching floor's handler
// should react.
const globalIdFloor1 = `${floor1.path()}/temperature`
const globalIdFloor2 = `${floor2.path()}/temperature`
console.log(`  floor-1's "temperature" global id: ${globalIdFloor1}`)
console.log(`  floor-2's "temperature" global id: ${globalIdFloor2}`)

await cyre.call(globalIdFloor1, 99.9)
console.log(
  floor1Reading === 99.9 && floor2Reading === 26.8
    ? "✅ calling floor-1's global id only reached floor-1's handler"
    : '❌ a call meant for floor-1 leaked into floor-2 (or vice versa)'
)

// =============================================================================
// 2) CROSS-BRANCH COMMUNICATION  →  absolute path from one branch to another
//
// branch.call() checks whether the target already contains a "/" - if it
// does, it's treated as an absolute path instead of being prefixed with the
// calling branch's own path. That's how floor-1 can reach floor-2's alarm
// without floor-2 needing to expose anything special.
// =============================================================================
console.log("\n=== 2) cross-branch call: floor-1 triggers floor-2's alarm ===")
await floor1.call('factory-a/floor-2/alarm', 'smoke detected on floor 2')
await wait(20)

// =============================================================================
// 3) A THIRD SITE, SAME SHAPE  →  branches scale by just... adding another one
// =============================================================================
console.log('\n=== 3) a whole second factory, zero risk of id clashes ===')

const factoryB = useBranch(cyre, {id: 'factory-b'})
if (!factoryB) throw new Error('failed to create factory-b branch')
const factoryBFloor1 = useBranch(factoryB, {id: 'floor-1'}) // same local id "floor-1" as factory-a's!
if (!factoryBFloor1)
  throw new Error('failed to create factory-b/floor-1 branch')

factoryBFloor1.action({id: 'temperature', required: true})
factoryBFloor1.on('temperature', (celsius: number) => {
  log.debug(`  🌡️  [factory-b/floor-1] temperature -> ${celsius}°C`)
})
await factoryBFloor1.call('temperature', 18.2)

console.log(`  factory-a/floor-1 path: "${floor1.path()}"`)
console.log(`  factory-b/floor-1 path: "${factoryBFloor1.path()}"`)
console.log(
  floor1.path() !== factoryBFloor1.path()
    ? '✅ two factories can both have a "floor-1" without ever colliding'
    : '❌ branch paths collided across factories'
)

// =============================================================================
// 4) CASCADING TEARDOWN  →  destroy a branch, everything under it goes with it
//
// destroy() removes every channel registered on this branch (and, per the
// implementation, any descendant branches already tracked in the global
// branch store) - useful for "tenant left" / "site decommissioned" cleanup
// without having to remember every channel id that was ever created there.
// We confirm removal the same way any real caller would notice it: calling
// the channel afterward and getting "channel does not exist" back.
// =============================================================================
console.log('\n=== 4) decommissioning floor-2 ===')

const alarmGlobalId = `${floor2.path()}/alarm`
const beforeDestroy = await cyre.call(alarmGlobalId, 'pre-teardown check')
console.log(`  floor-2 alarm callable before destroy: ${beforeDestroy.ok}`)

floor2.destroy()
await wait(50) // destroy() kicks off async cleanup and returns immediately

const afterDestroy = await cyre.call(alarmGlobalId, 'post-teardown check')
console.log(
  `  floor-2 alarm callable after destroy: ${afterDestroy.ok} (${afterDestroy.message})`
)
console.log(
  beforeDestroy.ok && !afterDestroy.ok
    ? "✅ floor-2's channel is gone after destroy()"
    : "❌ floor-2's channel survived destroy()"
)

// floor-1 (a sibling branch) and factory-b should be completely unaffected
const floor1StillWorks = await floor1.call('temperature', 21.9)
console.log(
  floor1StillWorks.ok
    ? "✅ sibling branch (floor-1) is untouched by floor-2's teardown"
    : '❌ destroying floor-2 unexpectedly broke floor-1'
)

cyre.lock()
console.log('\ndone.')
