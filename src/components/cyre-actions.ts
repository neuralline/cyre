// src/components/cyre-actions.ts
// Streamlined action registration with compile-pipeline integration

import {sensor} from '../context/metrics-report'
import type {IO} from '../types/core'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {io} from '../context/state'
import {pathEngine} from '../schema/path-engine'
import {compileAction} from '../schema/compile-pipeline'

/*

      C.Y.R.E - A.C.T.I.O.N.S

      Streamlined registration with compile-pipeline:
      1. Validate ID and compile action
      2. Handle blocking conditions immediately
      3. Store action and index paths
      4. Report results with metrics

*/

interface RegistrationResult {
  ok: boolean
  message: string
  payload?: IO
  errors?: string[]
  warnings?: string[]
  compilationTime?: number
  hasFastPath?: boolean
}

export const CyreActions = (action: IO): RegistrationResult => {
  const startTime = performance.now()

  try {
    // 1. VALIDATE ID AND COMPILE ACTION
    if (!action.id) {
      log.error('Channel creation failed: Channel ID is required')
      sensor.error('unknown', 'Channel ID is required', 'cyre-action')
      return {
        ok: false,
        message: 'Channel creation failed: Channel ID is required',
        errors: ['Channel ID is required'],
        compilationTime: performance.now() - startTime
      }
    }

    const compilation = compileAction(action)
    const compilationTime = performance.now() - startTime

    // 2. HANDLE BLOCKING CONDITIONS IMMEDIATELY
    if (compilation.block || compilation.errors.length > 0) {
      const errorMessage = compilation.errors.join(', ')

      //log.error(`Channel creation failed for ${action.id}: ${errorMessage}`)
      sensor.error(action.id, errorMessage, 'compilation-blocked')
      sensor.error(compilation.errors)
      sensor.warn(compilation.warnings)

      // Store blocked action for reference
      if (compilation.compiledAction._isBlocked) {
        io.set(compilation.compiledAction)
      }

      return {
        ok: false,
        message: `Channel creation failed: ${errorMessage}`,
        payload: compilation.compiledAction,
        errors: compilation.errors,
        warnings: compilation.warnings,
        compilationTime
      }
    }

    const finalAction = compilation.compiledAction

    // 3. STORE ACTION AND INDEX PATHS
    try {
      // Store compiled action
      io.set(finalAction)

      // Index path if provided
      if (finalAction.path && pathEngine.isValidPath(finalAction.path)) {
        pathEngine.add(finalAction.id, finalAction.path)
      }

      // Initialize payload state if provided
      if ('payload' in action && action.payload !== undefined) {
        payloadState.set(finalAction.id, action.payload, 'initial')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      log.error(`Channel storage failed for ${finalAction.id}: ${errorMessage}`)
      sensor.error(finalAction.id, errorMessage, 'storage-failed')

      return {
        ok: false,
        message: `Channel creation failed: ${errorMessage}`,
        errors: [errorMessage],
        compilationTime
      }
    }

    // 4. REPORT SUCCESS WITH METRICS
    const exists = !!io.get(action.id)
    const actionMessage = exists ? 'Action updated' : 'Action registered'

    // Build status message
    let statusMsg: string
    if (finalAction._hasFastPath) {
      statusMsg = 'Fast path (optimized)'
    } else {
      const features: string[] = []
      if (finalAction._hasProtections) features.push('protections')
      if (finalAction._hasProcessing) {
        const talentCount = finalAction._processingTalents?.length || 0
        features.push(`${talentCount} processing talents`)
      }
      if (finalAction._hasScheduling) features.push('scheduling')
      statusMsg = features.join(', ')
    }

    // Add path info if available
    if (finalAction.path) {
      statusMsg += ` (path: ${finalAction.path})`
    }

    // Add compilation time for slow compilations
    if (compilationTime > 5) {
      statusMsg += ` [${compilationTime.toFixed(1)}ms compilation]`
    }

    return {
      ok: true,
      message: `${actionMessage}: ${statusMsg}`,
      payload: finalAction,
      warnings: compilation.warnings,
      compilationTime,
      hasFastPath: finalAction._hasFastPath
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const totalTime = performance.now() - startTime

    log.error(
      `Channel creation failed for ${action?.id || 'unknown'}: ${errorMessage}`
    )
    sensor.error(
      action?.id || 'unknown',
      errorMessage,
      'registration-exception'
    )

    return {
      ok: false,
      message: `Channel creation failed: ${errorMessage}`,
      errors: [errorMessage],
      compilationTime: totalTime
    }
  }
}
