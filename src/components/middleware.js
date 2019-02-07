/** @format */

//@ts-check
export const middleware = {
  insert: (action, dataDefinitions) => {
    const data = {}
    action.id = action.id || null
    action.type = action.type || null
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
        console.log('middleware error')
        return {ok: false, data, message: data[attribute].message}
      }

      data[attribute].ok ? true : console.error(data[attribute].message)
      data[attribute] = data[attribute].data
    }
    return {ok: true, data}
  },

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
