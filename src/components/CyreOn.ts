const CyreOn = (events = [], fn: Function) => {
  if (typeof fn !== 'function') {
    return {ok: false, message: 'invalid function', payload: fn}
  }
  events.push(fn)

  return {
    ok: true,
    message: '@cyre.on : subscription successful',
    payload: [...events]
  }
}
export default CyreOn
