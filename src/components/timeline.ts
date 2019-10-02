import {Party, Events} from '../interfaces/interface'
export const _taskWaitingList = (
  bot: Party,
  events: Events,
  waitingList,
  _dispatchAction
) => {
  for (let id of waitingList) {
    events[bot.type]
      ? (waitingList.delete(id), _dispatchAction(bot, events))
      : false
  }
}

/**
 * @param {string} id action id
 * uses global timeline
 * uses global globalRecuperating
 */
export const _sendActonToTimeline = (bot: Party, timeline) => {
  bot.timeout = bot.interval
  timeline.add(bot.id)
  return timeline
}
/**
 * @param {string} id action id
 */
const _addToWaitingList = (bot: Party, waitingList, _log) => {
  waitingList.add(bot.id)
  const response = {
    ...bot,
    ok: true,
    done: false,
    message: `${bot.id} added to waiting list`
  }
  response.log ? _log(response) : 0
  return response
}
