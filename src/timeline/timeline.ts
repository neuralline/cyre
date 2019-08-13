import {Party, Events} from '../interfaces/interface'
export const _taskWaitingList = (party: Party, events: Events, waitingList, _dispatchAction) => {
  for (let id of waitingList) {
    events[party.type] ? (waitingList.delete(id), _dispatchAction(party, events)) : false
  }
}

/**
 * @param {string} id action id
 * uses global timeline
 * uses global globalRecuperating
 */
export const _sendActonToTimeline = (party: Party, timeline) => {
  party.timeout = party.interval
  timeline.add(party.id)
  return timeline
}
/**
 * @param {string} id action id
 */
const _addToWaitingList = (party: Party, waitingList, _log) => {
  waitingList.add(party.id)
  const response = {
    ...party,
    ok: true,
    done: false,
    message: `${party.id} added to waiting list`
  }
  response.log ? _log(response) : 0
  return response
}
