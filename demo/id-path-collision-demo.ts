// demo/id-path-collision-demo.ts
// `id` and `path` are two separate fields on IO, but nothing stops a caller
// from typing '/' straight into `id` instead of using `path` (or a branch).
// The registration flow analysed in this session's earlier conversation
// (cyre-actions.ts / compile-pipeline.ts / data-definitions.ts / path-engine.ts)
// indexes channels for pathPlugin.find/on/bulkCall ONLY off the `path` field -
// never off `id`, and `id`'s own validator (data-definitions.ts) only checks
// "non-empty string", with zero character restrictions. useBranch is the one
// place that DOES reject a slash - but only in the branch's own `id`, not in
// anything a plain cyre.action() call can be handed directly.
//
// This demo answers four concrete questions:
//   1) Does a manually slash-typed `id` (no `path` field) get indexed by the
//      path system, or does it just sit there looking hierarchical?
//   2) Is `id` validated as strictly as `path` is, for the same malformed
//      string (leading/trailing slash, double slash)?
//   3) If a manually-typed `id` happens to collide with a branch's own
//      generated global id (`${branchPath}/${localId}`), what actually
//      happens - silent overwrite, error, or something stranger?
//   4) Can you dodge useBranch's slash-rejection by typing the slash into a
//      branch's `id` some other way?
//
// Every check below self-reports what actually happened against whatever
// build you run it on - read the ✅/❌/ℹ️ lines to get the real answer rather
// than trusting this comment block.
import {cyre, log, useBranch} from '../src'
import {pathPlugin} from '../src/schema/path-plugin'
import {pathEngine} from '../src/schema/path-engine'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) MANUAL SLASH IN `id`, NO `path` FIELD  →  does the path index pick it up?
// =============================================================================
console.log('\n=== 1) id with slashes, no path field ===')

const slashId = 'manual/slash/channel'
const reg1 = cyre.action({id: slashId})
cyre.on(slashId, (payload: any) => payload)
console.log(
  `  cyre.action({id: "${slashId}"}) -> ok:${reg1.ok}, message: ${reg1.message}`
)

const indexedPath = pathEngine.getPath(slashId)
console.log(
  `  pathEngine.getPath("${slashId}") -> ${JSON.stringify(indexedPath)}`
)

const wildcardFind = pathPlugin.find('manual/*/channel')
console.log(
  `  pathPlugin.find("manual/*/channel") -> ${wildcardFind.length} match(es)`
)

const directCall1 = await cyre.call(slashId, {via: 'exact-id'})
console.log(`  cyre.call("${slashId}", ...) -> ok:${directCall1.ok}`)

if (indexedPath === undefined && wildcardFind.length === 0 && directCall1.ok) {
  console.log(
    '✅ a slash typed into `id` is purely cosmetic to the path system: no `path` field ' +
      'means no index entry and no wildcard discoverability, even though the id LOOKS ' +
      'hierarchical. Exact cyre.call()/cyre.get() by the literal id string still works ' +
      "fine, because io's store is just a flat Map keyed by whatever string `id` is."
  )
} else {
  console.log(
    `❌ unexpected: indexedPath=${JSON.stringify(indexedPath)}, ` +
      `wildcardMatches=${wildcardFind.length}, directCall.ok=${directCall1.ok}`
  )
}

// =============================================================================
// 2) SAME MALFORMED STRING, TWO FIELDS  →  is `id` validated as strictly as
//    `path` is? (leading slash / trailing slash / double slash)
// =============================================================================
console.log('\n=== 2) id vs path: same malformed strings, different rules? ===')

const malformed = ['/leading-slash', 'trailing-slash/', 'double//slash']

for (const bad of malformed) {
  const asPath = cyre.action({
    id: `path-test-${malformed.indexOf(bad)}`,
    path: bad
  })
  const asId = cyre.action({id: bad})
  console.log(
    `  "${bad}"  as path -> ok:${asPath.ok}${asPath.ok ? '' : ` (${asPath.message})`}` +
      `   |   as id -> ok:${asId.ok}${asId.ok ? '' : ` (${asId.message})`}`
  )
}

console.log(
  'ℹ️  if every "as path" row says ok:false and every "as id" row says ok:true, that\'s ' +
    "the asymmetry: data-definitions.ts's `path` validator runs the string through a " +
    'hierarchical-format regex, but its `id` validator only checks "non-empty string" - ' +
    'nothing stops `/leading-slash` or `a//b` from becoming a channel id outright.'
)

// =============================================================================
// 3) BRANCH COLLISION  →  a branch builds its global id as `${path}/${localId}`.
//    If a caller later types that exact same string into a plain cyre.action()
//    `id` (no `path`), does it collide with the branch's channel?
// =============================================================================
console.log('\n=== 3) branch id collision via a manually-typed id ===')

const appBranch = useBranch(cyre, {id: 'app'})
if (!appBranch) {
  console.log('❌ could not create the "app" branch - aborting section 3')
} else {
  const branchReg = appBranch.action({id: 'users'})
  let branchHandlerHits = 0
  appBranch.on('users', (payload: any) => {
    branchHandlerHits++
    return payload
  })
  console.log(
    `  appBranch.action({id: "users"}) -> ok:${branchReg.ok}, global id: "app/users"`
  )

  const beforeCollision = {
    indexedPath: pathEngine.getPath('app/users'),
    findMatch: pathPlugin.find('app/*').map(m => m.id),
    branchChannelCount: undefined as number | undefined
  }
  console.log(
    `  BEFORE collision: pathEngine.getPath("app/users")=${JSON.stringify(beforeCollision.indexedPath)}, ` +
      `pathPlugin.find("app/*")=${JSON.stringify(beforeCollision.findMatch)}`
  )

  await appBranch.call('users', {n: 1})
  await wait(10)
  console.log(
    `  branch handler hit count after 1 legitimate call: ${branchHandlerHits}`
  )

  // The collision: someone bypasses the branch and registers the SAME global
  // id directly, with no `path` field at all - e.g. copy-pasted from a log
  // line, or hand-typed instead of going through appBranch.action().
  const collisionReg = cyre.action({id: 'app/users'})
  console.log(
    `  cyre.action({id: "app/users"}) [no path, bypassing the branch] -> ok:${collisionReg.ok}`
  )

  const afterCollision = {
    indexedPath: pathEngine.getPath('app/users'),
    findMatch: pathPlugin.find('app/*').map(m => m.id)
  }
  console.log(
    `  AFTER collision: pathEngine.getPath("app/users")=${JSON.stringify(afterCollision.indexedPath)}, ` +
      `pathPlugin.find("app/*")=${JSON.stringify(afterCollision.findMatch)}`
  )

  // Does the ORIGINAL branch handler still fire, even though the channel's
  // compiled config underneath it was just silently replaced?
  await appBranch.call('users', {n: 2})
  await wait(10)
  console.log(
    `  branch handler hit count after the collision + 1 more appBranch.call: ${branchHandlerHits}`
  )

  const branchStatsAfter = appBranch.getStats()

  if (
    beforeCollision.indexedPath === 'app' &&
    afterCollision.indexedPath === undefined
  ) {
    console.log(
      "✅ confirmed: the second registration (no `path`) silently overwrote the branch's " +
        'channel entry in the flat io store (same `id` key = same slot either way), AND ' +
        'wiped its path-index entry - pathEngine.remove(id) runs unconditionally on every ' +
        'registration, and nothing re-added it since the new registration had no `path`. ' +
        `pathPlugin.find("app/*") no longer sees "app/users" at all.`
    )
  } else {
    console.log(
      `ℹ️  index state didn't change the way expected - before:${JSON.stringify(beforeCollision.indexedPath)}, ` +
        `after:${JSON.stringify(afterCollision.indexedPath)}`
    )
  }

  if (branchHandlerHits === 2) {
    console.log(
      '⚠️  the ORIGINAL branch handler still fired after the collision - subscribers are ' +
        "keyed separately from the channel's compiled IO config, so re-registering the " +
        'same id (even with a completely different/absent `path`) does not touch or clear ' +
        'the existing subscriber. The handler is now running against a channel object that ' +
        'lost its path, its branch linkage (`_branchId`), and any protections/pipeline the ' +
        'branch originally gave it - a real split-brain between "what appBranch.getStats() ' +
        `still counts" (channelCount stayed at ${branchStatsAfter.channelCount}) and what\'s ` +
        'actually registered under that id.'
    )
  } else {
    console.log(
      `ℹ️  branch handler hit count was ${branchHandlerHits}, not the expected 2`
    )
  }
}

// =============================================================================
// 4) useBranch's OWN slash rejection  →  confirm the one place in the code
//    that actually blocks a slash in an id-like field still holds.
// =============================================================================
console.log('\n=== 4) useBranch rejects a slash in its own id ===')

const badBranch = useBranch(cyre, {id: 'bad/branch'})
console.log(
  `  useBranch(cyre, {id: "bad/branch"}) -> ${badBranch === false ? 'false (rejected)' : 'created (unexpected)'}`
)

console.log(
  badBranch === false
    ? '✅ useBranch does reject a slash in its OWN `id` (use-branch.ts validation 3) - the ' +
        "protection just doesn't extend to a plain cyre.action() id, which is the gap " +
        'sections 1-3 above walk through.'
    : '❌ useBranch let a slash through where its own source says it should not'
)

// =============================================================================
// 5) SUMMARY
// =============================================================================
console.log('\n=== 5) summary ===')
console.log(`  path stats: ${JSON.stringify(pathPlugin.stats())}`)

// No recurring/scheduled channels were created in this demo, so there's
// nothing left running that a shutdown would cut off mid-flight - safe to
// end the process here rather than leaving it hanging around. All
// registration for this demo happens above this line.
cyre.lock()
cyre.shutdown()
