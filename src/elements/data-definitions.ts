// src/elements/data-definitions.ts

// - Updated to better handle boolean values

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

  payload: (attribute: any = null) => {
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

  // Updated to properly handle boolean values for repeat
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

  /**
   * feature attributes
   */
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

  middleware: (attribute: any = []) => {
    // Check if it's an array
    if (Array.isArray(attribute)) {
      return {
        ok: true,
        payload: attribute
      }
    }

    // Handle string case for backward compatibility
    if (typeof attribute === 'string') {
      return {
        ok: true,
        payload: [attribute]
      }
    }

    // Invalid value
    return {
      ok: false,
      payload: [],
      message: `'${attribute}' invalid action.middleware value`,
      required: false
    }
  },

  throttle: (attribute: number = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 100,
          message: `'${attribute}'  action.throttle value must be a number`,
          required: false
        }
  },

  debounce: (attribute: number = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 100,
          message: `'${attribute}'  action.debounce value must be a number`,
          required: false
        }
  },

  at: (attribute: number = 0) => {
    // const at = new Date()
    return {
      ok: false,
      payload: attribute,
      message: `'${attribute}'  action.at is an experimental feature, not applied yet`,
      required: false
    }
  }
}
export default dataDefinitions
