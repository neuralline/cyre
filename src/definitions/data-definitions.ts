//@ts-check

const defaultReturn = {
  ok: true,
  payload: null,
  message: null,
  required: false
}

const dataDefinitions = {
  id: (attribute: string = null) => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `action.id must be a string. Received '${attribute}'`,
          required: true
        }
  },
  type: (attribute: string = null) => {
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

  toc: (attribute: number = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 0,
          message: `'${attribute}' invalid @cyre.call time of creation value`,
          required: true
        }
  },
  repeat: (attribute: number = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: 0,
          message: `'${attribute}' invalid action.repeat value`,
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
  group: (attribute: string = null) => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `'${attribute}' invalid action.group value`,
          required: false
        }
  },

  callback: (attribute: string = null) => {
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

  middleware: (attribute: string = null) => {
    return typeof attribute === 'string'
      ? {ok: true, payload: attribute}
      : {
          ok: false,
          payload: null,
          message: `'${attribute}' invalid action.middleware value`,
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
