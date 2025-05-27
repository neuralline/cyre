// src/context/pipeline-state.ts
// Functional state management for compiled pipelines

import {createStore} from './create-store'
import type {CompiledPipeline} from '../pipeline/pipeline-compiler'

/*

      C.Y.R.E. - P.I.P.E.L.I.N.E. - S.T.A.T.E.
      
      Functional state management for compiled pipelines:
      - Cache compiled pipelines for optimal performance
      - Hash-based cache invalidation
      - Pipeline statistics and debugging
      - Functional architecture with no OOP

*/

// Pipeline store with compiled pipelines
interface PipelineStats {
  totalPipelines: number
  hitRate: number
  cacheHits: number
  cacheMisses: number
}

const pipelineStore = createStore<CompiledPipeline>()
let cacheHits = 0
let cacheMisses = 0

export const pipelineState = {
  get: (actionId: string): CompiledPipeline | undefined => {
    const result = pipelineStore.get(actionId)
    if (result) {
      cacheHits++
    } else {
      cacheMisses++
    }
    return result
  },

  set: (pipeline: CompiledPipeline): void => {
    pipelineStore.set(pipeline.channelId, pipeline)
  },

  has: (actionId: string, verificationHash?: string): boolean => {
    const pipeline = pipelineStore.get(actionId)
    if (!pipeline) return false
    if (verificationHash && pipeline.verificationHash !== verificationHash) {
      return false
    }
    return true
  },

  forget: (actionId: string): boolean => {
    return pipelineStore.forget(actionId)
  },

  clear: (): void => {
    pipelineStore.clear()
    cacheHits = 0
    cacheMisses = 0
  },

  getAll: (): CompiledPipeline[] => {
    return pipelineStore.getAll()
  },

  getStats: (): PipelineStats => {
    const total = cacheHits + cacheMisses
    return {
      totalPipelines: pipelineStore.getAll().length,
      hitRate: total > 0 ? (cacheHits / total) * 100 : 0,
      cacheHits,
      cacheMisses
    }
  },

  debug: {
    getPipelineDetails: (actionId: string) => {
      const pipeline = pipelineStore.get(actionId)
      if (!pipeline) return null

      return {
        id: pipeline.channelId,
        isFastPath: pipeline.isFastPath,
        requiresTimekeeper: pipeline.requiresTimekeeper,
        category: pipeline.performance.category,
        expectedOverhead: pipeline.performance.expectedOverhead,
        flags: pipeline.flags,
        verification: pipeline.verification,
        compiledAt: pipeline.compiledAt
      }
    }
  }
}
