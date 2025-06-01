// src/elements/type-definitions.ts

const response = {
  ok: false,
  payload: null,
  message: null,
  required: false
}

const typeDefinitions = {
  id: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ...response,
          message: `action.id must be a string. Received '${attribute}'`,
          required: true
        }
  },

  payload: (attribute: Function = () => {}) => {
    return typeof attribute === 'function'
      ? {ok: true, payload: attribute}
      : {
          ...response,
          message: `action.type must be a string. Received '${attribute}'`,
          required: true
        }
  },

  timeOfCreation: (attribute: number = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, payload: attribute}
      : {
          ...response,
          message: `'${attribute}' invalid @cyre.call time of creation value`
        }
  },

  message: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ...response,
          message: `action.message must be a string. Received '${attribute}'`
        }
  },

  /**
   * feature attributes
   */
  group: (attribute: string = '') => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ...response,
          message: `'${attribute}' invalid action.group value`
        }
  }
}
export default typeDefinitions
