// src/components/cyre-actions.ts
// Clean pipeline application system

import {IO} from '../types/interface'

import {metricsReport} from '../context/metrics-report'
import {log} from './cyre-log'
import {middlewareState} from '../middleware/state'
import CyreChannel from './cyre-channels'
import dataDefinitions from '../elements/data-definitions'

/*

      C.Y.R.E. - A.C.T.I.O.N.S.
      
      Clean pipeline application system:
      - Loop through saved pipeline functions
      - Handle async operations (middleware, debounce)
      - Fast path for actions without pipeline
      - Proper error handling and metrics

*/

/**
 * Register single action with middleware chain compilation
 */
export const registerSingleAction = (
  attribute: IO
): {ok: boolean; message: string; payload?: any} => {
  try {
    // Validate and create channel
    const channelResult = CyreChannel(attribute, dataDefinitions)
    if (!channelResult.ok || !channelResult.payload) {
      metricsReport.sensor.error(
        attribute.id || 'unknown',
        channelResult.message,
        'action-validation'
      )
      return {ok: false, message: channelResult.message}
    }

    const validatedAction = channelResult.payload

    // Compile middleware chain during action creation
    middlewareState.setChain(validatedAction)

    // Get chain info for logging
    const isFastPath = middlewareState.isFastPath(validatedAction.id)
    const chain = middlewareState.getChain(validatedAction.id)
    const middlewareInfo = isFastPath
      ? 'fast-path (zero overhead)'
      : `${chain?.middlewares.length || 0} middleware functions`

    log.debug(`Action ${validatedAction.id} registered with ${middlewareInfo}`)

    metricsReport.sensor.log(
      validatedAction.id,
      'info',
      'action-registration',
      {
        middlewareCount: chain?.middlewares.length || 0,
        isFastPath,
        middlewareInfo
      }
    )

    return {
      ok: true,
      message: `Action registered with ${middlewareInfo}`,
      payload: validatedAction
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register action ${attribute.id}: ${msg}`)
    metricsReport.sensor.error(
      attribute.id || 'unknown',
      msg,
      'action-registration'
    )
    return {ok: false, message: msg}
  }
}
