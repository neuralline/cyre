/** @format */

//@ts-check
const _processingUnit = async (
  timeline: any,
  bot: object,
  precisionAdjustment: number
) => {
  let info = {timeouts: [], id: []}
  for await (const id of timeline) {
    //deduct precisionAdjustment from action.timeout
    bot[id].timeout -= precisionAdjustment
    info.timeouts.push(bot[id].timeout)
    info.id.push(id)
    //local.timeout <= precisionAdjustment ? callback(local) : false
    bot[id] = {...bot[id]}
  }
  return {ok: true, payload: [], info, bot: {...bot}}
}

export default _processingUnit
