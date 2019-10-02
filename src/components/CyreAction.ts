import {Party, Events} from '../interfaces/interface'
import {CyreLog, CyreError} from './CyreLog'

const _prepareActionToEmit = (io: Party, events = []) => {
  const response = {
    ...io,
    ok: true,
    done: true
  }
  return response
}

const _repeatAction = (io: Party) => {
  return io.repeat ? {...io, timeout: io.interval, done: false} : {...io} // _removeTaskFromTimeline(io, [])
}

const _emitAction = function(io: Party, events = []) {
  const internalNeuron = []
  events.forEach((fn: Function) => {
    try {
      internalNeuron.push(fn(io.payload)||[])
    } catch (err) {
      CyreError({id: io.id, err})
    }
  })
  return {...io, ok: true, listeners: events.length, internalNeuron}
}

const _initiateAction = (io: Party, events = []): boolean => {
  return events ? true : false
}

const CyreAction = async (io: Party, events = []) => {
  try {
    io = _prepareActionToEmit(io, events)
    io = _emitAction(io, events)
    io = _repeatAction(io)
  } catch {
    err => CyreError({err, io, events})
  }

  const response = _initiateAction(io, events)
    ? await Promise.all([_prepareActionToEmit, _emitAction, _repeatAction])
    : {...io, ok: false, done: false}

  if (io.log) CyreLog({...io})
  return await io
}
export default CyreAction
