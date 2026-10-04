// demo/cyre-init-userconfig-demo.ts
// Exercises cyre.init(userConfig) - the user-tunable breathing/timing config
// added on top of metricsState (see src/types/system.ts's CyreConfig/
// CyreUserConfig, src/context/metrics-state.ts's mergeConfig()/init(), and
// src/components/cyre-timekeeper.ts's quartzMaxPoll()). Before this change,
// breathing rates/stress thresholds/system limits and TimeKeeper's Quartz
// poll ceiling were hardcoded BREATHING/TIMING constants in
// config/cyre-config.ts - now they're defaults that a deployment can
// override per-instance via cyre.init({...}), without touching source.
//
// metricsState is imported directly here ONLY to read back `config` for
// verification - cyre.init(userConfig) itself is the only call a real
// consumer needs; the rest of this file is just proving the override
// actually took effect end-to-end, the same way claude/calendar-scheduling-
// demo.ts reaches into TimeKeeper/cyre-calendar.ts directly for its checks.
import {cyre, log} from '../src'
import {metricsState} from '../src/context/metrics-state'

// =============================================================================
// 0) DEFAULTS BEFORE INIT  →  metricsState seeds `config` from
//    config/cyre-config.ts's defaultConfig at module load, so the shipped
//    defaults are readable even before cyre.init() ever runs.
// =============================================================================
console.log('\n=== 0) shipped defaults, before cyre.init() ===')

const before = metricsState.get().config
console.log('  breathing.stress:', before.breathing.stress)
console.log('  breathing.limits:', before.breathing.limits)
console.log('  timing.recuperation:', before.timing.recuperation)

// =============================================================================
// 1) cyre.init(userConfig)  →  the actual feature. Every field is optional
//    and deep-partial (CyreUserConfig) - only what you pass overrides the
//    default, everything else stays as shipped. Two fields below are
//    deliberately OUT of range (limits.maxCpu, timing.recuperation) to show
//    that a malformed override is clamped + warned on rather than silently
//    corrupting the breathing/timing math or throwing and aborting init.
// =============================================================================
console.log('\n=== 1) cyre.init(userConfig) ===')

const result = await cyre.init({
  breathing: {
    rates: {min: 100, base: 300, max: 2000, recovery: 3000},
    stress: {low: 0.4, medium: 0.6, high: 0.8, critical: 0.97},
    limits: {
      maxCpu: 150, // out of range [1, 100] - will be clamped to 100
      maxMemory: 90,
      maxEventLoop: 100,
      maxCallRate: 5000
    }
  },
  timing: {
    recuperation: 50 // below the 100ms floor - will be clamped to 100
  }
})

console.log(`  cyre.init() -> ok:${result.ok} - ${result.message}`)

// =============================================================================
// 2) CONFIG AFTER INIT  →  valid overrides applied as given; out-of-range
//    ones clamped to the nearest bound instead of accepted verbatim; every
//    field NOT mentioned in userConfig (e.g. rates.recovery was set, but
//    breathing.rates itself only had 4 sub-fields - here it's fully
//    specified, so nothing falls back) still reflects the merge correctly.
// =============================================================================
console.log('\n=== 2) config after init ===')

const after = metricsState.get().config
console.log('  breathing.stress:', after.breathing.stress)
console.log('  breathing.limits:', after.breathing.limits)
console.log('  timing.recuperation:', after.timing.recuperation)

console.log(
  after.breathing.stress.high === 0.8 && after.breathing.stress.critical === 0.97
    ? '✅ valid breathing.stress overrides applied exactly as given'
    : '❌ breathing.stress overrides did not apply as expected'
)
console.log(
  after.breathing.limits.maxCpu === 100
    ? '✅ out-of-range breathing.limits.maxCpu (150) was clamped to the 100 ceiling, not accepted or thrown on'
    : `❌ expected maxCpu clamped to 100, got ${after.breathing.limits.maxCpu}`
)
console.log(
  after.timing.recuperation === 100
    ? '✅ out-of-range timing.recuperation (50) was clamped to the 100ms floor'
    : `❌ expected recuperation clamped to 100, got ${after.timing.recuperation}`
)

// =============================================================================
// 3) LIVE EFFECT  →  getBreathingStats() (and isHealthy()/shouldAllowCall())
//    now read state.config.breathing.* instead of the old static BREATHING
//    constant, so the overridden thresholds show up immediately in anything
//    that reports on breathing/stress - no restart, no re-reading a file.
// =============================================================================
console.log('\n=== 3) overridden config reflected in getBreathingStats() ===')

const stats = metricsState.getBreathingStats()
console.log('  stressThresholds:', stats.stressThresholds)
console.log('  rateRange:', stats.rateRange)

console.log(
  stats.stressThresholds.high === 0.8 && stats.rateRange.base === 300
    ? '✅ getBreathingStats() reports the user-configured thresholds/rates, not the shipped BREATHING defaults'
    : '❌ getBreathingStats() did not pick up the overridden config'
)

// =============================================================================
// 4) NORMAL USAGE  →  everything past this point is completely unaware that
//    config was customized - cyre.action()/cyre.on()/cyre.call() work exactly
//    as they would with defaults, which is the point: userConfig tunes the
//    engine's own adaptive behavior, not the public channel API.
// =============================================================================
console.log('\n=== 4) normal channel usage, unaffected by the config override ===')

cyre.action({id: 'demo/greet'})
cyre.on('demo/greet', (name: string) => {
  log.debug(`  👋 hello, ${name}!`)
  return {greeted: name}
})

const callResult = await cyre.call('demo/greet', 'userConfig')
console.log(
  callResult.ok
    ? '✅ channel call succeeded normally alongside a customized config'
    : `❌ unexpected call failure: ${callResult.message}`
)

// =============================================================================
// 5) TEARDOWN
// =============================================================================
console.log('\n=== 5) teardown ===')
cyre.shutdown()
