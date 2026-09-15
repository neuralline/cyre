// demo/collective-intelligence-demo.ts
// useCollective (src/hooks/use-collective.ts) is a full, exported feature -
// join/leave, broadcast, shared state with conflict resolution, proposal/
// vote/consensus decision-making, work distribution across participants,
// and health/metrics - that none of the other demos in this project touch
// (they're all single-participant: one caller, one or more channels). This
// file exercises it end to end against a small "project-planning" collective
// of three participants.
//
// A structural note on where lock() goes here, since this demo is different
// from the others: useCollective.join(participantId) calls cyre.action/
// cyre.on internally to give each participant its own channel - that's real
// registration, gated by lock() exactly like a plain cyre.action() call. So
// unlike a demo with a fixed channel list, "all registration is done" for
// this file means "every participant who's going to join, has joined" -
// section 1 does all of that up front, and lock() engages right after it,
// before any of the collective operations (broadcast/vote/distribute/etc.)
// that follow. leave()/kickParticipant() call cyre.forget(), which isn't
// gated by lock() at all, so those are safe to run after lock() same as
// anywhere else in the project's demos.
import {cyre, useCollective, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) FORM THE COLLECTIVE  →  create + join (this is the registration phase -
//    each join() below registers that participant's own channel)
// =============================================================================
console.log(
  '\n=== 1) forming "project-planning" and joining 3 participants ==='
)

const planning = useCollective('project-planning', {
  type: 'collaboration',
  consensus: 'majority',
  conflictResolution: 'merge',
  notifications: 'all'
})

const joinResults: Record<string, boolean> = {}
for (const {id, role, weight} of [
  {id: 'alice', role: 'admin', weight: 2},
  {id: 'bob', role: 'member', weight: 1},
  {id: 'charlie', role: 'member', weight: 1}
]) {
  const result = await planning.join(id, role, {weight})
  joinResults[id] = result.success
  console.log(`  ${id} (${role}, weight ${weight}) joined -> ${result.success}`)
}

console.log(
  Object.values(joinResults).every(Boolean)
    ? '✅ all 3 participants joined, each with their own registered channel'
    : `❌ one or more joins failed: ${JSON.stringify(joinResults)}`
)

// Every channel this demo will ever register (the collective's own
// coordination channel, plus one per participant) exists by this point -
// lock() here, before any of the operations below, is what actually
// prevents a stray late registration or duplicate handler from slipping in
// while the rest of the script runs.
cyre.lock()

// =============================================================================
// 2) BROADCAST  →  one message, fanned out to every current participant's
//    own channel (this is what join() above wired up)
// =============================================================================
console.log('\n=== 2) broadcast to all participants ===')

const broadcastResult = await planning.broadcast({
  type: 'kickoff',
  text: 'Sprint planning starts now'
})
console.log(
  `  sent to ${broadcastResult.data?.sent}, delivered to ${broadcastResult.data?.delivered}`
)
console.log(
  broadcastResult.success && broadcastResult.data?.delivered === 3
    ? '✅ broadcast reached all 3 participant channels'
    : `❌ expected delivery to all 3, got ${JSON.stringify(broadcastResult.data)}`
)

// =============================================================================
// 3) SHARED STATE + CONFLICT RESOLUTION  →  conflictResolution: 'merge' means
//    writing to an existing key merges objects instead of clobbering them
// =============================================================================
console.log('\n=== 3) shared state: merge conflict resolution ===')

await planning.updateSharedState('sprint', {
  name: 'Sprint 12',
  status: 'planning'
})
const merged = await planning.updateSharedState('sprint', {
  status: 'active',
  owner: 'alice'
})
const finalSprint = planning.getSharedState('sprint')
console.log(`  sprint after merge: ${JSON.stringify(finalSprint)}`)
console.log(
  finalSprint.name === 'Sprint 12' &&
    finalSprint.status === 'active' &&
    finalSprint.owner === 'alice'
    ? '✅ second write merged into the first instead of replacing it'
    : `❌ merge conflict resolution did not behave as expected: ${JSON.stringify(finalSprint)}`
)

// =============================================================================
// 4) PROPOSAL → VOTE → CONSENSUS  →  majority consensus needs > half the
//    participants' votes to agree once quorum (default 50%) is reached
// =============================================================================
console.log('\n=== 4) proposal, voting, majority consensus ===')

const proposeResult = await planning.propose(
  {type: 'scope-change', text: 'Add dark mode to this sprint'},
  {timeout: 5000}
)
const proposalId = proposeResult.data.proposalId
console.log(`  proposal ${proposalId} created and broadcast`)

await planning.vote(proposalId, 'yes', 'alice')
await planning.vote(proposalId, 'yes', 'bob')
await planning.vote(proposalId, 'no', 'charlie')

const consensusResult = await planning.getConsensus(proposalId)
console.log(`  consensus: ${JSON.stringify(consensusResult.consensus)}`)
console.log(
  consensusResult.consensus?.achieved &&
    consensusResult.consensus.result === 'yes'
    ? '✅ majority (2 of 3) reached consensus on "yes"'
    : `❌ expected a "yes" majority, got ${JSON.stringify(consensusResult.consensus)}`
)

// =============================================================================
// 5) WORK DISTRIBUTION  →  spread a list of tasks across active participants
//    and notify each one's own channel of its assignment
// =============================================================================
console.log(
  '\n=== 5) distributing 5 tasks across 3 participants (auto/load-based) ==='
)

const tasks = [
  'design-mockups',
  'api-schema',
  'dark-mode-css',
  'unit-tests',
  'docs'
]
const distribution = await planning.distributeWork(tasks)
console.log(
  `  assignments: ${JSON.stringify(distribution.distribution?.assigned)}`
)

const assignedCounts = Object.values(
  distribution.distribution?.assigned ?? {}
).map((t: any) => t.length)
const totalAssigned = assignedCounts.reduce((a, b) => a + b, 0)
console.log(
  distribution.success && totalAssigned === tasks.length
    ? `✅ all ${tasks.length} tasks were assigned across ${assignedCounts.length} participants`
    : `❌ expected ${tasks.length} tasks assigned, got ${totalAssigned}`
)

// =============================================================================
// 6) HEALTH + METRICS
// =============================================================================
console.log('\n=== 6) health + metrics snapshot ===')

const metrics = planning.getMetrics()
const health = planning.getHealth()
console.log(`  metrics: ${JSON.stringify(metrics)}`)
console.log(`  health: ${JSON.stringify(health)}`)
console.log(
  metrics.participants === 3 && health.status === 'healthy'
    ? '✅ metrics/health both reflect an active, healthy 3-participant collective'
    : `❌ unexpected metrics/health: ${JSON.stringify({metrics, health})}`
)

// =============================================================================
// 7) LIFECYCLE  →  a participant leaving (deregisters their channel via
//    cyre.forget - no lock() involvement), then a pause/resume window
// =============================================================================
console.log('\n=== 7) charlie leaves, then a pause/resume window ===')

const leaveResult = await planning.leave('charlie')
console.log(
  `  charlie left -> ${leaveResult.success}, remaining: ${JSON.stringify(leaveResult.participants)}`
)

await planning.pause()
console.log(`  collective status while paused: ${planning.getState().status}`)
await planning.resume()
console.log(`  collective status after resume: ${planning.getState().status}`)

console.log(
  !leaveResult.participants?.includes('charlie') &&
    planning.getState().status === 'active'
    ? '✅ leave() removed charlie, pause/resume round-tripped back to active'
    : '❌ lifecycle operations did not behave as expected'
)

// =============================================================================
// 8) TEARDOWN  →  destroy() forgets the collective's own coordination
//    channel and clears its registry entry. It's worth noting what it does
//    NOT do: remaining participants' individual channels (alice, bob) are
//    only cleaned up by their own leave() - destroy() doesn't cascade to
//    them the way branches-demo.ts's branch.destroy() cascades to its
//    channels. This demo calls leave() for them explicitly first so nothing
//    is left dangling.
// =============================================================================
console.log('\n=== 8) teardown ===')

await planning.leave('alice')
await planning.leave('bob')
const destroyResult = await planning.destroy()
console.log(`  destroy() -> ${destroyResult.success}`)

const postDestroyCall = await cyre.call('collective://project-planning', {
  operation: 'heartbeat'
})
console.log(
  `  calling the collective channel after destroy -> ok:${postDestroyCall.ok} (${postDestroyCall.message})`
)
console.log(
  destroyResult.success && !postDestroyCall.ok
    ? '✅ the collective channel is gone after destroy(), matching a normal cyre.forget() teardown'
    : '❌ the collective channel unexpectedly survived destroy()'
)

// No recurring/scheduled channels were created in this demo (propose()'s
// internal setTimeout auto-resolve was pre-empted by section 4 calling
// getConsensus() manually, and every participant/collective channel was
// torn down in sections 7-8) - safe to end the process here.
cyre.shutdown()
