// src/tests/metrics-report.test.ts

import {cyre} from '../src/index'
import {metricsReport} from '../src/context/metrics-report'

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('CYRE Metrics Report', () => {
  beforeEach(() => {
    // Reset CYRE and metrics
    //cyre.clear()
    metricsReport.reset()
  })

  test('Tracks basic call metrics', async () => {
    // Setup action
    cyre.action({
      id: 'test-action',
      payload: {message: 'Hello'}
    })

    cyre.on('test-action', payload => {
      return {success: true}
    })

    // Call action twice
    await cyre.call('test-action', {message: 'Test 1'})
    await cyre.call('test-action', {message: 'Test 2'})

    // Get metrics for the action
    const metrics = metricsReport.getActionMetrics('test-action')

    // Verify metrics
    expect(metrics).toBeDefined()
    expect(metrics?.calls).toBe(2)
    expect(metrics?.executionCount).toBeGreaterThan(0)

    // Verify global metrics
    const globalMetrics = metricsReport.getGlobalMetrics()
    expect(globalMetrics.totalCalls).toBe(2)
    expect(globalMetrics.totalExecutions).toBeGreaterThan(0)
  })

  test('Tracks throttle metrics', async () => {
    // Setup throttled action
    cyre.action({
      id: 'throttled-action',
      throttle: 100,
      payload: {message: 'Hello'}
    })

    cyre.on('throttled-action', payload => {
      return {success: true}
    })

    // Call action twice in rapid succession
    await cyre.call('throttled-action', {message: 'Test 1'})
    await cyre.call('throttled-action', {message: 'Test 2'}) // Should be throttled

    // Get metrics
    const metrics = metricsReport.getActionMetrics('throttled-action')

    // Verify metrics
    expect(metrics).toBeDefined()
    expect(metrics?.calls).toBe(2)
    expect(metrics?.throttles).toBe(1) // Second call should be throttled

    // Verify global metrics
    const globalMetrics = metricsReport.getGlobalMetrics()
    expect(globalMetrics.totalThrottles).toBe(1)
  })

  test('Tracks debounce metrics', async () => {
    // Setup debounced action
    cyre.action({
      id: 'debounced-action',
      debounce: 50,
      payload: {message: 'Hello'}
    })

    cyre.on('debounced-action', payload => {
      return {success: true}
    })

    // Call action three times in rapid succession
    await cyre.call('debounced-action', {message: 'Test 1'})
    await cyre.call('debounced-action', {message: 'Test 2'})
    await cyre.call('debounced-action', {message: 'Test 3'})

    // Wait for debounce to complete
    await wait(100)

    // Get metrics
    const metrics = metricsReport.getActionMetrics('debounced-action')

    // Verify metrics
    expect(metrics).toBeDefined()
    expect(metrics?.calls).toBe(3)
    expect(metrics?.debounces).toBe(3) // All calls should be debounced

    // Verify global metrics
    const globalMetrics = metricsReport.getGlobalMetrics()
    expect(globalMetrics.totalDebounces).toBe(3)
  })

  test('Tracks change detection metrics', async () => {
    // Setup action with change detection
    cyre.action({
      id: 'change-detection-action',
      detectChanges: true,
      payload: {value: 1}
    })

    cyre.on('change-detection-action', payload => {
      return {success: true}
    })

    // Call action with different payloads
    await cyre.call('change-detection-action', {value: 42})
    await cyre.call('change-detection-action', {value: 42}) // Should be skipped
    await cyre.call('change-detection-action', {value: 100}) // Should execute

    // Get metrics
    const metrics = metricsReport.getActionMetrics('change-detection-action')

    // Verify metrics
    expect(metrics).toBeDefined()
    expect(metrics?.calls).toBe(3)
    expect(metrics?.changeDetectionSkips).toBe(1) // Second call should be skipped

    // Verify global metrics
    const globalMetrics = metricsReport.getGlobalMetrics()
    expect(globalMetrics.totalChangeDetectionSkips).toBe(1)
  })

  test('Tracks repeat metrics', async () => {
    // Setup repeated action
    cyre.action({
      id: 'repeated-action',
      interval: 20,
      repeat: 3,
      delay: 0,
      payload: {counter: 0}
    })

    cyre.on('repeated-action', payload => {
      return {success: true}
    })

    // Start the repeated action
    await cyre.call('repeated-action', {counter: 1})

    // Wait for all repetitions to complete
    await wait(100)

    // Get metrics
    const metrics = metricsReport.getActionMetrics('repeated-action')

    // Verify metrics
    expect(metrics).toBeDefined()
    expect(metrics?.calls).toBe(1)
    expect(metrics?.repeats).toBe(3) // Should count 2 repeats (after first execution)

    // Verify global metrics
    const globalMetrics = metricsReport.getGlobalMetrics()
    expect(globalMetrics.totalRepeats).toBeGreaterThan(0)
  })

  test('Tracks execution times', async () => {
    // Setup action with artificial delay
    cyre.action({
      id: 'timing-action',
      payload: {message: 'Hello'}
    })

    cyre.on('timing-action', async payload => {
      await wait(10) // Small artificial delay
      return {success: true}
    })

    // Call action
    await cyre.call('timing-action', {message: 'Test'})

    // Get metrics
    const metrics = metricsReport.getActionMetrics('timing-action')

    // Verify metrics
    expect(metrics).toBeDefined()
    expect(metrics?.executionTimes.length).toBeGreaterThan(0)
    expect(metrics?.avgExecutionTime).toBeGreaterThan(0)
    expect(metrics?.minExecutionTime).toBeGreaterThan(0)
    expect(metrics?.maxExecutionTime).toBeGreaterThan(0)

    // Verify global metrics
    const globalMetrics = metricsReport.getGlobalMetrics()
    expect(globalMetrics.totalExecutionTime).toBeGreaterThan(0)
  })

  test('Can generate report', () => {
    // Setup and call some actions
    cyre.action({id: 'report-test-1', payload: {value: 1}})
    cyre.action({id: 'report-test-2', throttle: 50, payload: {value: 2}})

    cyre.on('report-test-1', () => ({success: true}))
    cyre.on('report-test-2', () => ({success: true}))

    cyre.call('report-test-1', {value: 10})
    cyre.call('report-test-2', {value: 20})
    cyre.call('report-test-2', {value: 30}) // Should be throttled

    // Generate report
    const report = metricsReport.generateReport()

    // Verify report
    expect(report).toBeDefined()
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
    expect(report).toContain('CYRE')
    expect(report).toContain('report-test-1')
    expect(report).toContain('report-test-2')
  })

  test('Can filter metrics report', () => {
    // Setup and call some actions
    cyre.action({id: 'filter-test-1', payload: {value: 1}})
    cyre.action({id: 'filter-test-2', throttle: 50, payload: {value: 2}})

    cyre.on('filter-test-1', () => ({success: true}))
    cyre.on('filter-test-2', () => ({success: true}))

    cyre.call('filter-test-1', {value: 10})
    cyre.call('filter-test-2', {value: 20})
    cyre.call('filter-test-2', {value: 30}) // Should be throttled

    // Generate filtered report
    const report = metricsReport.generateReport(
      metrics => metrics.id === 'filter-test-2'
    )

    // Verify report
    expect(report).toBeDefined()
    expect(report).toContain('filter-test-2')
    expect(report).not.toContain('filter-test-1')
  })
})
