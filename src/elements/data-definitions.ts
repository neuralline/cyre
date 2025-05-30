// src/elements/data-definitions.ts
// Enhanced data definitions with state reactivity options

import type {Schema} from '../schema/cyre-schema'

const dataDefinitions = {
  id: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `action.id must be a string. Received '${attribute}'`,
          required: true
        }
  },

  type: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `action.type must be a string. Received '${attribute}'`,
          required: true
        }
  },

  payload: (attribute: any = undefined) => {
    return {ok: true, payload: attribute}
  },

  // State reactivity options
  condition: (attribute: Function | undefined = undefined) => {
    if (attribute === undefined) {
      return {ok: true, payload: undefined}
    }

    if (typeof attribute === 'function') {
      return {ok: true, payload: attribute}
    }

    return {
      ok: false,
      payload: undefined,
      message: `action.condition must be a function. Received '${typeof attribute}'`,
      required: false
    }
  },

  selector: (attribute: Function | undefined = undefined) => {
    if (attribute === undefined) {
      return {ok: true, payload: undefined}
    }

    if (typeof attribute === 'function') {
      return {ok: true, payload: attribute}
    }

    return {
      ok: false,
      payload: undefined,
      message: `action.selector must be a function. Received '${typeof attribute}'`,
      required: false
    }
  },

  transform: (attribute: Function | undefined = undefined) => {
    if (attribute === undefined) {
      return {ok: true, payload: undefined}
    }

    if (typeof attribute === 'function') {
      return {ok: true, payload: attribute}
    }

    return {
      ok: false,
      payload: undefined,
      message: `action.transform must be a function. Received '${typeof attribute}'`,
      required: false
    }
  },

  // Existing definitions...
  interval: (attribute: number = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 0,
          message: `'${attribute}' invalid action.interval value`,
          required: false
        }
  },

  timeOfCreation: (attribute: number = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 0,
          message: `'${attribute}' invalid @cyre.call time of creation value`,
          required: true
        }
  },

  repeat: (attribute: any = 0) => {
    if (typeof attribute === 'number') {
      return {ok: true, payload: attribute}
    }

    if (typeof attribute === 'boolean') {
      return {ok: true, payload: attribute}
    }

    if (attribute === Infinity) {
      return {ok: true, payload: attribute}
    }

    return {
      ok: false,
      payload: 0,
      message: `'${attribute}' invalid action.repeat value. Expected number, boolean, or Infinity.`,
      required: false
    }
  },

  detectChanges: (attribute: boolean = false) => {
    return typeof attribute === 'boolean'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: false,
          message: `action.detectChanges must be a boolean. Received '${typeof attribute}'`,
          required: false
        }
  },

  debounce: (attribute: number = 0) => {
    return Number.isInteger(attribute) && attribute >= 0
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 100,
          message: `'${attribute}' action.debounce value must be a non-negative number`,
          required: false
        }
  },

  throttle: (attribute: number = 0) => {
    return Number.isInteger(attribute) && attribute >= 0
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 100,
          message: `'${attribute}' action.throttle value must be a non-negative number`,
          required: false
        }
  },

  schema: (attribute: Schema | undefined = undefined) => {
    if (attribute === undefined) {
      return {ok: true, payload: undefined}
    }

    if (typeof attribute === 'function') {
      return {ok: true, payload: attribute}
    }

    return {
      ok: false,
      payload: undefined,
      message: `action.schema must be a schema function. Received '${typeof attribute}'`,
      required: false
    }
  },

  block: (attribute: boolean = false) => {
    return typeof attribute === 'boolean'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: false,
          message: `action.block must be a boolean. Received '${typeof attribute}'`,
          required: false
        }
  },

  required: (attribute: any = false) => {
    if (typeof attribute === 'boolean') {
      return {ok: true, payload: attribute}
    }

    if (typeof attribute === 'string') {
      const validValues = ['non-empty']
      if (validValues.includes(attribute)) {
        return {ok: true, payload: attribute}
      }

      return {
        ok: false,
        payload: false,
        message: `'${attribute}' invalid action.required value. Use boolean or 'non-empty'`,
        required: false
      }
    }

    return {
      ok: false,
      payload: false,
      message: `action.required must be boolean or 'non-empty'. Received '${typeof attribute}'`,
      required: false
    }
  },

  // Internal properties
  _protectionPipeline: (attribute: any = []) => {
    return Array.isArray(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: [],
          message: `_protectionPipeline must be an array. Received '${typeof attribute}'`,
          required: false
        }
  },

  _debounceTimer: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `_debounceTimer must be a string. Received '${typeof attribute}'`,
          required: false
        }
  }
}

export default dataDefinitions
