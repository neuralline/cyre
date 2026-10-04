// demo/orbital-command.ts
// Satellite ground-control simulation — a single-file, creative tour of Cyre's
// dispatch strategies, protections, scheduling and branch system, running
// against `cyre` as a real npm dependency (see heartbeat.ts for the minimal
// version of this import pattern).

import {cyre, useBranch, useGroup, log} from 'cyre'

/**
 * 🛰️  ORBITAL COMMAND
 *
 * Five satellites, three ground stations, one mission control desk.
 *
 * Cyre features on display:
 *  - useBranch            nested "fleet/SAT-n" namespaces, no ID clashes
 *  - interval + repeat    per-satellite telemetry heartbeats
 *  - buffer               batched telemetry downlink (window + append)
 *  - dispatch: waterfall  4-stage command pipeline, errorStrategy: fail-fast
 *  - throttle             thruster-fire spam protection
 *  - debounce             operator console keystroke collapsing
 *  - detectChanges        sensor gate that skips unchanged readings
 *  - dispatch: race       fastest ground station wins the signal lock
 *  - useGroup             one call, whole-constellation safe-mode broadcast
 *  - explicit chaining    anomaly -> escalate -> notify-operator
 *  - cyre.getMetrics/get  live introspection dashboard
 *  - lock/pause/resume/shutdown
 *
 * Note on "IntraLink": Cyre's docs describe a handler's `{id, payload}`
 * return value auto-triggering the next channel. That auto-chaining isn't
 * actually wired up in the current dispatch path, so the escalation chain
 * below composes channels explicitly with `branch.call(...)` instead —
 * which does work, and reads just as clearly.
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface TelemetryPacket {
  satId: string
  batteryPct: number
  fuelPct: number
  tempC: number
  altitudeKm: number
  timestamp: number
}

interface AnomalyReport {
  satId: string
  reason: 'low-fuel' | 'thermal-drift'
  severity: 'warning' | 'critical'
  packet: TelemetryPacket
}

type CommandAction = 'adjust-orbit' | 'safe-mode'

interface CommandRequest {
  satId: string
  operatorToken: string
  action: CommandAction
  burnSeconds?: number
}

const SATELLITE_IDS = ['SAT-1', 'SAT-2', 'SAT-3', 'SAT-4', 'SAT-5']
const OPERATOR_TOKEN = 'GC-ALPHA-7'
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const jitter = (base: number, spread: number) =>
  Math.round((base + (Math.random() * 2 - 1) * spread) * 10) / 10

/**
 * Cyre's internal `bufferState` (used for both `buffer` and `debounce`
 * channels) stores queued payloads wrapped as `{payload, timestamp}`, but
 * the `call()` code path that reads them back for dispatch hands that
 * wrapper straight to your handler instead of unwrapping `.payload` first.
 * Handlers on buffered/debounced channels can therefore receive
 * `{payload, timestamp}` instead of the value you actually sent — unwrap
 * defensively rather than trusting the documented shape.
 */
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

// ─────────────────────────────────────────────────────────────────────────
// 1. FLEET — telemetry heartbeats + buffered downlink
// ─────────────────────────────────────────────────────────────────────────

function buildFleet() {
  const fleet = useBranch(cyre, {id: 'fleet', name: 'Satellite Fleet'})
  if (!fleet) throw new Error('Failed to create fleet branch')

  // Shared downlink: batches telemetry packets for 2s (or up to 12 of them)
  // before dispatching them to ground as one burst.
  cyre.action({
    id: 'downlink/batch-uplink',
    buffer: {window: 2000, strategy: 'append', maxSize: 12}
  })
  cyre.on('downlink/batch-uplink', (raw: unknown) => {
    const unwrapped = unwrapBuffered<TelemetryPacket | TelemetryPacket[]>(raw)
    const packets = Array.isArray(unwrapped) ? unwrapped : [unwrapped]
    const sats = [...new Set(packets.map(p => p.satId))]
    log.sys(
      `📡 Downlink burst — ${packets.length} packet(s) relayed (${sats.join(', ')})`
    )
    return {relayed: packets.length, satellites: sats}
  })

  const satellites = SATELLITE_IDS.map((satId, index) => {
    const sat = useBranch(fleet, {id: satId, name: `Satellite ${satId}`})
    if (!sat) throw new Error(`Failed to create branch for ${satId}`)

    // Desynced heartbeat, same interval+repeat pattern as heartbeat.ts
    sat.action({id: 'telemetry', interval: 700 + index * 60, repeat: true})

    // SAT-1 is seeded low on fuel so the anomaly-escalation chain fires early
    let fuelPct = index === 0 ? jitter(16, 2) : jitter(78, 8)
    let tempC = jitter(24, 3)

    sat.on('telemetry', () => {
      fuelPct = Math.max(0, fuelPct - Math.random() * 0.6)
      tempC = jitter(tempC, 1.2)

      const packet: TelemetryPacket = {
        satId,
        batteryPct: jitter(88, 6),
        fuelPct: Math.round(fuelPct * 10) / 10,
        tempC: Math.round(tempC * 10) / 10,
        altitudeKm: jitter(550, 4),
        timestamp: Date.now()
      }

      cyre.call('downlink/batch-uplink', packet).catch(() => undefined)

      const fuelBad = packet.fuelPct < 35
      const tempBad = packet.tempC > 27
      const critical = packet.fuelPct < 15 || packet.tempC > 30
      if (critical || fuelBad || tempBad) {
        cyre
          .call('alerts/anomaly-detected', {
            satId,
            reason: fuelBad ? 'low-fuel' : 'thermal-drift',
            severity: critical ? 'critical' : 'warning',
            packet
          } satisfies AnomalyReport)
          .catch(() => undefined)
      }

      return packet
    })

    // Target for the useGroup broadcast further down
    sat.action({id: 'safe-mode'})
    sat.on('safe-mode', (payload: {reason: string}) => {
      log.warn(`🛡️  ${satId} entering SAFE MODE — ${payload.reason}`)
      return {satId, mode: 'safe', ackAt: Date.now()}
    })

    return sat
  })

  return {fleet, satellites}
}

// ─────────────────────────────────────────────────────────────────────────
// 2. MISSION CONTROL — waterfall pipeline, throttle, debounce, detectChanges
// ─────────────────────────────────────────────────────────────────────────

function buildMissionControl() {
  const mc = useBranch(cyre, {id: 'mission-control', name: 'Mission Control'})
  if (!mc) throw new Error('Failed to create mission-control branch')

  // At most one thruster burn every 2s, no matter how many callers ask
  mc.action({id: 'thruster-fire', throttle: 2000})
  mc.on('thruster-fire', (cmd: CommandRequest) => {
    log.success(
      `🔥 Thruster fired on ${cmd.satId} for ${cmd.burnSeconds ?? 1}s`
    )
    return {fired: true, satId: cmd.satId, burnSeconds: cmd.burnSeconds ?? 1}
  })

  // Rapid keystrokes collapse into a single settled command
  mc.action({id: 'operator-console', debounce: 250})
  mc.on('operator-console', (raw: unknown) => {
    const keystrokes = unwrapBuffered<string>(raw)
    log.info(`⌨️  Operator command settled: "${keystrokes}"`)
    return {command: keystrokes}
  })

  // Only dispatches when the payload actually differs from the last call
  mc.action({id: 'sensor-check', detectChanges: true})
  mc.on('sensor-check', (reading: {panelAngleDeg: number}) => {
    log.debug(`🧭 Solar panel angle accepted: ${reading.panelAngleDeg}°`)
    return reading
  })

  // 4-stage waterfall: each handler gets the previous handler's return value.
  // fail-fast means one thrown error aborts the whole pipeline.
  mc.action({
    id: 'execute-command',
    dispatch: 'waterfall',
    errorStrategy: 'fail-fast',
    dispatchTimeout: 5000
  })

  mc.on('execute-command', (cmd: CommandRequest) => {
    if (cmd.operatorToken !== OPERATOR_TOKEN) {
      throw new Error(`Unauthorized operator token for ${cmd.satId}`)
    }
    log.debug(`🔐 Stage 1/4 — authenticated command for ${cmd.satId}`)
    return {...cmd, authenticated: true}
  })

  mc.on('execute-command', (cmd: CommandRequest & {authenticated: boolean}) => {
    if (cmd.action === 'adjust-orbit' && (cmd.burnSeconds ?? 0) > 8) {
      throw new Error(
        `Burn ${cmd.burnSeconds}s exceeds safety envelope for ${cmd.satId}`
      )
    }
    log.debug(`✅ Stage 2/4 — validated ${cmd.action} for ${cmd.satId}`)
    return {...cmd, validated: true}
  })

  mc.on('execute-command', async (cmd: any) => {
    log.debug(`🛰️  Stage 3/4 — scheduling ${cmd.action} for ${cmd.satId}`)
    if (cmd.action === 'adjust-orbit') {
      const thruster = await mc.call('thruster-fire', cmd)
      return {...cmd, thruster: thruster.payload}
    }
    return {...cmd, scheduled: true}
  })

  mc.on('execute-command', (cmd: any) => {
    log.success(
      `📓 Stage 4/4 — journal entry recorded for ${cmd.satId}: ${cmd.action}`
    )
    return {...cmd, confirmed: true, journalledAt: Date.now()}
  })

  return mc
}

// ─────────────────────────────────────────────────────────────────────────
// 3. ALERTS — explicit escalation chain + race-dispatch ground stations
// ─────────────────────────────────────────────────────────────────────────

function buildAlertsAndGroundStations() {
  const ops = useBranch(cyre, {id: 'alerts', name: 'Alert Escalation'})
  if (!ops) throw new Error('Failed to create alerts branch')

  ops.action({id: 'anomaly-detected'})
  ops.on('anomaly-detected', async (report: AnomalyReport) => {
    log.warn(
      `⚠️  Anomaly on ${report.satId}: ${report.reason} (${report.severity})`
    )
    if (report.severity === 'critical') {
      await ops.call('escalate', report)
      return {handled: 'escalated', report}
    }
    return {handled: 'logged-as-warning', report}
  })

  ops.action({id: 'escalate'})
  ops.on('escalate', async (report: AnomalyReport) => {
    log.critical(
      `🚨 ESCALATION — ${report.satId} requires immediate attention (${report.reason})`
    )
    await ops.call('notify-operator', report)
    return {escalated: true, report}
  })

  ops.action({id: 'notify-operator'})
  ops.on('notify-operator', (report: AnomalyReport) => {
    log.critical(
      `📟 PAGE SENT to duty operator: ${report.satId} — ${report.reason}. Ack required.`
    )
    return {paged: true, satId: report.satId, at: Date.now()}
  })

  // Three ground stations race to acquire signal lock — fastest wins
  cyre.action({
    id: 'ground/acquire-signal',
    dispatch: 'race',
    dispatchTimeout: 3000
  })
  const stations = [
    {name: 'Svalbard', baseLatency: 40},
    {name: 'Alice Springs', baseLatency: 65},
    {name: 'Kiruna', baseLatency: 55}
  ]
  stations.forEach(station => {
    cyre.on('ground/acquire-signal', async (satId: string) => {
      const latencyMs = Math.round(station.baseLatency + Math.random() * 80)
      await new Promise(resolve => setTimeout(resolve, latencyMs))
      return {station: station.name, latencyMs, satId}
    })
  })

  return ops
}

// ─────────────────────────────────────────────────────────────────────────
// 4. FLEET OPS — one call, whole constellation (useGroup)
// ─────────────────────────────────────────────────────────────────────────

function buildFleetOps(
  satellites: ReturnType<typeof buildFleet>['satellites']
) {
  const safeModeGroup = useGroup(
    satellites.map(sat => ({
      id: sat.path(),
      call: (payload: any) => sat.call('safe-mode', payload)
    })),
    {
      name: 'constellation-safe-mode',
      strategy: 'parallel',
      errorStrategy: 'continue',
      timeout: 4000
    }
  )

  return async (reason: string) => {
    log.sys(
      `🛑 Broadcasting SAFE MODE to entire constellation — reason: ${reason}`
    )
    const result = await safeModeGroup.call({reason, triggeredAt: Date.now()})
    log.sys(
      `🛑 Broadcast complete: ${result.metadata?.successful}/${result.metadata?.channelCount} satellites acknowledged`
    )
    return result
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 5. DASHBOARD — cyre.getMetrics() / cyre.get()
// ─────────────────────────────────────────────────────────────────────────

function printDashboard() {
  const metrics: any = cyre.getMetrics()

  console.log('\n' + '═'.repeat(64))
  console.log('🛰️   O R B I T A L   C O M M A N D   —   D A S H B O A R D')
  console.log('═'.repeat(64))
  console.log(`Channels registered   : ${metrics.stores?.channels ?? 'n/a'}`)
  console.log(`Active subscribers    : ${metrics.stores?.subscribers ?? 'n/a'}`)
  console.log(
    `Active timers         : ${metrics.stores?.activeFormations ?? 'n/a'}`
  )
  console.log(
    `System healthy        : ${metrics.system?.health?.isHealthy ?? 'n/a'}`
  )
  console.log(`System uptime         : ${metrics.system?.uptime ?? 'n/a'}ms`)

  console.log('\nSatellite telemetry snapshot (from cyre.get):')
  SATELLITE_IDS.forEach(satId => {
    const state: any = cyre.get(`fleet/${satId}/telemetry`)
    const packet = state?.res?.payload
    if (packet) {
      console.log(
        `  ${satId.padEnd(6)} fuel:${String(packet.fuelPct).padStart(5)}%  temp:${String(
          packet.tempC
        ).padStart(5)}°C  alt:${packet.altitudeKm}km`
      )
    } else {
      console.log(`  ${satId.padEnd(6)} no telemetry captured yet`)
    }
  })
  console.log('═'.repeat(64) + '\n')
}

// ─────────────────────────────────────────────────────────────────────────
// 6. MISSION TIMELINE
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(64))
  console.log('   C.Y.R.E   O R B I T A L   C O M M A N D')
  console.log('   Ground Control — 5 satellites, 3 ground stations')
  console.log('='.repeat(64))

  const init = await cyre.init()
  log.sys(`Cyre initialized: ${init.message}`)

  // Registration must complete before cyre.lock()
  buildAlertsAndGroundStations()
  const {satellites} = buildFleet()
  const missionControl = buildMissionControl()
  const triggerSafeMode = buildFleetOps(satellites)

  cyre.lock()

  // Kick off every satellite's repeating telemetry heartbeat (same call-once
  // pattern as heartbeat.ts's `cyre.call('heartbeat://', 1)`)
  for (const sat of satellites) await sat.call('telemetry')
  console.log(`\n🛰️  Telemetry live for: ${SATELLITE_IDS.join(', ')}\n`)

  console.log('── 1. Mission command pipeline (dispatch: waterfall) ──')
  const good = await missionControl.call('execute-command', {
    satId: 'SAT-2',
    operatorToken: OPERATOR_TOKEN,
    action: 'adjust-orbit',
    burnSeconds: 4
  })
  console.log(`   ✅ Success case → ok:${good.ok} — ${good.message}`)

  const badToken = await missionControl.call('execute-command', {
    satId: 'SAT-3',
    operatorToken: 'WRONG-TOKEN',
    action: 'safe-mode'
  })
  console.log(`   ❌ Bad token case → ok:${badToken.ok} — ${badToken.message}`)

  const badBurn = await missionControl.call('execute-command', {
    satId: 'SAT-1',
    operatorToken: OPERATOR_TOKEN,
    action: 'adjust-orbit',
    burnSeconds: 20
  })
  console.log(`   ❌ Unsafe burn case → ok:${badBurn.ok} — ${badBurn.message}`)

  console.log('\n── 2. Thruster throttle (max 1 fire / 2s) ──')
  // The SAT-2 orbit adjustment above already fired 'thruster-fire' once
  // (same shared channel, throttled per-channel not per-satellite), so we
  // wait out that window first — otherwise both calls below would be
  // throttled and the demo wouldn't show the "first one succeeds" half.
  await sleep(2100)
  const fire1 = await missionControl.call('thruster-fire', {
    satId: 'SAT-4',
    operatorToken: OPERATOR_TOKEN,
    action: 'adjust-orbit',
    burnSeconds: 2
  })
  console.log(`   Fire #1 → ok:${fire1.ok} — ${fire1.message}`)
  const fire2 = await missionControl.call('thruster-fire', {
    satId: 'SAT-4',
    operatorToken: OPERATOR_TOKEN,
    action: 'adjust-orbit',
    burnSeconds: 2
  })
  console.log(
    `   Fire #2 (immediately after) → ok:${fire2.ok} — ${fire2.message}`
  )

  console.log('\n── 3. Operator console debounce (250ms) ──')
  for (const partial of [
    'S',
    'SA',
    'SAF',
    'SAFE',
    'SAFE ',
    'SAFE M',
    'SAFE MODE SAT-5'
  ]) {
    missionControl.call('operator-console', partial)
    await sleep(30)
  }
  await sleep(400)

  console.log('\n── 4. detectChanges sensor gate ──')
  const r1 = await missionControl.call('sensor-check', {panelAngleDeg: 42})
  console.log(`   Reading #1 (42°) → ok:${r1.ok}`)
  const r2 = await missionControl.call('sensor-check', {panelAngleDeg: 42})
  console.log(
    `   Reading #2 (42° again, unchanged) → ok:${r2.ok} — ${r2.message}`
  )
  const r3 = await missionControl.call('sensor-check', {panelAngleDeg: 47})
  console.log(`   Reading #3 (47°, changed) → ok:${r3.ok}`)

  console.log('\n── 5. Ground station race (dispatch: race) ──')
  const race = await cyre.call('ground/acquire-signal', 'SAT-5')
  console.log(
    `   🏁 Winner: ${race.payload?.station} locked ${race.payload?.satId} in ${race.payload?.latencyMs}ms`
  )

  console.log('\n── 6. Constellation-wide broadcast (useGroup) ──')
  await triggerSafeMode('scheduled maintenance drill')

  console.log(
    '\n── 7. Live telemetry running (watch for downlink bursts & anomaly escalation) ──'
  )
  await sleep(5000)

  printDashboard()

  console.log('🛑 Mission complete — shutting down Cyre...')
  cyre.shutdown() // note: this calls process.exit(0) internally
}

main().catch(error => {
  console.error('❌ Orbital Command demo failed:', error)
  process.exit(1)
})
