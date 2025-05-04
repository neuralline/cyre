/**
 * Environment detection utilities for consistent cross-platform behavior
 */

// Check if running in Node.js environment
export const isNode =
  typeof process !== 'undefined' &&
  process.versions !== undefined &&
  process.versions.node !== undefined

// Check if running in browser environment
export const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined'

// Check if running in test environment
export const isTest =
  typeof process !== 'undefined' &&
  process.env !== undefined &&
  process.env.NODE_ENV === 'test'

// Check if running in production environment
export const isProduction =
  typeof process !== 'undefined' &&
  process.env !== undefined &&
  process.env.NODE_ENV === 'production'

// Safe access to performance API (handles Node.js and browser)
export const getPerformanceNow = (): number => {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now()
  }
  return Date.now()
}

// Safe crypto access for generating IDs
export const generateUUID = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  // Simple fallback for environments without crypto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Safe setTimeout that respects browser/Node.js environments
export const safeSetTimeout = (
  callback: () => void,
  delay: number
): NodeJS.Timeout => {
  return setTimeout(callback, delay) as unknown as NodeJS.Timeout
}

// Safe event handling for cleanup
export const addCleanupEvent = (callback: () => void): void => {
  if (isBrowser) {
    window.addEventListener('beforeunload', callback)
  } else if (isNode) {
    process.on('SIGINT', callback)
    process.on('SIGTERM', callback)
  }
}

export const removeCleanupEvent = (callback: () => void): void => {
  if (isBrowser) {
    window.removeEventListener('beforeunload', callback)
  } else if (isNode) {
    process.off('SIGINT', callback)
    process.off('SIGTERM', callback)
  }
}
