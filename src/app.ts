// @ts-check
import {Action} from './actions/actions'
import createChannel from './components/create-channel'
import dataDefinitions from './components/data-definitions'
import {Events, Party} from './interfaces/interface'

import {log, error} from './components/log'

/* 


    Neural Line
    Time based event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    action-on-call 2019 



    eg simple use
    cyre.action({ id: 'uber', type: 'call', payload: 44085648634 })
    cyre.on('call', number => {
      console.log("calling taxi on ", number)
    })
    cyre.call('uber')

*/

const Cyre = (line: string) => {
  const globalEvents: Events = {}
  const globalStats: object = {}
  const globalLog: [] = []
  const timestamp: number = 0
  const globalTimeline = new Set()
  const globalWaitingList: any = new Set()
  const group = []
  const globalParty: Party = {}
  const precision = 17
  const globalRecuperator: boolean = false
  const runTimeErrors = []

  const constructor = (id = '', interval = 0) => {
    console.log(
      '%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ',
      'background: rgb(151, 2, 151); color: white; display: block;'
    )
  }

  const setState = (state: object = {}, action: Party) => {
    const id = action.id
    globalStats[id] = {...state}
    call(id, {...state})
  }
  const setTimeline = (state: String = null, action: Party) => {
    const id = action.id
    globalTimeline.add({...state})
    call(id, {...state})
  }
  const setParty = (state: Party) => {
    const id = state.id
    globalParty[id] = {...state}
    //call(id, {...state})
  }

  const on = (type: string, fn: Function) => {
    const result =
      typeof fn === 'function' && type !== ''
        ? {
            ok: true,
            payload: globalEvents[type]
              ? globalEvents[type].add([fn])
              : (globalEvents[type] = new Set([fn]))
          }
        : {ok: false, message: 'invalid function'}
    return {...result, payload: type}
  }

  const type = (id: string, type: string) => {
    console.log(
      `cyre.type method not implemented in this version. Would've update channel's type without dispatching the action`
    )
  }

  /*  cyre-channel.ts was here */

  const action = (attribute: Party) => {
    if (!attribute)
      return {
        ok: false,
        payload: undefined,
        message: '@cyre.action: action id is required'
      }
    if (globalParty[attribute.id]) {
      error(`@cyre.action: action already exist ${attribute.id}`)
      return {
        ok: false,
        payload: attribute.id,
        message: 'action already exist'
      }
    }
    const party = createChannel(attribute, dataDefinitions)
    return setParty(party)
  }

  const call = (id: string = '', payload: any = null) => {
    if (!id.trim()) {
      error(`@cyre.call : id does not exist ${id}`)
      return {
        ok: false,
        payload: undefined,
        message: '@cyre.call : id does not exist'
      }
    }
    if (!globalParty[id]) {
      error(`@cyre.call: action does not exist ${id}`)
      return {
        ok: false,
        payload: undefined,
        message: '@cyre.call : action not found ' + id
      }
    }

    const res = Action(
      {...globalParty[id], payload},
      globalEvents
    ).then(data => setParty({...data, payload: null}))
    globalParty[id].timeout === 0 ? true : false //_sendActonToTimeline(party)
  }

  const emit = (id: string, payload: any) => {
    console.log('@emit/call : ', id)
    return call(id, payload)
  }

  const dispatch = (attribute: {
    id: ''
    type: ''
    payload: any
  }): object => {
    attribute.id = attribute.id ? attribute.id : ''
    attribute.type
      ? 0
      : error(
          `@cyre.dispatch : action type required for  ${attribute.id}`
        )
    const data = createChannel(attribute, dataDefinitions)
    globalParty[attribute.id] = data.data
    return data.ok
      ? {
          ok: true,
          payload: Action(
            {...globalParty[attribute.id]},
            globalEvents
          )
        }
      : {
          ok: false,
          payload: attribute.id,
          message: error(`@Cyre couldn't dispatch action`)
        }
  }

  const test = (): object => {
    return {
      ok: true,
      payload: 200,
      message: 'Cyre: Hi there, what can I help you with'
    }
  }

  return {
    test,
    call,
    //dispatch,
    action,
    //channel,
    //type,
    on,
    //emit,
    constructor
  }
}
const cyre = Cyre('quantum-inceptions')
cyre.constructor()
export {cyre, Cyre}
export default cyre
