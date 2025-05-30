// src/elements/data-definitions.ts
// Action data definitions with schema validation support

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

  message: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: '',
          message: `action.message must be a string. Received '${attribute}'`,
          required: false
        }
  },

  group: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `'${attribute}' invalid action.group value`,
          required: false
        }
  },

  callback: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `'${attribute}' invalid action.callback value`,
          required: false
        }
  },

  _debounceTimer: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `'${attribute}' invalid action._debounceTimer value`,
          required: false
        }
  },

  log: (attribute: boolean = false) => {
    return typeof attribute === 'boolean'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: false,
          message: `'${attribute}' invalid action.log value`,
          required: false
        }
  },

  _protectionPipeline: (attribute: any = []) => {
    return Array.isArray(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: [],
          message: `'${attribute}' invalid action._protectionPipeline value`,
          required: false
        }
  },

  _bypassDebounce: (attribute: boolean = false) => {
    return typeof attribute === 'boolean'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: false,
          message: `'${attribute}' invalid action._bypassDebounce value`,
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

  maxWait: (attribute: number = 0) => {
    return Number.isInteger(attribute) && attribute >= 0
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 0,
          message: `'${attribute}' action.maxWait value must be a non-negative number`,
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

  at: (attribute: number = 0) => {
    return {
      ok: false,
      payload: attribute,
      message: `'${attribute}'  action.at is an experimental feature, not applied yet`,
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
      message: `'${attribute}' action.required must be boolean or 'non-empty'`,
      required: false
    }
  },

  block: (attribute: boolean = false) => {
    return typeof attribute === 'boolean'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: false,
          message: `'${attribute}' action.block must be a boolean`,
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
      message: `'${attribute}' invalid action.schema value. Must be a schema function`,
      required: false
    }
  }
}

export default dataDefinitions
