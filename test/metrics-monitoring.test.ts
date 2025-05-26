// test/metrics-monitoring.test.ts
// FIXED: Updated for lightweight metrics system

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
 * Lightweight Metrics Monitoring Test for CYRE
 *
 * Tests the lightweight metrics system including:
 * - Basic metrics collection
 * - Raw data export for external monitoring
 * - System breathing state
 * - Memory-efficient data storage
 */

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('Cyre Lightweight Metrics and Monitoring', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== LIGHTWEIGHT METRICS TEST STARTED =====')
  })

  afterEach(() => {
    // Clear system for clean test state
    cyre.clear()

    vi.restoreAllMocks()
    console.log('===== LIGHTWEIGHT METRICS TEST COMPLETED =====')
  })

  /**
   * Test breathing state metrics (mission critical for Cyre)
   */
  it('should provide accurate breathing state metrics', () => {
    const breathingState = cyre.getBreathingState()

    // Verify breathing state structure
    expect(breathingState).toBeDefined()
    expect(typeof breathingState.breathCount).toBe('number')
    expect(typeof breathingState.currentRate).toBe('number')
    expect(typeof breathingState.lastBreath).toBe('number')
    expect(typeof breathingState.stress).toBe('number')
    expect(typeof breathingState.isRecuperating).toBe('boolean')
    expect(typeof breathingState.recuperationDepth).toBe('number')
    expect(breathingState.pattern).toBeDefined()

    // Verify reasonable values
    expect(breathingState.breathCount).toBeGreaterThanOrEqual(0)
    expect(breathingState.currentRate).toBeGreaterThan(0)
    expect(breathingState.stress).toBeGreaterThanOrEqual(0)
    expect(breathingState.stress).toBeLessThanOrEqual(1)
    expect(breathingState.recuperationDepth).toBeGreaterThanOrEqual(0)
    expect(breathingState.recuperationDepth).toBeLessThanOrEqual(1)
  })

  /**
   * Test lightweight metrics collection during system activity
   */
  it('should collect lightweight metrics during system activity', async () => {
    // Create test action
    cyre.action({
      id: 'activity-test',
      payload: {message: 'Testing activity'}
    })

    // Register handler
    cyre.on('activity-test', payload => {
      return {success: true, timestamp: Date.now()}
    })

    // Get initial system stats
    const initialStats = cyre.dev.getSystemStats()
    const initialCalls = initialStats.totalCalls

    // Execute action
    await cyre.call('activity-test', {message: 'Test execution'})

    // Get updated system stats
    const updatedStats = cyre.dev.getSystemStats()

    // Verify lightweight metrics were updated
    expect(updatedStats.totalCalls).toBe(initialCalls + 1)
    expect(updatedStats.totalExecutions).toBeGreaterThanOrEqual(1)
  })

  /**
   * Test raw metrics export for external monitoring
   */
  it('should export raw metrics events for external monitoring', async () => {
    // Create test action
    cyre.action({
      id: 'export-test',
      payload: {value: 42}
    })

    // Register handler
    cyre.on('export-test', payload => {
      return {processed: payload.value * 2}
    })

    // Execute action multiple times
    await cyre.call('export-test', {value: 10})
    await cyre.call('export-test', {value: 20})
    await cyre.call('export-test', {value: 30})

    // Export all events
    const allEvents = cyre.exportMetrics()
    expect(allEvents.length).toBeGreaterThan(0)

    // Export filtered events (calls only)
    const callEvents = cyre.exportMetrics({
      eventType: 'call',
      actionId: 'export-test'
    })
    expect(callEvents.length).toBe(3)

    // Verify event structure
    const event = callEvents[0]
    expect(event).toHaveProperty('timestamp')
    expect(event).toHaveProperty('actionId', 'export-test')
    expect(event).toHaveProperty('eventType', 'call')
    expect(event).toHaveProperty('priority')
    expect(typeof event.timestamp).toBe('number')

    console.log('Exported Events Sample:', {
      totalEvents: allEvents.length,
      callEvents: callEvents.length,
      sampleEvent: event
    })
  })

  /**
   * Test action stats collection (minimal for memory efficiency)
   */
  it('should track minimal action stats efficiently', async () => {
    const actionId = 'stats-test'

    // Create action
    cyre.action({
      id: actionId,
      payload: {counter: 0}
    })

    // Register handler
    cyre.on(actionId, payload => {
      return {result: payload.counter + 1}
    })

    // Execute multiple times
    for (let i = 0; i < 5; i++) {
      await cyre.call(actionId, {counter: i})
    }

    // Get action stats from lightweight collector
    const actionStats = cyre.dev.getActionStats(actionId)
    expect(actionStats).toBeDefined()

    if (actionStats) {
      expect(actionStats.id).toBe(actionId)
      expect(actionStats.calls).toBe(5)
      expect(actionStats.executions).toBeGreaterThan(0)
      expect(actionStats.errors).toBe(0)
      expect(actionStats.lastCall).toBeGreaterThan(0)
      expect(actionStats.lastExecution).toBeGreaterThan(0)

      console.log('Lightweight Action Stats:', {
        id: actionStats.id,
        calls: actionStats.calls,
        executions: actionStats.executions,
        errors: actionStats.errors,
        lastCall: new Date(actionStats.lastCall).toISOString(),
        lastExecution: new Date(actionStats.lastExecution).toISOString()
      })
    }
  })

  /**
   * Test memory efficiency and cleanup
   */
  it('should maintain memory efficiency with automatic cleanup', async () => {
    // Get initial memory info
    const initialMemory = cyre.getMetricsMemoryInfo()
    expect(initialMemory).toHaveProperty('eventCount')
    expect(initialMemory).toHaveProperty('actionCount')
    expect(initialMemory).toHaveProperty('maxEvents')
    expect(initialMemory).toHaveProperty('isHealthy')

    // Create multiple actions to test memory management
    const actionIds = Array.from({length: 10}, (_, i) => `memory-test-${i}`)

    actionIds.forEach(id => {
      cyre.action({id, payload: {test: true}})
      cyre.on(id, () => ({executed: true}))
    })

    // Execute all actions multiple times
    for (const id of actionIds) {
      await cyre.call(id, {timestamp: Date.now()})
      await cyre.call(id, {timestamp: Date.now()})
    }

    // Get updated memory info
    const updatedMemory = cyre.getMetricsMemoryInfo()

    console.log('Memory Management:', {
      initial: initialMemory,
      updated: updatedMemory,
      isHealthy: updatedMemory.isHealthy
    })

    // Verify memory is being managed
    expect(updatedMemory.eventCount).toBeGreaterThan(initialMemory.eventCount)
    expect(updatedMemory.actionCount).toBeGreaterThan(initialMemory.actionCount)
    expect(updatedMemory.eventCount).toBeLessThan(updatedMemory.maxEvents)
    expect(updatedMemory.isHealthy).toBe(true)
  })

  /**
   * Test basic metrics report (lightweight, no heavy processing)
   */
  it('should generate basic metrics report without heavy processing', async () => {
    // Create some activity
    cyre.action({id: 'report-test-1', payload: {value: 1}})
    cyre.action({id: 'report-test-2', payload: {value: 2}})

    cyre.on('report-test-1', () => ({result: 1}))
    cyre.on('report-test-2', () => ({result: 2}))

    await cyre.call('report-test-1', {test: true})
    await cyre.call('report-test-2', {test: true})

    // Generate basic report
    const report = cyre.getBasicMetricsReport()
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
    expect(report).toContain('CYRE Lightweight Metrics Report')
    expect(report).toContain('Total Calls:')
    expect(report).toContain('Total Executions:')
    expect(report).toContain('Memory Usage: Lightweight')

    console.log('Basic Report Generated:', {
      reportLength: report.length,
      containsExpectedContent: report.includes('Lightweight Metrics Report')
    })
  })

  /**
   * Test performance state integration with breathing system
   */
  it('should integrate with breathing system for stress calculation', async () => {
    // Create actions with varying load
    cyre.action({id: 'light-work', payload: {load: 'light'}})
    cyre.action({id: 'heavy-work', payload: {load: 'heavy'}})

    cyre.on('light-work', async () => {
      await wait(1) // Light work
      return {completed: true}
    })

    cyre.on('heavy-work', async () => {
      await wait(10) // Heavier work
      return {completed: true}
    })

    // Execute to generate activity
    await Promise.all([
      cyre.call('light-work', {test: true}),
      cyre.call('heavy-work', {test: true}),
      cyre.call('light-work', {test: true})
    ])

    // Get performance state (should include call rate for breathing system)
    const performanceState = cyre.getPerformanceState()
    expect(performanceState).toHaveProperty('stress')
    expect(performanceState).toHaveProperty('callRate')
    expect(performanceState).toHaveProperty('totalCalls')
    expect(performanceState).toHaveProperty('totalExecutions')

    expect(typeof performanceState.stress).toBe('number')
    expect(typeof performanceState.callRate).toBe('number')
    expect(performanceState.stress).toBeGreaterThanOrEqual(0)
    expect(performanceState.stress).toBeLessThanOrEqual(1)

    console.log('Performance State:', {
      stress: performanceState.stress,
      callRate: performanceState.callRate,
      totalCalls: performanceState.totalCalls,
      totalExecutions: performanceState.totalExecutions
    })

    // Verify breathing system has access to call rate data
    const breathingState = cyre.getBreathingState()
    expect(breathingState.stress).toBeGreaterThanOrEqual(0)
  })

  /**
   * Test error tracking in lightweight system
   */
  it('should track errors efficiently without heavy processing', async () => {
    const actionId = 'error-test'

    // Create action with error-prone handler
    cyre.action({id: actionId, payload: {shouldFail: false}})
    cyre.on(actionId, payload => {
      if (payload.shouldFail) {
        throw new Error('Test error for lightweight tracking')
      }
      return {success: true}
    })

    // Execute successful call
    await cyre.call(actionId, {shouldFail: false})

    // Execute failing call
    await cyre.call(actionId, {shouldFail: true})

    // Get action stats to check error count
    const actionStats = cyre.dev.getActionStats(actionId)
    expect(actionStats).toBeDefined()

    if (actionStats) {
      expect(actionStats.calls).toBe(2)
      expect(actionStats.errors).toBe(1) // One error recorded
    }

    // Export error events
    const errorEvents = cyre.exportMetrics({
      actionId,
      eventType: 'error'
    })
    expect(errorEvents.length).toBe(1)
    expect(errorEvents[0].metadata?.error).toContain('Test error')

    console.log('Error Tracking:', {
      actionStats,
      errorEvents: errorEvents.length,
      errorDetails: errorEvents[0]?.metadata?.error
    })
  })

  /**
   * Test system stats for breathing system integration
   */
  it('should provide system stats needed for breathing system', () => {
    // Get system stats (mission critical for breathing system)
    const systemStats = cyre.dev.getSystemStats()

    expect(systemStats).toHaveProperty('totalCalls')
    expect(systemStats).toHaveProperty('totalExecutions')
    expect(systemStats).toHaveProperty('totalErrors')
    expect(systemStats).toHaveProperty('callRate')
    expect(systemStats).toHaveProperty('lastCallTime')
    expect(systemStats).toHaveProperty('startTime')

    expect(typeof systemStats.totalCalls).toBe('number')
    expect(typeof systemStats.callRate).toBe('number')
    expect(systemStats.totalCalls).toBeGreaterThanOrEqual(0)
    expect(systemStats.callRate).toBeGreaterThanOrEqual(0)

    console.log('System Stats for Breathing:', {
      totalCalls: systemStats.totalCalls,
      callRate: systemStats.callRate,
      uptime: Date.now() - systemStats.startTime
    })
  })

  /**
   * Test export all action stats for external monitoring
   */
  it('should export all action stats for external monitoring', async () => {
    // Create multiple actions
    const actionIds = ['export-1', 'export-2', 'export-3']

    actionIds.forEach(id => {
      cyre.action({id, payload: {index: id}})
      cyre.on(id, () => ({executed: true}))
    })

    // Execute all actions
    for (const id of actionIds) {
      await cyre.call(id, {test: true})
    }

    // Export all action stats
    const allActionStats = cyre.dev.exportAllActionStats()
    expect(Array.isArray(allActionStats)).toBe(true)
    expect(allActionStats.length).toBeGreaterThanOrEqual(3)

    // Verify structure of exported stats
    const sampleStat = allActionStats.find(stat => actionIds.includes(stat.id))
    expect(sampleStat).toBeDefined()

    if (sampleStat) {
      expect(sampleStat).toHaveProperty('id')
      expect(sampleStat).toHaveProperty('calls')
      expect(sampleStat).toHaveProperty('executions')
      expect(sampleStat).toHaveProperty('errors')
      expect(sampleStat).toHaveProperty('lastCall')
      expect(sampleStat).toHaveProperty('lastExecution')
    }

    console.log('Exported Action Stats:', {
      totalActions: allActionStats.length,
      sampleAction: sampleStat
    })
  })
})
