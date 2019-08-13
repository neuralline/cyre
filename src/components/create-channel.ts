import middleware from './middleware'
import {Party, Events} from '../interfaces/interface'
/**
 * @format
 * @param {object} action action cyre.action
 * @param {object} dataDefinitions$$1 data definitions for available action attributes
 */

const createChannel = (party: Party, dataDefinitions) => {
  party.type ? false : (party.type = party.id)
  const condition = party ? 'insert' : 'update'
  const result: {payload?: any; message?: string; ok: boolean} = middleware[condition](party, dataDefinitions)
  if (!result.ok) {
    //console.error(`@Cyre : Action could not be created for '${action.id}' ${result.message}`)
    return {ok: false, payload: condition, message: result.message}
  }

  return {...party, ...result.payload, timeout: party.interval || 0, ok: true}
}
export default createChannel
