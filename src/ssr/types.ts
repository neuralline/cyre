// src/ssr/ssr-types.ts

/**
 * Result of SSR preparation
 */
export interface SSRResult {
  /** Serializable state to be transferred to client */
  state: Record<string, any>
  /** Rendered HTML (if rendering was performed) */
  html?: string
  /** Timing information for performance analysis */
  timing?: {
    start: number
    render: number
    total: number
  }
}

/**
 * Options for SSR preparation
 */
export interface SSROptions {
  /**
   * Whether to collect action dependencies (actions registered during render)
   * Default: true
   */
  collectDependencies?: boolean

  /**
   * Whether to restore original actions after SSR
   * Default: true
   */
  restoreActions?: boolean

  /**
   * Whether to include timing information in result
   * Default: false
   */
  includeTiming?: boolean

  /**
   * Custom state serializer
   * Default: JSON.stringify
   */
  serialize?: (state: Record<string, any>) => string

  /**
   * Custom state deserializer
   * Default: JSON.parse
   */
  deserialize?: (serialized: string) => Record<string, any>

  /**
   * Function to determine if an action should be included in SSR state
   * Default: include all registered actions
   */
  shouldIncludeAction?: (id: string, payload: any) => boolean

  /**
   * Custom error handler
   */
  onError?: (error: Error) => void
}

/**
 * Context tracking SSR state
 */
export interface SSRContext {
  /** Actions registered during SSR */
  registeredActions: Set<string>
  /** Original actions backup */
  originalActions: Map<string, any>
  /** Start time of SSR process */
  startTime: number
  /** Time when rendering completed */
  renderTime: number
  /** Options used for this SSR process */
  options: SSROptions
}

/**
 * Hydration options
 */
export interface HydrationOptions {
  /**
   * Custom state deserializer
   * Default: JSON.parse
   */
  deserialize?: (serialized: string) => Record<string, any>

  /**
   * Function to transform state before hydration
   */
  transformState?: (state: Record<string, any>) => Record<string, any>

  /**
   * Whether to log hydration process
   * Default: false
   */
  verbose?: boolean

  /**
   * Custom error handler
   */
  onError?: (error: Error) => void
}
