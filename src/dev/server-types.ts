// src/dev/server-types.ts
// Type interface for metrics server

/*

      C.Y.R.E - M.E.T.R.I.C.S - S.E.R.V.E.R - T.Y.P.E.S
      
      Type definitions for development metrics server:
      - Server configuration options
      - WebSocket message types
      - HTTP response formats

*/

export interface MetricsServerConfig {
  readonly port: number
  readonly host: string
  readonly updateInterval: number
  readonly enableWebSocket: boolean
  readonly enableHTTP: boolean
}

export interface MetricsServerState {
  readonly isRunning: boolean
  readonly clientCount: number
  readonly port: number
  readonly host: string
  readonly cyreRunning: boolean
  readonly uptime: number
}

export interface MetricsResponse {
  readonly timestamp: number
  readonly metrics: {
    readonly system: any
    readonly health: any
    readonly performance: any
    readonly pipeline: any
    readonly channels: readonly any[]
    readonly events: readonly any[]
  }
  readonly server: {
    readonly pid: number
    readonly uptime: number
    readonly version: string
  }
  readonly cyreRunning: boolean
}

export interface MetricsErrorResponse {
  readonly error: string
  readonly timestamp: number
  readonly cyreRunning: boolean
}

export interface HealthResponse {
  readonly status: 'healthy' | 'no-cyre' | 'error'
  readonly timestamp: number
  readonly uptime: number
  readonly clients: number
}

export type WebSocketMessageType =
  | 'initial_metrics'
  | 'metrics_update'
  | 'metrics_response'
  | 'request_metrics'
  | 'server_shutdown'

export interface WebSocketMessage<T = any> {
  readonly type: WebSocketMessageType
  readonly data?: T
  readonly timestamp?: number
  readonly requestId?: string
}

export interface MetricsRequestMessage {
  readonly type: 'request_metrics'
  readonly requestId?: string
  readonly filters?: {
    readonly includeEvents?: boolean
    readonly includeChannels?: boolean
    readonly timeWindow?: number
  }
}

export interface MetricsUpdateMessage {
  readonly type: 'metrics_update'
  readonly data: MetricsResponse | MetricsErrorResponse
  readonly timestamp: number
}

export interface ServerShutdownMessage {
  readonly type: 'server_shutdown'
  readonly timestamp: number
  readonly reason?: string
}

// Function type definitions
export type StartMetricsServerFn = (
  config?: Partial<MetricsServerConfig>
) => Promise<void>
export type StopMetricsServerFn = () => Promise<void>
export type GetMetricsServerStatusFn = () => MetricsServerState

export interface SystemAnalysis {
  timestamp: number
  cyreRunning: boolean
  metrics: {
    system: {
      totalCalls: number
      totalExecutions: number
      totalErrors: number
      uptime: number
      callRate: number
    }
    health: {
      overall: 'healthy' | 'warning' | 'critical'
      score: number
      factors: {
        availability: number
        performance: number
        reliability: number
        efficiency: number
      }
      issues: Array<{type: string; message: string; severity: string}>
      criticalAlerts: number
    }
    performance: {
      avgLatency: number
      p95Latency: number
      throughput: number
      successRate: number
      errorRate: number
      degradations: Array<{
        channelId: string
        type: string
        severity: string
        current: number
        expected: number
        impact: number
      }>
    }
    pipeline: {
      totalCalls: number
      completedCalls: number
      stuckCalls: number
      flowHealth: 'healthy' | 'warning' | 'critical'
      efficiency: number
    }
    channels: Array<{
      id: string
      calls: number
      successes: number
      errors: number
      averageLatency: number
      successRate: number
      status: 'active' | 'idle' | 'error'
    }>
    events: Array<{
      id: string
      timestamp: number
      type: string
      channelId: string
      duration?: number
      success: boolean
    }>
  }
  server: {
    pid: number
    uptime: number
    version: string
    powered_by: string
    connections: number
  }
}

// src/types/dashboard.ts
// Live dashboard data structure - only real metrics from Cyre

export interface SystemAnalysis {
  readonly timestamp: number
  readonly timeWindow: number
  readonly system: SystemMetrics
  readonly pipeline: PipelineAnalysis
  readonly performance: PerformanceAnalysis
  readonly health: HealthAnalysis
  readonly channels: ChannelAnalysis[]
  readonly events: RecentEvents
  readonly anomalies: AnomalyAnalysis
  readonly insights: InsightAnalysis
  readonly recommendations: string[]
}

export interface SystemMetrics {
  readonly totalCalls: number
  readonly totalExecutions: number
  readonly totalErrors: number
  readonly callRate: number
  readonly lastCallTime: number
  readonly startTime: number
  readonly uptime: number
  readonly activeChannels: number
  readonly memory: MemoryMetrics
  readonly performance: SystemPerformance
}

export interface MemoryMetrics {
  readonly eventCount: number
  readonly channelCount: number
  readonly maxEvents: number
  readonly memoryUsage: number // bytes
}

export interface SystemPerformance {
  readonly avgCallRate: number // calls per second over time window
  readonly peakCallRate: number
  readonly systemLoad: number // 0-1 based on call rate vs capacity
}

export interface PipelineAnalysis {
  readonly totalCalls: number
  readonly completedCalls: number
  readonly failedCalls: number
  readonly stuckCalls: number
  readonly avgDuration: number
  readonly efficiency: number
  readonly bottlenecks: Bottleneck[]
  readonly flowHealth: 'healthy' | 'degraded' | 'critical'
  readonly throughputTrend: 'improving' | 'stable' | 'degrading'
}

export interface Bottleneck {
  readonly channelId: string
  readonly count: number
  readonly avgDuration: number
  readonly impactScore: number
}

export interface PerformanceAnalysis {
  readonly avgLatency: number
  readonly p95Latency: number
  readonly p99Latency: number
  readonly throughput: number
  readonly successRate: number
  readonly errorRate: number
  readonly degradations: PerformanceDegradation[]
  readonly trends: 'improving' | 'stable' | 'degrading'
  readonly latencyDistribution: LatencyBucket[]
}

export interface PerformanceDegradation {
  readonly channelId: string
  readonly type: 'latency' | 'throughput' | 'errors'
  readonly severity: 'minor' | 'major' | 'critical'
  readonly current: number
  readonly expected: number
  readonly impact: number
}

export interface LatencyBucket {
  readonly range: string // "0-10ms", "10-50ms", etc
  readonly count: number
  readonly percentage: number
}

export interface HealthAnalysis {
  readonly overall: 'healthy' | 'degraded' | 'critical'
  readonly score: number // 0-100
  readonly factors: HealthFactors
  readonly issues: string[]
  readonly criticalAlerts: number
  readonly trends: HealthTrend[]
}

export interface HealthFactors {
  readonly availability: number // 0-1
  readonly performance: number // 0-1
  readonly reliability: number // 0-1
  readonly efficiency: number // 0-1
}

export interface HealthTrend {
  readonly factor: keyof HealthFactors
  readonly trend: 'improving' | 'stable' | 'degrading'
  readonly changeRate: number
}

export interface ChannelAnalysis {
  readonly id: string
  readonly metrics: ChannelMetrics
  readonly status: 'healthy' | 'warning' | 'critical' | 'inactive'
  readonly issues: string[]
  readonly latencyTrend: 'improving' | 'degrading' | 'stable'
  readonly protectionStats: ProtectionStats
  readonly recommendations: string[]
}

export interface ChannelMetrics {
  readonly id: string
  readonly calls: number
  readonly executions: number
  readonly errors: number
  readonly lastExecution: number
  readonly averageLatency: number
  readonly successRate: number
  readonly errorRate: number
  readonly protectionEvents: ProtectionEvents
}

export interface ProtectionEvents {
  readonly throttled: number
  readonly debounced: number
  readonly blocked: number
  readonly skipped: number
}

export interface ProtectionStats {
  readonly protectionRatio: number // protections / total calls
  readonly executionRatio: number // executions / total calls
  readonly effectiveness: number // 0-1
  readonly status:
    | 'optimal'
    | 'over_protected'
    | 'under_protected'
    | 'problematic'
}

export interface RecentEvents {
  readonly events: EventSummary[]
  readonly patterns: EventPattern[]
  readonly eventRate: number // events per minute
  readonly errorEventRate: number
}

export interface EventSummary {
  readonly id: string
  readonly timestamp: number
  readonly channelId: string
  readonly type: string
  readonly duration?: number
  readonly status: 'success' | 'error' | 'timeout'
}

export interface EventPattern {
  readonly pattern: string
  readonly frequency: number
  readonly channels: string[]
  readonly avgDuration: number
  readonly successRate: number
}

export interface AnomalyAnalysis {
  readonly detected: boolean
  readonly anomalies: Anomaly[]
  readonly patterns: AnomalyPattern[]
  readonly confidence: number
}

export interface Anomaly {
  readonly type: 'statistical' | 'pattern' | 'sequence' | 'timing'
  readonly channelId: string
  readonly severity: 'low' | 'medium' | 'high'
  readonly description: string
  readonly confidence: number
  readonly timestamp: number
}

export interface AnomalyPattern {
  readonly name: string
  readonly channels: string[]
  readonly frequency: number
  readonly severity: 'low' | 'medium' | 'high'
}

export interface InsightAnalysis {
  readonly totalActivity: number
  readonly activeChannels: number
  readonly peakThroughput: number
  readonly systemEfficiency: number
  readonly topPerformers: string[]
  readonly problemChannels: string[]
  readonly unusedChannels: string[]
  readonly resourceUtilization: number
  readonly optimizationOpportunities: OptimizationOpportunity[]
}

export interface OptimizationOpportunity {
  readonly type: 'performance' | 'reliability' | 'efficiency'
  readonly channelId: string
  readonly description: string
  readonly estimatedImpact: string
  readonly priority: 'low' | 'medium' | 'high'
}
