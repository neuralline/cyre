/** @format */

//@ts-check
const dataDefinitions = {
  id: (attribute = 0) => {
    if (typeof attribute !== 'string') {
      return {
        ok: false,
        data: null,
        message: `action.id must be a string. Received '${attribute}'`,
        required: true
      }
    }

    return {ok: true, data: attribute, required: true}
  },
  type: (attribute = '') => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `action.type must be a string. Received '${attribute}'`,
          required: true
        }
  },

  payload: (attribute = null) => {
    return {ok: true, data: attribute}
  },

  interval: (attribute = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: 0,
          message: `'${attribute}' invalid action.interval value`
        }
  },

  repeat: (attribute = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: 0,
          message: `'${attribute}' invalid action.repeat value`
        }
  },

  group: (attribute = '') => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `'${attribute}' invalid action.group value`
        }
  },

  callback: (attribute = '') => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `'${attribute}' invalid action.callback value`
        }
  },

  log: (attribute = false) => {
    return typeof attribute === 'boolean'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: false,
          message: `'${attribute}' invalid action.log value`
        }
  },

  middleware: (attribute = null) => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `'${attribute}' invalid action.middleware value`
        }
  },

  at: (attribute = 0) => {
    // const at = new Date()
    return {
      ok: false,
      data: attribute,
      message: `'${attribute}'  action.at is an experimental feature, not applied yet`
    }
  }
}
export default dataDefinitions
