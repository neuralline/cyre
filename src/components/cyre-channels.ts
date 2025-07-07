// src/components/cyre-channels.ts
// Focused channel creation - only handles ID, existence, and defaults

import {io} from '../context/state'
import {IO} from '../types/core'
import {log} from './cyre-log'
import {MSG} from '../config/cyre-config'
import payloadState from '../context/payload-state'

/*

      C.Y.R.E - C.H.A.N.N.E.L.S

      Focused channel creation with clear responsibilities:
      - Validate ID requirements
      - Check if channel already exists  
      - Set basic defaults (payload, timestamp, type)
      - Store in state

*/

type ChannelResult = {
  ok: boolean
  message?: string
  payload?: IO
}

/**
 * Validate channel ID requirements
 */
const validateChannelId = (id: any): {valid: boolean; error?: string} => {
  // Check existence first
  if (id === undefined || id === null) {
    return {valid: false, error: 'Channel ID cannot be empty'}
  }

  // Check type
  if (typeof id !== 'string') {
    return {valid: false, error: MSG.CHANNEL_INVALID_TYPE}
  }

  // Check if empty string
  if (id.trim().length === 0) {
    return {valid: false, error: 'Channel ID cannot be empty'}
  }

  return {valid: true}
}

/**
 * Check if channel already exists
 */
const checkChannelExists = (id: string): boolean => {
  return io.get(id) !== undefined
}

/**
 * Set channel defaults
 */
const setChannelDefaults = (channel: IO): IO => {
  const now = Date.now()

  return {
    ...channel,
    // Type is a group/category - don't default to ID
    type: channel.type, // Keep undefined if not provided
    payload: channel.payload !== undefined ? channel.payload : undefined,
    _timestamp: now,
    _timeOfCreation: channel._timeOfCreation || now,
    _executionDuration: 0,
    _lastExecTime: 0,
    _executionCount: 0,
    _debounceTimer: undefined
  }
}

/**
 * Focused channel creation - handles only core channel concerns
 */
export const CyreChannel = (action: IO): ChannelResult => {
  try {
    // 1. Validate ID requirements
    const idValidation = validateChannelId(action.id)
    if (!idValidation.valid) {
      log.error(idValidation.error!)
      return {
        ok: false,
        message: idValidation.error!
      }
    }

    // 2. Check if channel exists (log but don't fail)
    const exists = checkChannelExists(action.id)
    // if (exists) {
    //   log.debug(`Channel ${action.id} already exists - updating`)
    // }

    // 3. Set defaults and prepare channel
    const preparedChannel = setChannelDefaults(action)

    // 4. Store channel
    io.set(preparedChannel)
    payloadState.set(preparedChannel.id, preparedChannel.payload, 'initial')

    const message = exists ? 'Channel updated' : MSG.CHANNEL_CREATED

    return {
      ok: true,
      message,
      payload: preparedChannel
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Channel processing failed: ${errorMessage}`)
    return {
      ok: false,
      message: MSG.CHANNEL_CREATION_FAILED
    }
  }
}

export default CyreChannel
