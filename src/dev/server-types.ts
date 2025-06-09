// src/types/metrics-server.ts
// Type definitions for metrics server

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
