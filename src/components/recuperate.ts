/**
 * @format
 * @param {object} result
 * @param {number} value
 */

const _recuperate = (result: {payload: []; ok: false}, value: number = 0) => {
  let res = result.ok
    ? result.data
        .sort((a, b) => {
          return b - a
        })
        .reverse()
    : [value]
  return {...result, payload: res[0] || res[1] || 0}
}
export default _recuperate
