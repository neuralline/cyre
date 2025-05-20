// src/ssr/ssr-context.ts

import {SSRContext, SSROptions} from './types'

/**
 * Default SSR options
 */
export const defaultSSROptions: SSROptions = {
  collectDependencies: true,
  restoreActions: true,
  includeTiming: false,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  shouldIncludeAction: () => true
}

/**
 * Creates a new SSR context
 */
export function createSSRContext(options: SSROptions = {}): SSRContext {
  return {
    registeredActions: new Set<string>(),
    originalActions: new Map<string, any>(),
    startTime: Date.now(),
    renderTime: 0,
    options: {
      ...defaultSSROptions,
      ...options
    }
  }
}

/**
 * Current SSR context (used for tracking across async boundaries)
 */
let currentContext: SSRContext | null = null

/**
 * Sets the current SSR context
 */
export function setSSRContext(context: SSRContext | null): void {
  currentContext = context
}

/**
 * Gets the current SSR context
 */
export function getSSRContext(): SSRContext | null {
  return currentContext
}
