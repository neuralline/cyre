// src/dev/metrics-bridge.ts
// File-based bridge to share metrics between Cyre and dashboard

import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync
} from 'fs'
import {join} from 'path'

/*

      C.Y.R.E - M.E.T.R.I.C.S - B.R.I.D.G.E
      
      Simple file-based metrics sharing for dev tool:
      - Cyre writes metrics to file
      - Dashboard reads metrics from file
      - No process coupling
      - Dev-friendly approach

*/

interface MetricsSnapshot {
  timestamp: number
  systemAnalysis: any
  health: any
  performance: any
  pipeline: any
  systemMetrics: any
  channelMetrics: any[]
  events: any[]
  serverInfo: {
    pid: number
    uptime: number
    version: string
  }
}

const METRICS_DIR = join(process.cwd(), '.cyre-dev')
const METRICS_FILE = join(METRICS_DIR, 'metrics.json')
const LOCK_FILE = join(METRICS_DIR, 'metrics.lock')

/**
 * Ensure metrics directory exists
 */
const ensureMetricsDir = (): void => {
  if (!existsSync(METRICS_DIR)) {
    mkdirSync(METRICS_DIR, {recursive: true})
  }
}

/**
 * Write metrics snapshot (called by Cyre)
 */
export const writeMetricsSnapshot = (
  snapshot: Partial<MetricsSnapshot>
): void => {
  try {
    ensureMetricsDir()

    const fullSnapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      systemAnalysis: null,
      health: null,
      performance: null,
      pipeline: null,
      systemMetrics: null,
      channelMetrics: [],
      events: [],
      serverInfo: {
        pid: process.pid,
        uptime: process.uptime(),
        version: '1.0.0'
      },
      ...snapshot
    }

    // Write with lock to prevent partial reads
    writeFileSync(LOCK_FILE, Date.now().toString())
    writeFileSync(METRICS_FILE, JSON.stringify(fullSnapshot, null, 2))

    // Remove lock
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE)
    }
  } catch (error) {
    console.warn('📊 Failed to write metrics snapshot:', error)
  }
}

/**
 * Read metrics snapshot (called by dashboard)
 */
export const readMetricsSnapshot = (): MetricsSnapshot | null => {
  try {
    ensureMetricsDir()

    // Check if file exists and is not locked
    if (!existsSync(METRICS_FILE) || existsSync(LOCK_FILE)) {
      return null
    }

    const data = readFileSync(METRICS_FILE, 'utf8')
    const snapshot = JSON.parse(data) as MetricsSnapshot

    // Check if data is stale (older than 30 seconds)
    const age = Date.now() - snapshot.timestamp
    if (age > 30000) {
      return null
    }

    return snapshot
  } catch (error) {
    console.warn('📊 Failed to read metrics snapshot:', error)
    return null
  }
}

/**
 * Check if Cyre is running by looking at metrics file
 */
export const isCyreRunning = (): boolean => {
  const snapshot = readMetricsSnapshot()
  return snapshot !== null
}

/**
 * Clean up metrics files
 */
export const cleanupMetrics = (): void => {
  try {
    if (existsSync(METRICS_FILE)) {
      unlinkSync(METRICS_FILE)
    }
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE)
    }
  } catch (error) {
    console.warn('📊 Failed to cleanup metrics files:', error)
  }
}
