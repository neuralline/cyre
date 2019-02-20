/** @format */

//@ts-check
export const middleware = {
  /**
   *@param{object} action cyre.action
   *@param{object} dataDefinitions action attributes
  
  */
  insert: (action, dataDefinitions) => {
    const data = {}
    action.id = action.id || null
    action.type = action.type || action.id
    for (const attribute in action) {
      data[attribute] = dataDefinitions[attribute]
        ? dataDefinitions[attribute](action[attribute])
        : {
            ok: false,
            data: null,
            message: `'${attribute}' data definition not found`,
            required: false
          }

      if (!data[attribute].ok && data[attribute].required) {
        return {ok: false, data, message: data[attribute].message}
      }

      data[attribute].ok ? true : console.error(data[attribute].message)
      data[attribute] = data[attribute].data
    }
    return {ok: true, data}
  },

  /**
   *@param{object} action cyre.action
   *@param{object} dataDefinitions action attributes
  
  */

  update: (action, dataDefinitions) => {
    const data = {}
    for (const attribute in action) {
      data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false
      data[attribute].ok ? true : console.error(data[attribute].message)
      data[attribute] = data[attribute].data
    }
    return {ok: true, data}
  }
}
export default middleware
