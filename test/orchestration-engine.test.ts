// test/orchestration-engine.test.ts
// Vitest coverage for cyre.orchestration (src/orchestration/orchestration-engine.ts).
// Mirrors what demo/orchestration-scheduling-demo.ts and
// demo/orchestration-incident-response-demo.ts already exercise manually and
// turns it into real assertions vitest can run in CI, plus one case
// (lock() rejecting orchestration.keep()) that no demo has covered yet -
// see claude/cyre-codebase-analysis.md Update 9, which flagged that gate as
// implemented but never independently confirmed against a live run.
//
// Registration convention follows this project's own demo rule (Update 3 in
// the analysis doc): every cyre.action/cyre.on/orchestration.keep() call
// happens in beforeAll, before cyre.lock() - activate()/deactivate()/call()/
// forget() are unaffected by lock() and are what the individual tests use.
//
// cyre.shutdown() is never called here - it calls process.exit(0), which
// would kill the vitest worker. Teardown instead deactivates + forgets every
// orchestration this file registered.
import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {cyre} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('cyre.orchestration', () => {
  let heartbeatCount = 0
  let opsCount = 0

  beforeAll(async () => {
    await cyre.init()

    // --- plain channels the orchestrations below target -------------------
    cyre.action({id: 'log/event'})
    cyre.on('log/event', () => {
      heartbeatCount++
      return {ok: true}
    })

    cyre.action({id: 'notify/ops'})
    cyre.on('notify/ops', () => {
      opsCount++
      return {ok: true}
    })

    cyre.action({id: 'rollback/db', delay: 30})
    cyre.on('rollback/db', () => ({ok: true, done: 'db'}))

    cyre.action({id: 'rollback/cache', delay: 30})
    cyre.on('rollback/cache', () => ({ok: true, done: 'cache'}))

    // --- orchestrations -----------------------------------------------------

    // 1) time trigger - real TimeKeeper-backed recurring schedule
    cyre.orchestration.keep({
      id: 'time-trigger-test',
      triggers: [{name: 'tick', type: 'time', interval: 100}],
      workflow: [{name: 'log', type: 'action', targets: 'log/event'}]
    })

    // 2) multi-step workflow: action -> parallel -> sequential -> loop
    // Note: 'parallel'/'sequential'/'loop' step types all read their
    // sub-work from `step.steps` (an array of WorkflowStep), NOT
    // `step.targets` - `targets` is only consulted for `type: 'action'`.
    // Confirmed directly against executeWorkflowSteps's switch in
    // orchestration-engine.ts rather than assumed.
    // `iterations` on the loop step below is now configurable (Update 13 -
    // previously hardcoded to 3 with no way to override it).
    cyre.orchestration.keep({
      id: 'workflow-test',
      triggers: [],
      workflow: [
        {
          name: 'notify-parallel',
          type: 'parallel',
          steps: [
            {name: 'notify-a', type: 'action', targets: 'notify/ops'},
            {name: 'notify-b', type: 'action', targets: 'notify/ops'}
          ]
        },
        {
          name: 'rollback-sequential',
          type: 'sequential',
          steps: [
            {name: 'rollback-db', type: 'action', targets: 'rollback/db'},
            {name: 'rollback-cache', type: 'action', targets: 'rollback/cache'}
          ]
        },
        {
          name: 'retry-loop',
          type: 'loop',
          iterations: 2,
          steps: [{name: 'log-in-loop', type: 'action', targets: 'log/event'}]
        }
      ]
    })

    // 2b) loop step with no `iterations` set at all - confirms the fix
    // stays backward compatible: omitting it still runs 3 times, the old
    // hardcoded default, rather than 0 or throwing.
    cyre.orchestration.keep({
      id: 'loop-default-test',
      triggers: [],
      workflow: [
        {
          name: 'default-loop',
          type: 'loop',
          steps: [{name: 'log-in-loop', type: 'action', targets: 'log/event'}]
        }
      ]
    })

    // 3) failing condition step with onError: 'abort'
    cyre.orchestration.keep({
      id: 'abort-test',
      triggers: [],
      workflow: [
        {
          name: 'always-false',
          type: 'condition',
          condition: () => false,
          onError: 'abort'
        },
        {name: 'never-runs', type: 'action', targets: 'log/event'}
      ]
    })

    // 4) actions-only execution path (config.actions, not config.workflow)
    cyre.orchestration.keep({
      id: 'actions-list-test',
      triggers: [],
      actions: [{action: 'broadcast', targets: ['notify/ops', 'log/event']}]
    })

    // 5) channel trigger - fires when the watched channel is called directly
    cyre.orchestration.keep({
      id: 'channel-trigger-test',
      triggers: [{name: 'on-ops', type: 'channel', channels: 'notify/ops'}],
      workflow: [{name: 'log', type: 'action', targets: 'log/event'}]
    })

    // 6) condition trigger - polls on its own via TimeKeeper
    cyre.orchestration.keep({
      id: 'condition-trigger-test',
      triggers: [
        {name: 'poll', type: 'condition', condition: () => true, interval: 100}
      ],
      workflow: [{name: 'log', type: 'action', targets: 'log/event'}]
    })

    // 7) registered here (pre-lock) so the forget() teardown test doesn't
    // need to call keep() itself - keep() is locked out once cyre.lock()
    // runs below, same as every other registration in this file.
    cyre.orchestration.keep({
      id: 'forget-me',
      triggers: [],
      workflow: [{name: 'noop', type: 'action', targets: 'log/event'}]
    })

    cyre.lock()
  })

  afterAll(() => {
    ;[
      'time-trigger-test',
      'workflow-test',
      'loop-default-test',
      'abort-test',
      'actions-list-test',
      'channel-trigger-test',
      'condition-trigger-test',
      'forget-me'
    ].forEach(id => {
      cyre.orchestration.activate(id, false)
      cyre.orchestration.forget(id)
    })
  })

  it('rejects orchestration.keep() once the system is locked', () => {
    // Confirms the Update 9 fix: keep() now calls metricsState.canRegister()
    // the same way cyre.action()/cyre.on() do, so cyre.lock() actually
    // covers orchestration registration. This was implemented but never
    // independently verified against a live run until this test.
    const result = cyre.orchestration.keep({
      id: 'should-be-rejected',
      triggers: [],
      workflow: [{name: 'noop', type: 'action', targets: 'log/event'}]
    })
    expect(result.ok).toBe(false)
    expect(cyre.orchestration.get('should-be-rejected')).toBeUndefined()
  })

  it('a time trigger fires repeatedly while active and stops on deactivate', async () => {
    const before = heartbeatCount
    const activation = cyre.orchestration.activate('time-trigger-test', true)
    expect(activation.ok).toBe(true)

    await wait(350)
    const whileActive = heartbeatCount
    expect(whileActive).toBeGreaterThan(before)

    cyre.orchestration.activate('time-trigger-test', false)
    await wait(150)
    expect(heartbeatCount).toBe(whileActive)
  })

  it('runs a parallel -> sequential -> loop workflow to completion via call()', async () => {
    const opsBefore = opsCount
    const heartbeatBefore = heartbeatCount
    const result = await cyre.orchestration.call('workflow-test')
    expect(result.ok).toBe(true)

    // parallel step fanned out to both notify/ops sub-steps
    expect(opsCount).toBe(opsBefore + 2)

    // loop step's iteration count is now configurable (see analysis doc
    // Update 13) - this workflow's loop step sets `iterations: 2`, so only
    // the loop step touching log/event should add exactly 2, not the old
    // hardcoded 3.
    expect(heartbeatCount).toBe(heartbeatBefore + 2)

    const status = cyre.orchestration.getStatus('workflow-test')
    expect(status?.executionCount).toBeGreaterThan(0)
  })

  it('a loop step with no `iterations` set falls back to 3, the old hardcoded default', async () => {
    const heartbeatBefore = heartbeatCount
    const result = await cyre.orchestration.call('loop-default-test')
    expect(result.ok).toBe(true)
    expect(heartbeatCount).toBe(heartbeatBefore + 3)
  })

  it('runs sequential sub-steps in true completion order, not just call order', async () => {
    const start = Date.now()
    const result = await cyre.orchestration.call('workflow-test')
    const elapsed = Date.now() - start
    expect(result.ok).toBe(true)
    // rollback/db and rollback/cache each carry delay: 30 and run
    // sequentially - the Update 10 fix makes the workflow wait out each
    // target's own scheduled delay before moving on, so two genuine
    // back-to-back 30ms waits (plus the parallel/loop steps) should take
    // meaningfully longer than the ~1ms it took before that fix.
    expect(elapsed).toBeGreaterThanOrEqual(55)
  })

  it('aborts the workflow before a later step runs when a condition fails with onError: abort', async () => {
    const before = heartbeatCount
    const result = await cyre.orchestration.call('abort-test')
    expect(result.ok).toBe(false)
    // the 'never-runs' action step must not have executed
    expect(heartbeatCount).toBe(before)
  })

  it('fans a single actions-list entry out to multiple targets', async () => {
    const opsBefore = opsCount
    const heartbeatBefore = heartbeatCount
    const result = await cyre.orchestration.call('actions-list-test')
    expect(result.ok).toBe(true)
    expect(opsCount).toBe(opsBefore + 1)
    expect(heartbeatCount).toBe(heartbeatBefore + 1)
  })

  it('a channel trigger fires exactly once per direct call and stops after deactivate', async () => {
    cyre.orchestration.activate('channel-trigger-test', true)
    const status = cyre.orchestration.getStatus('channel-trigger-test')
    // channel triggers subscribe directly - no TimeKeeper timer involved
    expect(status?.timeKeeperInfo.timerCount).toBe(0)

    const before = heartbeatCount
    await cyre.call('notify/ops', {})
    await wait(50)
    expect(heartbeatCount).toBe(before + 1)

    cyre.orchestration.activate('channel-trigger-test', false)
    await cyre.call('notify/ops', {})
    await wait(50)
    expect(heartbeatCount).toBe(before + 1)
  })

  it('a condition trigger polls on its own and stops after deactivate', async () => {
    cyre.orchestration.activate('condition-trigger-test', true)
    const status = cyre.orchestration.getStatus('condition-trigger-test')
    expect(status?.timeKeeperInfo.timerCount).toBe(1)

    const before = heartbeatCount
    await wait(250)
    expect(heartbeatCount).toBeGreaterThan(before)

    cyre.orchestration.activate('condition-trigger-test', false)
    const afterDeactivate = heartbeatCount
    await wait(250)
    expect(heartbeatCount).toBe(afterDeactivate)
  })

  it('forget() tears an orchestration down completely', () => {
    // registered in beforeAll (pre-lock) - see comment there
    expect(cyre.orchestration.get('forget-me')).toBeDefined()

    const forgotten = cyre.orchestration.forget('forget-me')
    expect(forgotten).toBe(true)
    expect(cyre.orchestration.get('forget-me')).toBeUndefined()
    expect(
      cyre.orchestration
        .list()
        .find(
          (runtime: {config: {id: string}}) => runtime.config.id === 'forget-me'
        )
    ).toBeUndefined()

    // forgetting again reports false rather than throwing
    expect(cyre.orchestration.forget('forget-me')).toBe(false)
  })
})
