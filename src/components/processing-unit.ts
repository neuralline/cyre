/** @format */

//@ts-check
const _processingUnit = async (timeline: any, party: object, precisionAdjustment: number) => {
  let info = {timeouts: [], id: []}
  for await (const id of timeline) {
    //deduct precisionAdjustment from action.timeout
    party[id].timeout -= precisionAdjustment
    info.timeouts.push(party[id].timeout)
    info.id.push(id)
    //local.timeout <= precisionAdjustment ? callback(local) : false
    party[id] = {...party[id]}
  }
  return {ok: true, payload: [], info, party: {...party}}
}

export default _processingUnit
