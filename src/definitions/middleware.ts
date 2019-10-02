//@ts-check

import {Party, Events} from '../interfaces/interface'
import {CyreError} from '../components/CyreLog'
export const middleware = {
  /**
   *@param{object} action cyre.action
   *@param{object} dataDefinitions action attributes
  
  */
  insert: (action: Party, dataDefinitions: Party) => {
    const data = {}
    for (const attribute in action) {
      data[attribute] = dataDefinitions[attribute]
        ? dataDefinitions[attribute](action[attribute])
        : {
            ok: false,
            payload: null,
            message: `'${attribute}' data definition not found`,
            required: false
          }
      if (!data[attribute].ok && data[attribute].required) {
        CyreError('required :' + data)
        return {
          ok: false,
          payload: data,
          message: data[attribute].message
        }
      }

      data[attribute].ok ? true : CyreError(data[attribute])
      data[attribute] = data[attribute].payload
    }
    return {ok: true, message: 'channel created', payload: data}
  },

  /**
   *@param{object} action cyre.action
   *@param{object} dataDefinitions action attributes
  
  */

  update: (action, dataDefinitions) => {
    const data = {}
    for (const attribute in action) {
      data[attribute] = dataDefinitions[attribute]
        ? dataDefinitions[attribute](action[attribute])
        : false
      data[attribute].ok
        ? true
        : console.error(data[attribute].message)
      data[attribute] = data[attribute].data
    }
    return {ok: true, message: 'channel updated', payload: data}
  }
}
export default middleware
