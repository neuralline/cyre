import {Party, Events} from '../interfaces/interface'

/* export const _dispatchAction = (party: Party, events: Events) => {
  return party.timeout === 0 ? _prepareActionToEmit(party, events) : false //_sendActonToTimeline(party)
}
export const _initiateAction = (party: Party, events: Events) => {
  return events[party.type] ? _dispatchAction(party, events) : false //_addToWaitingList(party)
}
export const _repeatAction = (party: Party) => {
  party.timeout = party.interval
  return party
}
export const _emitAction = (party: Party, events: Events) => {
  events[party.type].forEach((fn: Function) => fn(party.payload, party))
}

export const _prepareActionToEmit = (party: Party, events: Events) => {
  const response = {
    ...party,
    ok: true,
    done: true
  }
  party = party.repeat > 0 ? _repeatAction(party) : party // _removeTaskFromTimeline(party, new Set())
  // console.log('@party true ', party)
  party.log ? _log(response) : false
  return _emitAction(response, events)
}

export const _removeTaskFromTimeline = (party: Party, timeline) => {
  timeline.delete(party.id)
  return timeline
} */

const _prepareActionToEmit = (party: Party, events: Events) => {
  const response = {
    ...party,
    ok: true,
    done: true
  }

  // console.log('@party true ', party)
  // party.log ? _log(response) : false
  return response
}

const _repeatAction = (party: Party) => {
  return party.repeat ? {...party, timeout: party.interval, ok: true, done: false} : {...party} // _removeTaskFromTimeline(party, new Set())
}

const _emitAction = (party: Party, events: Events) => {
  events[party.type].forEach((fn: Function) => fn(party.payload, party))
  return {...party, listeners: events[party.type].size}
}

const _initiateAction = (party: Party, events: Events) => {
  return events[party.type] ? true : false //_addToWaitingList(party)
}

export const Action = async (party: Party, events: Events) => {
  try {
    party = _prepareActionToEmit(party, events)
    party = _emitAction(party, events)
    party = _repeatAction(party)
  } catch {
    err => console.log('@cyre.dispatchAction ', err)
  }

  const result = _initiateAction ? await Promise.all([_prepareActionToEmit, _emitAction, _repeatAction]) : {...party, ok: false, done: false}
  return party
}
