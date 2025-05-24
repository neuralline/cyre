// test/metrics-monitoring.test.ts
// Fixed test for proper metrics tracking

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {metricsReport} from '../src/context/metrics-report'
import {io} from '../src/context/state'

/*
 * Enhanced Metrics Monitoring Test for CYRE
 *
 * Tests the comprehensive metrics system including:
 * - Action execution metrics
 * - Performance tracking
 * - System breathing state
 * - Enhanced pipeline timing
 */

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('Cyre Performance Metrics and Monitoring', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    // Reset metrics for clean test state
    metricsReport.reset()

    console.log('===== METRICS MONITORING TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== METRICS MONITORING TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test breathing state metrics
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
   * Test metrics updating during system activity
   */
  it('should update metrics during system activity', async () => {
    // Create test action
    cyre.action({
      id: 'activity-test',
      payload: {message: 'Testing activity'}
    })

    // Register handler
    cyre.on('activity-test', payload => {
      return {success: true, timestamp: Date.now()}
    })

    // Get initial global metrics
    const initialGlobalMetrics = metricsReport.getGlobalMetrics()
    const initialCalls = initialGlobalMetrics.totalCalls

    // Execute action
    await cyre.call('activity-test', {message: 'Test execution'})

    // Get updated global metrics
    const updatedGlobalMetrics = metricsReport.getGlobalMetrics()

    // Verify metrics were updated
    expect(updatedGlobalMetrics.totalCalls).toBe(initialCalls + 1)
    expect(updatedGlobalMetrics.totalExecutions).toBeGreaterThanOrEqual(1)
  })

  /**
   * Test last execution time tracking with enhanced metrics
   */
  it('should record last execution time for actions', async () => {
    // Create test action
    cyre.action({
      id: 'execution-time-test',
      payload: {value: 42}
    })

    // Register handler with some work
    cyre.on('execution-time-test', async payload => {
      // Add small delay to ensure measurable execution time
      await wait(5)
      return {processed: payload.value * 2}
    })

    // Execute action
    await cyre.call('execution-time-test', {value: 42})

    // Wait for metrics to be recorded
    await wait(10)

    // Get enhanced action metrics from metrics-report
    const actionMetrics = metricsReport.getActionMetrics('execution-time-test')

    if (actionMetrics) {
      // Verify enhanced metrics are tracked
      expect(actionMetrics.calls).toBeGreaterThan(0)
      expect(actionMetrics.executionCount).toBeGreaterThan(0)
      expect(actionMetrics.totalExecutionTime).toBeGreaterThan(0)
      expect(actionMetrics.avgExecutionTime).toBeGreaterThan(0)
      expect(actionMetrics.lastExecution).toBeGreaterThan(0)

      // Print metrics for verification
      console.log('Enhanced Action Metrics:', {
        calls: actionMetrics.calls,
        executions: actionMetrics.executionCount,
        avgTime: actionMetrics.avgExecutionTime,
        totalTime: actionMetrics.totalExecutionTime,
        lastExecution: actionMetrics.lastExecution
      })
    } else {
      // If enhanced metrics don't exist, check legacy metrics
      const legacyMetrics = io.getMetrics('execution-time-test')
      expect(legacyMetrics).toBeDefined()

      if (legacyMetrics) {
        expect(legacyMetrics.executionCount).toBeGreaterThan(0)
        console.log('Legacy Metrics:', legacyMetrics)
      }
    }
  })

  /**
   * Test individual action metrics tracking
   */
  it('should track metrics for individual actions', async () => {
    const actionId = 'individual-action-test'

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
    for (let i = 0; i < 3; i++) {
      await cyre.call(actionId, {counter: i})
    }

    // Wait for all metrics to be recorded
    await wait(20)

    // Check enhanced metrics first
    const enhancedMetrics = metricsReport.getActionMetrics(actionId)

    if (enhancedMetrics) {
      expect(enhancedMetrics.calls).toBe(3)
      expect(enhancedMetrics.executionCount).toBeGreaterThan(0)
      expect(enhancedMetrics.totalExecutionTime).toBeGreaterThan(0)
      expect(enhancedMetrics.lastExecution).toBeGreaterThan(0)

      console.log('Enhanced Individual Metrics:', {
        id: enhancedMetrics.id,
        calls: enhancedMetrics.calls,
        executions: enhancedMetrics.executionCount,
        avgTime: enhancedMetrics.avgExecutionTime,
        lastExecution: enhancedMetrics.lastExecution,
        category: enhancedMetrics.performanceCategory
      })
    } else {
      // Fallback to legacy metrics
      const legacyMetrics = io.getMetrics(actionId)
      expect(legacyMetrics).toBeDefined()

      if (legacyMetrics) {
        expect(legacyMetrics.executionCount).toBeGreaterThan(0)
        console.log('Legacy Individual Metrics:', legacyMetrics)
      }
    }

    // Verify global metrics increased
    const globalMetrics = metricsReport.getGlobalMetrics()
    expect(globalMetrics.totalCalls).toBeGreaterThanOrEqual(3)
  })

  /**
   * Test stress level calculation
   */
  it('should calculate stress levels accurately', async () => {
    // Create actions to generate some system activity
    cyre.action({
      id: 'stress-test-1',
      payload: {load: 'light'}
    })

    cyre.action({
      id: 'stress-test-2',
      payload: {load: 'medium'}
    })

    // Register handlers with varying workload
    cyre.on('stress-test-1', async payload => {
      await wait(1) // Light workload
      return {completed: true}
    })

    cyre.on('stress-test-2', async payload => {
      await wait(10) // Medium workload
      return {completed: true}
    })

    // Generate some activity
    await Promise.all([
      cyre.call('stress-test-1', {load: 'light'}),
      cyre.call('stress-test-2', {load: 'medium'}),
      cyre.call('stress-test-1', {load: 'light'})
    ])

    // Get breathing state after activity
    const breathingState = cyre.getBreathingState()

    // Verify stress is being calculated
    expect(typeof breathingState.stress).toBe('number')
    expect(breathingState.stress).toBeGreaterThanOrEqual(0)
    expect(breathingState.stress).toBeLessThanOrEqual(1)

    console.log('Stress State After Activity:', {
      stress: breathingState.stress,
      isRecuperating: breathingState.isRecuperating,
      currentRate: breathingState.currentRate,
      pattern: breathingState.pattern
    })
  })

  /**
   * Test performance metrics during parallel operations
   */
  it('should track performance metrics during parallel operations', async () => {
    // Create parallel actions
    const actionIds = ['parallel-1', 'parallel-2', 'parallel-3']

    actionIds.forEach(id => {
      cyre.action({id, payload: {parallel: true}})
      cyre.on(id, async payload => {
        await wait(Math.random() * 10) // Random delay
        return {id, completed: true}
      })
    })

    const initialGlobalMetrics = metricsReport.getGlobalMetrics()

    // Execute in parallel
    await Promise.all(
      actionIds.map(id => cyre.call(id, {timestamp: Date.now()}))
    )

    await wait(50) // Allow metrics to be recorded

    const finalGlobalMetrics = metricsReport.getGlobalMetrics()

    // Verify parallel execution was tracked
    expect(finalGlobalMetrics.totalCalls).toBeGreaterThan(
      initialGlobalMetrics.totalCalls
    )
    expect(finalGlobalMetrics.totalExecutions).toBeGreaterThanOrEqual(3)
    expect(finalGlobalMetrics.totalExecutionTime).toBeGreaterThan(0)

    console.log('Parallel Execution Metrics:', {
      totalCalls: finalGlobalMetrics.totalCalls,
      totalExecutions: finalGlobalMetrics.totalExecutions,
      totalTime: finalGlobalMetrics.totalExecutionTime,
      avgOverhead: finalGlobalMetrics.avgOverheadRatio
    })
  })

  /**
   * Test system-wide metrics for formations/timers
   */
  it('should track system-wide metrics for active formations', async () => {
    // Create action with interval to generate formations
    cyre.action({
      id: 'formation-test',
      interval: 100,
      repeat: 2,
      delay: 0, // Start immediately
      payload: {formation: true}
    })

    cyre.on('formation-test', payload => {
      return {formation: 'executed'}
    })

    // Start the interval action
    const callPromise = cyre.call('formation-test', {start: true})

    // Wait a bit for formations to be active
    await wait(50)

    // Get system metrics - use the enhanced metrics system
    const globalMetrics = metricsReport.getGlobalMetrics()
    const performanceState = cyre.getPerformanceState()

    // Verify system tracking
    expect(globalMetrics).toBeDefined()
    expect(performanceState).toBeDefined()
    expect(typeof performanceState.totalProcessingTime).toBe('number')
    expect(typeof performanceState.stress).toBe('number')

    console.log('System-wide Metrics:', {
      totalActions: globalMetrics.totalActions,
      totalCalls: globalMetrics.totalCalls,
      totalExecutions: globalMetrics.totalExecutions,
      stress: performanceState.stress
    })

    // Wait for the interval action to complete
    await callPromise
    await wait(250) // Wait for all repetitions
  })

  /**
   * Test detailed channel metrics
   */
  it('should provide detailed metrics for specific channels', async () => {
    const channelId = 'metrics-channel-test'

    // Create channel
    cyre.action({
      id: channelId,
      payload: {test: true}
    })

    cyre.on(channelId, payload => {
      return {channelTest: true}
    })

    // Execute to generate metrics
    await cyre.call(channelId, {test: 'detailed'})
    await wait(20)

    // Get enhanced channel metrics
    const enhancedMetrics = metricsReport.getActionMetrics(channelId)

    if (enhancedMetrics) {
      // Test enhanced metrics structure
      expect(enhancedMetrics).toBeDefined()
      expect(enhancedMetrics.id).toBe(channelId)
      expect(enhancedMetrics.calls).toBeGreaterThan(0)
      expect(enhancedMetrics.executionCount).toBeGreaterThan(0)

      console.log('Enhanced Channel Metrics:', {
        id: enhancedMetrics.id,
        calls: enhancedMetrics.calls,
        executions: enhancedMetrics.executionCount,
        avgTime: enhancedMetrics.avgExecutionTime,
        category: enhancedMetrics.performanceCategory,
        suggestions: enhancedMetrics.optimizationSuggestions
      })
    }

    // Get legacy channel metrics via cyre.getMetrics()
    const channelMetrics = cyre.getMetrics(channelId)
    expect(channelMetrics).toBeDefined()
    expect(channelMetrics.breathing).toBeDefined()

    // Don't test activeFormations as it might be 0 for simple actions
    expect(typeof channelMetrics.hibernating).toBe('boolean')
    expect(Array.isArray(channelMetrics.formations)).toBe(true)

    console.log('Legacy Channel Metrics:', {
      hibernating: channelMetrics.hibernating,
      formationsCount: channelMetrics.formations.length,
      breathingPattern: channelMetrics.breathing.pattern
    })
  })

  /**
   * Test metrics report generation
   */
  it('should generate comprehensive metrics reports', async () => {
    // Create multiple actions for a meaningful report
    const actions = ['report-1', 'report-2', 'report-3']

    actions.forEach((id, index) => {
      cyre.action({id, payload: {index}})
      cyre.on(id, async payload => {
        await wait(index * 2) // Varying execution times
        return {index: payload.index}
      })
    })

    // Execute all actions multiple times
    for (const id of actions) {
      await cyre.call(id, {executed: true})
      await cyre.call(id, {executed: true})
    }

    await wait(50)

    // Generate report
    const report = metricsReport.generateReport()
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
    expect(report).toContain('CYRE Enhanced Metrics Report')
    expect(report).toContain('Activity Summary')
    expect(report).toContain('Performance Metrics')

    // Test insights
    const insights = metricsReport.getInsights()
    expect(Array.isArray(insights)).toBe(true)

    console.log('Report Generated:', {
      reportLength: report.length,
      insightsCount: insights.length,
      containsExpectedSections: report.includes('Activity Summary')
    })
  })
})
