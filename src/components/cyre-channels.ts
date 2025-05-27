// src/components/cyre-channel.ts
// Channel creation, validation, and management

import {io} from '../context/state'
import {IO} from '../types/interface'
import {log} from './cyre-log'
import {MSG} from '../config/cyre-config'
import {metricsReport} from '../context/metrics-report'
import dataDefinitions from '../elements/data-definitions'
import {middlewareState} from '../middleware/state'

/*

      C.Y.R.E. - C.H.A.N.N.E.L.S.

*/

// type definitions
type ValidationResult = {
  isValid: boolean
  error?: string
}

type ChannelResult = {
  ok: boolean
  message?: string
  payload?: IO
}

type DataDefinitionResult = {
  ok: boolean
  payload: any
  message?: string
  required?: boolean
}

type DataDefinition = (value: any) => DataDefinitionResult
type DataDefinitions = Record<string, DataDefinition>

// Type guard functions
const isValidChannel = (value: unknown): value is IO => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as IO).id === 'string' &&
    (value as IO).id.length > 0
  )
}

// Validation functions with proper error handling
const validateChannel = (channel: IO): ValidationResult => {
  if (!channel) {
    return {isValid: false, error: MSG.CHANNEL_INVALID_STRUCTURE}
  }

  if (!channel.id) {
    return {isValid: false, error: MSG.CHANNEL_MISSING_ID}
  }

  if (!channel.type && !channel.id) {
    return {isValid: false, error: MSG.CHANNEL_MISSING_TYPE}
  }

  if (channel.type && typeof channel.type !== 'string') {
    return {isValid: false, error: MSG.CHANNEL_INVALID_TYPE}
  }

  return {isValid: true}
}

/**
 * Register single action with middleware chain compilation
 */

// Process data definitions with improved error handling
const processDataDefinitions = (
  channel: IO,
  definitions: DataDefinitions
): ChannelResult => {
  try {
    const processedData = {...channel}
    const errors: string[] = []

    // Process each channel property against its definition
    for (const [key, value] of Object.entries(channel)) {
      const definition = definitions[key]

      if (!definition) {
        processedData[key] = value
        continue
      }

      const result = definition(value)

      if (!result.ok) {
        if (result.required) {
          return {
            ok: false,
            message: `Required field '${key}' validation failed: ${result.message}`,
            payload: processedData
          }
        }
        errors.push(`${key}: ${result.message}`)
      }

      processedData[key] = result.payload
    }

    // Check for required definitions that weren't provided
    for (const [key, def] of Object.entries(definitions)) {
      const result = def(undefined)
      if (result.required && !(key in channel)) {
        return {
          ok: false,
          message: `Missing required field: ${key}`,
          payload: processedData
        }
      }
    }

    if (errors.length > 0) {
      return {
        ok: false,
        message: errors.join('; '),
        payload: processedData
      }
    }

    return {
      ok: true,
      payload: processedData
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Data definition processing failed: ${errorMessage}`)
    return {
      ok: false,
      message: MSG.CHANNEL_INVALID_DEFINITION
    }
  }
}

// Prepare channel with proper typing
const prepareChannel = (channel: IO): IO => {
  const now = Date.now()
  return {
    ...channel,
    type: channel.type || channel.id,
    timestamp: now,
    interval: channel.interval || 0,
    timeOfCreation: channel.timeOfCreation || now
  }
}

// Validate channel against definitions
const validateDefinitions = (
  channel: IO,
  definitions: DataDefinitions
): boolean => {
  if (!definitions) return true

  const requiredDefinitions = Object.entries(definitions)
    .filter(([_, def]) => def(undefined).required)
    .map(([key]) => key)

  return requiredDefinitions.every(key => key in channel)
}

/**
 * CyreChannel factory function with improved type safety and error handling
 * @param channel - The channel configuration object
 * @param definitions - Data definitions for validation
 * @returns Channel result object with status and payload
 */
export const CyreChannel = (
  channel: IO,
  definitions: DataDefinitions
): ChannelResult => {
  try {
    // Type guard check
    if (!isValidChannel(channel)) {
      log.error(MSG.CHANNEL_INVALID_STRUCTURE)
      return {
        ok: false,
        message: MSG.CHANNEL_INVALID_STRUCTURE
      }
    }

    // Validate basic channel structure
    const validation = validateChannel(channel)
    if (!validation.isValid) {
      log.error(validation.error || 'Unknown validation error')
      return {
        ok: false,
        message: validation.error || 'Unknown validation error'
      }
    }

    // Validate against definitions
    if (!validateDefinitions(channel, definitions)) {
      log.error(MSG.CHANNEL_INVALID_DEFINITION)
      return {
        ok: false,
        message: MSG.CHANNEL_INVALID_DEFINITION
      }
    }

    // Process data definitions
    const definitionResult = processDataDefinitions(channel, definitions)
    if (!definitionResult.ok) {
      return definitionResult
    }

    // Prepare final channel
    const preparedChannel = prepareChannel({
      ...definitionResult.payload,
      id: channel.id
    })

    // Store the channel
    io.set(preparedChannel)

    // Log success
    log.debug(`${MSG.CHANNEL_CREATED}: ${channel.id}`)

    return {
      ok: true,
      message: MSG.CHANNEL_CREATED,
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
