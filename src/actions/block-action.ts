import {CyreResponse} from './../types/core'
// src/actions/block-action.ts
import {metricsState} from '../context/metrics-state'
import {ActionPipelineFunction} from '../types/core'

/**
 * Repeat zero check - don't execute actions with repeat: 0
 */
export const useBlock: ActionPipelineFunction = (
  action,
  payload,
  timer,
  next
): CyreResponse => {
  if (action.repeat === 0 || !action.id) {
    return {
      ok: false,
      payload: null,
      message: 'Call blocked'
    }
  }
  return {
    ok: true,
    payload: null,
    message: `from block action`
  }
}

/**
 * System recuperation check - only critical actions during recuperation
 */
export const useRecuperation: ActionPipelineFunction = (
  action,
  payload,
  timer,
  next
) => {
  const {breathing} = metricsState.get()
  if (breathing.isRecuperating && action.priority?.level !== 'critical') {
    return {
      ok: false,
      payload: null,
      message: `System recuperating. Only critical actions allowed.`
    }
  }
  return {
    ok: true,
    payload: null,
    message: `System is fine`
  }
}
