// @ts-check
import CyreChannel from './components/CyreChannel'
import CyreAction from './components/CyreAction'
import CyreOn from './components/CyreOn'
import dataDefinitions from './definitions/data-definitions'
import typeDefinitions from './definitions/type-definitions'
import { CyreError, CyreLog } from './components/CyreLog'
import { Events, Party } from './interfaces/interface'
/* 


    Neural Line
    Time based event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    2019 



    eg simple use
    cyre.action({ id: 'uber', payload: 44085648634 })
    cyre.on('uber', number => {
      console.log("calling taxi on ", number)
    })
    cyre.call('uber')
    



the first low: A robot can not injure a human being or alow a human being to be harmed by not helping;
*/

const Cyre = function (line: string) {
  const globalEvents: Events = {}
  const globalParty: Party = {}
  const state = { globalEvents, globalTimeline:{}, globalParty }

  const constructor = (id = '', interval = 0) => {
    console.log(
      '%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0--2.L3 ',
      'background: rgb(151, 2, 151); color: white; display: block;'
    )
  }

  const setState = (id: string, action: Party) => {
    state[id][action.id] = { ...action }
    //call(id, {...state})
  }

  const setParty = (state: Party) => {
    const id = state.id
    globalParty[id] = { ...state }
    //call(id, {...state})
  }

  const on = function (type: string | [], fn: Function) {
    let subscribers = []

    if (Array.isArray(type)) {
      const dValue = type.map((bot: { id: string; payload: any }) => {
        const name = bot.id
        const func = bot.payload

        subscribers = globalEvents[name] ? [...globalEvents[name]] : []
        globalEvents[name] = CyreOn(subscribers, func).payload

        /**
         * seeing the possibility if this process can be handled by cyre create channel
         * const action = CyreChannel(attribute, typeDefinitions)
         */
      })
    } else if (typeof type === 'string' && typeof fn === 'function') {
      subscribers = globalEvents[type] ? [...globalEvents[type]] : []
      globalEvents[type] = CyreOn(subscribers, fn).payload
    } else
      return {
        ok: false,
        message: 'invalid function',
        payload: type
      }
    return this
  }

  const type = (id: string, type: string) => {
    console.warn(
      `cyre.type method not implemented in this version. Would've update channel's type without dispatching the action`
    )
  }

  /*  cyre-channel.ts was here */

  const action = (attribute: [] | { type; id }) => {
    if (!attribute) {
      CyreLog({
        ok: false,
        payload: undefined,
        message: '@cyre.action: action id is required'
      })
    } else if (Array.isArray(attribute)) {
      attribute.forEach((bot: any) => {
        bot.type = bot.type || bot.id
        setParty(CyreChannel(bot, dataDefinitions))
      })
    } else {
      attribute.type = attribute.type || attribute.id
      setParty(CyreChannel(attribute, dataDefinitions))
    }
  }

  const call = (id: string = null, payload: any = null) => {
    let io: Party = {
      id: id.trim() || null,
      ok: false,
      done: false,
      toc: performance.now(),
      payload: payload
    }

    if (!io.id) {
      CyreError({
        ok: false,
        done: false,
        payload: null,
        message: '@cyre.call: id does not exist'
      })

      return false
    }

    if (!globalParty[io.id]) {
      CyreError({
        ok: false,
        done: false,
        toc: performance.now(),
        payload: null,
        message: `@cyre.call: ${id}; The subscriber you called is not responding `
      })

      return false
    }

    if (globalParty[io.id].isThrottling) return

    io = payload
      ? { ...io, ...globalParty[io.id], payload }
      : { ...io, ...globalParty[io.id] }

    if (globalParty[io.id].isBouncing) return
    if (io.timeout === 0) {
      if (io.throttle) {
        globalParty[io.id].isThrottling = true
        io.hold = io.throttle || 1000
      } else if (io.debounce) {
        globalParty[io.id].isBouncing = true
        io.hold = io.throttle || 1000
      }
      CyreAction({ ...io }, globalEvents[io.type]).then(data => {
        if (data.internalNeuron) {
          data.internalNeuron.map(internal => {
            if (internal.id) {
              call(internal.id, internal.payload || null)
            }
          })
        }
      })
    } else {
      sendActionToTimeline(io)
    }
  }

  const sendActionToTimeline = async io => {
    console.log('@cyre.timeline : action sent to timeline ', io)
    await setTimeout(() => {
      console.log('@cyre.timeline : action has been executed')
      CyreAction(io, globalEvents[io.type]).then(data => {
        setState('globalEvents', { ...data })
      }, io.timeout)
    })
    return await false
  }
  /**
   * new feature to chain commands in one thread like structure
   *
  **/
  const chain = () => {
    const parcel: Party = {}
    const cascade = {
      type: function (bot: string) {
        parcel.type = bot
        return this
      },
      repeat: function (bot: number) {
        parcel.repeat = bot
        console.log('cyre.ac parcel repeat : ', parcel)
        return this
      },
      interval: function (bot: number) {
        parcel.interval = bot
        console.log('cyre.ac parcel interval : ', parcel)
        return this
      },
      log: function (bot: boolean) {
        parcel.log = bot
        console.log('cyre.ac parcel log : ', parcel)
        return this
      }
    }
  }

  const test = (): object => {
    return {
      ok: true,
      payload: 200,
      message: '@cyre: Hi there, what can I help you with?'
    }
  }

  return {
    test,
    call,
    //dispatch,
    action,
    chain,
    //channel,
    //type,
    on,
    //emit,
    constructor
  }
}
const cyre = Cyre('quantum-inceptions')
cyre.constructor()
export { cyre, Cyre }
export default cyre
