import middleware from '../definitions/middleware'
import {Party, Events} from '../interfaces/interface'
import {CyreError} from './CyreLog'
/**
 *
 * @  handles the process of creating channel
 * @
 */
const CyreChannel = (bot: Party, dataDefinitions) => {
  const condition = bot ? 'insert' : 'update'
  const response: {
    payload?: any
    message?: string
    ok: boolean
  } = middleware[condition](bot, dataDefinitions)
  if (!response.ok) {
    CyreError(
      `@Cyre : Action could not be created for '${bot.id}' ${response.message}`
    )
    return {
      ok: false,
      payload: condition,
      message: response.message
    }
  }

  return {
    ...bot,
    ...response.payload,
    timeout: bot.interval || 0,
    ok: true
  }
}
export default CyreChannel
