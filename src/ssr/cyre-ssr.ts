// src/ssr/cyre-ssr.ts

import {cyre} from '../app'
import {log} from '../components/cyre-log'
import type {IO} from '../types/interface'
import {SSRResult, SSROptions, HydrationOptions} from './types'
import {
  createSSRContext,
  setSSRContext,
  getSSRContext,
  defaultSSROptions
} from './ssr-context'

/**
 * Prepares CYRE for server-side rendering
 *
 * @param renderFn Function that performs rendering (and registers CYRE actions)
 * @param options SSR configuration options
 * @returns SSR result with serializable state
 */
export async function prepareSSR<T = any>(
  renderFn: () => Promise<T> | T,
  options: SSROptions = {}
): Promise<SSRResult & {result?: T}> {
  // Initialize context
  const context = createSSRContext(options)
  setSSRContext(context)

  // Store original action method
  const originalAction = cyre.action

  try {
    // Patch cyre.action to track registered actions
    if (context.options.collectDependencies) {
      cyre.action = function (attribute: IO | IO[]) {
        // Call original first to ensure action is registered
        const result = originalAction(attribute)

        // Track registered actions
        if (Array.isArray(attribute)) {
          attribute.forEach(item => {
            if (item.id) {
              context.registeredActions.add(item.id)

              // Backup original action if not already backed up
              if (!context.originalActions.has(item.id)) {
                context.originalActions.set(item.id, {...item})
              }
            }
          })
        } else if (attribute.id) {
          context.registeredActions.add(attribute.id)

          // Backup original action if not already backed up
          if (!context.originalActions.has(attribute.id)) {
            context.originalActions.set(attribute.id, {...attribute})
          }
        }

        return result
      }
    }

    // Execute render function
    const renderResult = await renderFn()

    // Mark render completion time
    context.renderTime = Date.now()

    // Collect state from registered actions
    const state = Array.from(context.registeredActions).reduce((acc, id) => {
      const action = cyre.get(id)

      if (action?.payload !== undefined) {
        // Check if this action should be included
        if (
          context.options.shouldIncludeAction?.(id, action.payload) !== false
        ) {
          try {
            // Try to serialize the payload to catch non-serializable values
            const testSerialization = JSON.stringify(action.payload)
            acc[id] = action.payload
          } catch (error) {
            log.warn(
              `SSR: Action payload for '${id}' is not serializable and will be omitted`
            )
          }
        }
      }

      return acc
    }, {} as Record<string, any>)

    // Prepare timing information if requested
    const timing = context.options.includeTiming
      ? {
          start: context.startTime,
          render: context.renderTime,
          total: Date.now() - context.startTime
        }
      : undefined

    return {
      state,
      html: typeof renderResult === 'string' ? renderResult : undefined,
      result: renderResult,
      timing
    }
  } catch (error) {
    // Handle render errors
    log.error('SSR rendering failed:', error)
    context.options.onError?.(
      error instanceof Error ? error : new Error(String(error))
    )

    // Return empty state in case of error
    return {
      state: {},
      html: undefined
    }
  } finally {
    // Restore original action method
    cyre.action = originalAction

    // Restore original actions if requested
    if (context.options.restoreActions) {
      Array.from(context.originalActions.entries()).forEach(([id, action]) => {
        cyre.action(action)
      })
    }

    // Clear context
    setSSRContext(null)
  }
}

/**
 * Hydrates CYRE from server-side rendered state
 *
 * @param state State object from SSR result
 * @param options Hydration configuration options
 */
export function hydrateFromSSR(
  state: Record<string, any> | string,
  options: HydrationOptions = {}
): void {
  try {
    // Parse state if needed
    const parsedState =
      typeof state === 'string'
        ? (options.deserialize || JSON.parse)(state)
        : state

    // Apply transformations if specified
    const finalState = options.transformState
      ? options.transformState(parsedState)
      : parsedState

    // Log hydration if verbose
    if (options.verbose) {
      log.info('Hydrating CYRE with state:', finalState)
    }

    // Register each action with its state
    Object.entries(finalState).forEach(([id, payload]) => {
      cyre.action({
        id,
        payload
      })

      if (options.verbose) {
        log.debug(`Hydrated action '${id}' with payload:`, payload)
      }
    })

    if (options.verbose) {
      log.info(
        `Hydration complete: ${Object.keys(finalState).length} actions hydrated`
      )
    }
  } catch (error) {
    // Handle hydration errors
    log.error('Failed to hydrate CYRE:', error)
    options.onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Creates a serialized state string from a state object
 *
 * @param state State object from SSR result
 * @param serializeFn Custom serialization function (default: JSON.stringify)
 * @returns Serialized state string
 */
export function serializeState(
  state: Record<string, any>,
  serializeFn = JSON.stringify
): string {
  try {
    return serializeFn(state)
  } catch (error) {
    log.error('Failed to serialize state:', error)
    throw error
  }
}

/**
 * Utility to generate HTML with embedded state
 *
 * @param html HTML content to wrap
 * @param state State object to embed
 * @param options Additional options
 * @returns Complete HTML document with embedded state
 */
export function generateHTML(
  html: string,
  state: Record<string, any>,
  options: {
    stateVarName?: string
    serialize?: (state: Record<string, any>) => string
    title?: string
    scripts?: string[]
    styles?: string[]
    bodyAttributes?: string
    htmlAttributes?: string
  } = {}
): string {
  const {
    stateVarName = '__CYRE_STATE__',
    serialize = JSON.stringify,
    title = 'CYRE Application',
    scripts = [],
    styles = [],
    bodyAttributes = '',
    htmlAttributes = ''
  } = options

  // Serialize state
  const serializedState = serialize(state)

  // Generate script tags
  const scriptTags = scripts
    .map(src => `<script src="${src}"></script>`)
    .join('\n    ')

  // Generate style tags
  const styleTags = styles
    .map(href => `<link rel="stylesheet" href="${href}">`)
    .join('\n    ')

  return `<!DOCTYPE html>
<html ${htmlAttributes}>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${styleTags}
    <script>window.${stateVarName} = ${serializedState};</script>
  </head>
  <body ${bodyAttributes}>
    <div id="app">${html}</div>
    ${scriptTags}
  </body>
</html>`
}
