/** @format */

// @ts-check
import middleware from './components/middleware'
import dataDefinitions from './components/data-definitions'

/* 

    Neural Line
    Time based event manager
    C.Y.R.E
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    EVENT HANDLER 2019 



    eg simple use
    cyre.dispatch{id: uber, type: call, payload: 004485648634}
    cyre.on('call', callTaxi)
    const callTaxi =(number)=>{
      console.log('calling taxi on ', number)  
    }

*/

class Cyre {
  constructor(id = '', interval = 0) {
    this.id = id
    this.interval = interval || 16
    this.events = {}
    this.timestamp = 0
    this.timeline = new Set()
    this.waitingList = new Set()
    this.group = []
    this.party = {}
    this.precision = 17
    this.recuperating = 0
    this.error = 0
    console.log('%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ', 'background: rgb(151, 2, 151); color: white; display: block;')
    this._quartz()
  }

  _log(msg, clg = false) {
    return clg ? '!log into something else ' : console.log(msg)
  }

  _wait(type = null) {
    for (let id of this.waitingList) {
      this.events[this.party[id].type] ? (this.waitingList.delete(id), this._initiate(id)) : console.log('@wait list nop')
    }
  }

  _emitAction(type = '', payload = {}, response = {}) {
    for (const fn of this.events[type]) {
      fn(payload, response) //add response
    }
    return {ok: true, done: true, data: `${type} action emitted`}
  }

  _recuperate(result = {}, value = 0) {
    result.data = result.ok
      ? result.data
          .sort((a, b) => {
            return b - a
          })
          .reverse()
      : [value]
    result.data = result.data[0] || result.data[1] || 0
    return result
  }

  _quartz() {
    /*
      T.I.M.E. - K.E.E.P.E.R.
    */
    const now = performance.now()
    const time = now - this.timestamp
    //Timed zone
    if (time >= this.interval) {
      this.timestamp = performance.now()
      const result = this.timeline.size ? this._processingUnit(this.timeline, this.interval) : {ok: false, data: []}
      this.interval = this._recuperate(result, this.interval).data
    }
    this.recuperating = requestAnimationFrame(this._quartz.bind(this))
  }

  _processingUnit(timeline, precision) {
    return new Promise(success => {
      let info = {ok: true, data: [], id: []}
      for (const id of timeline) {
        //deduct precision from action.timeout
        this.party[id].timeout -= precision
        info.data.push(this.party[id].timeout)
        info.id.push(id)
        this.party[id].timeout <= precision ? this._sendAction(id) : false
        success(info)
      }
    })
  }

  _addToTimeline(id) {
    return {ok: true, done: false, data: this.timeline.add(id)}
  }

  _addToWaitingList(id) {
    this.waitingList.add(id)
    const response = {ok: true, done: false, id, data: this.party[id].payload, group: this.party[id].group || 0, message: 'added to action waiting list'}
    this.party[id].log ? this._log(response) : 0
    return {
      ok: false,
      done: false,
      data: `${id} added to waiting list`
    }
  }

  _completeAction(id) {
    this.timeline.delete(id)
    return true
  }

  _repeatAction(id) {
    this.party[id].timeout = this.party[id].interval
    --this.party[id].repeat
    return false
  }

  _sendAction(id) {
    const done = this.party[id].repeat > 0 ? this._repeatAction(id) : this._completeAction(id)
    const response = {ok: true, done, id, data: this.party[id].payload, group: this.party[id].group || 0}
    this.party[id].log ? this._log(response) : 0
    return this._emitAction(this.party[id].type, this.party[id].payload, response)
  }

  _initiate(id) {
    return this.party[id].timeout === 0 ? this._sendAction(id) : this._addToTimeline(id)
  }

  _dispatchAction(id, type) {
    return this.events[type] ? this._initiate(id) : this._addToWaitingList(id)
  }

  _createChannel(action, dataDefinitions$$1) {
    const condition = this.party[action.id] ? 'update' : 'insert'
    const result = middleware[condition](action, dataDefinitions$$1)
    if (!result.ok) {
      console.error(`@Cyre : Action could not be created for '${action.id}' ${result.message}`)
      return {ok: false, data: null, message: result.message}
    }

    this.party[action.id] = result.data
    this.party[action.id].timeout = this.party[action.id].interval || 0
    return {ok: true, data: true}
  }

  //system user interface
  off(fn) {
    //remove unwanted listener
    for (let type in this.events) {
      return this.events[type].has(fn) ? {ok: true, data: this.events[type].delete(fn)} : {ok: false, data: 'Function type not found'}
    }
  }

  list() {
    //list all registered functions action.type
    for (let type in this.events) {
      for (let fn of this.events[type]) {
        this._log(fn.name)
      }
    }
  }

  clr() {
    //clear all iterating actions
    return this.timeline.clear()
  }

  pause(id) {
    // pause _quartz
    //need some work
    return this.timeline.has(id) ? this.timeline.delete(id) : false
  }

  // User interfaces
  on(type, fn, group = []) {
    return new Promise((success, reject) => {
      typeof fn === 'function'
        ? success({
            ok: true,
            data: this.events[type] ? this.events[type].add([fn]) : ((this.events[type] = new Set([fn])), this._wait(type))
          })
        : reject({ok: false, data: 'invalid function', message: console.log(type, fn)})
    })
  }

  type(id, type) {
    console.log(`cyre.type method not implemented yet in this version, would've update channel.id's type without dispatching the action`)
  }

  channel(attribute = {}) {
    if (this.party[attribute.id]) return console.error('@cyre.action: action already exist', attribute.id)
    return this._createChannel(attribute, dataDefinitions)
  }

  action(attribute = {}) {
    if (this.party[attribute.id]) return console.error('@cyre.action: action already exist', attribute.id)
    return this._createChannel(attribute, dataDefinitions)
  }

  emit(id = null, payload = null) {
    return this.party[id]
      ? ((this.party[id].payload = payload), this._dispatchAction(id, this.party[id].type))
      : console.error('@cyre.call : channel not found', id)
  }

  call(id = null, payload = null) {
    this.emit(id, payload)
  }

  //dispatch accepts object type input eg {id: uber, type: call, payload: 0025100124}
  dispatch(attribute = {}) {
    attribute.id = attribute.id ? attribute.id : null
    attribute.type ? 0 : console.error('@cyre.dispatch : action type required for - ', attribute.id)
    return this._createChannel(attribute, dataDefinitions).ok
      ? {ok: true, data: this._dispatchAction(attribute.id, attribute.type)}
      : {ok: false, data: attribute.id, message: console.log(`@Cyre couldn't dispatch action`)}
  }

  //respond accepts array of input eg { uber,  call, 0025100124}
  respond(id = null, type = null, payload = null, interval = 0, repeat = 0) {
    const data = {id, type, payload, interval, repeat}
    this._createChannel(data, dataDefinitions)
    this._dispatchAction(data.id, data.type)
    return {ok: true, data: data.id}
  }
}

const cyre = new Cyre('quantum-inceptions')

export {cyre, Cyre}
export default cyre
