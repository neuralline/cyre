// src/context/pipeline-state.ts

import {createStore} from './create-store'
import type {ActionPipelineFunction} from '../types/interface'
import type {StateKey} from '../types/interface'

/*

      C.Y.R.E - P.I.P.E.L.I.N.E - S.T.A.T.E
      
      Functional state management for compiled action pipelines:
      - Store compiled pipelines per action during action creation
      - Fast path detection for actions without pipeline
      - Zero overhead for simple actions
      - Pipeline invalidation and cleanup

*/

// Pipeline store - maps action ID to pipeline functions
const pipelineStore = createStore<ActionPipelineFunction[]>()

// Fast path tracking - actions with no pipeline
const fastPathActions = new Set<StateKey>()

/**
 * Store compiled pipeline for an action
 */
const setPipeline = (
  actionId: StateKey,
  pipeline: ActionPipelineFunction[]
): void => {
  if (!pipeline || pipeline.length === 0) {
    // Mark as fast path action
    fastPathActions.add(actionId)
    // Don't store empty pipeline
    pipelineStore.forget(actionId)
  } else {
    // Remove from fast path if it was there
    fastPathActions.delete(actionId)
    // Store the pipeline
    pipelineStore.set(actionId, pipeline)
  }
}

/**
 * Get compiled pipeline for an action
 */
const getPipeline = (
  actionId: StateKey
): ActionPipelineFunction[] | undefined => {
  if (fastPathActions.has(actionId)) {
    return undefined // Fast path - no pipeline
  }
  return pipelineStore.get(actionId)
}

/**
 * Check if action uses fast path (no pipeline)
 */
const isFastPath = (actionId: StateKey): boolean => {
  return fastPathActions.has(actionId)
}

/**
 * Check if action has pipeline
 */
const hasPipeline = (actionId: StateKey): boolean => {
  return pipelineStore.get(actionId) !== undefined
}

/**
 * Remove pipeline for an action
 */
const forgetPipeline = (actionId: StateKey): boolean => {
  fastPathActions.delete(actionId)
  return pipelineStore.forget(actionId)
}

/**
 * Clear all pipelines
 */
const clearPipelines = (): void => {
  pipelineStore.clear()
  fastPathActions.clear()
}

/**
 * Get pipeline statistics
 */
const getStats = () => {
  const allPipelines = pipelineStore.getAll()
  const totalActions = allPipelines.length + fastPathActions.size

  return {
    totalActions,
    fastPathActions: fastPathActions.size,
    pipelineActions: allPipelines.length,
    fastPathPercentage:
      totalActions > 0
        ? Math.round((fastPathActions.size / totalActions) * 100)
        : 0
  }
}

/**
 * Export pipeline state interface
 */
export const pipelineState = {
  set: setPipeline,
  get: getPipeline,
  has: hasPipeline,
  isFastPath,
  forget: forgetPipeline,
  clear: clearPipelines,
  getStats
}
