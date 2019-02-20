/** @format */

//@ts-check
const middleware = {
  /**
   *@param{object} action cyre.action
   *@param{object} dataDefinitions action attributes
  
  */
  insert: (action, dataDefinitions) => {
    const data = {};
    action.id = action.id || null;
    action.type = action.type || action.id;
    for (const attribute in action) {
      data[attribute] = dataDefinitions[attribute]
        ? dataDefinitions[attribute](action[attribute])
        : {
            ok: false,
            data: null,
            message: `'${attribute}' data definition not found`,
            required: false
          };

      if (!data[attribute].ok && data[attribute].required) {
        return {ok: false, data, message: data[attribute].message}
      }

      data[attribute].ok ? true : console.error(data[attribute].message);
      data[attribute] = data[attribute].data;
    }
    return {ok: true, data}
  },

  /**
   *@param{object} action cyre.action
   *@param{object} dataDefinitions action attributes
  
  */

  update: (action, dataDefinitions) => {
    const data = {};
    for (const attribute in action) {
      data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false;
      data[attribute].ok ? true : console.error(data[attribute].message);
      data[attribute] = data[attribute].data;
    }
    return {ok: true, data}
  }
};

/** @format */

//@ts-check
const dataDefinitions = {
  id: (attribute = 0) => {
    if (typeof attribute !== 'string') {
      return {
        ok: false,
        data: null,
        message: `action.id must be a string. Received '${attribute}'`,
        required: true
      }
    }

    return {ok: true, data: attribute, required: true}
  },
  type: (attribute = '') => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `action.type must be a string. Received '${attribute}'`,
          required: true
        }
  },

  payload: (attribute = null) => {
    return {ok: true, data: attribute}
  },

  interval: (attribute = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: 0,
          message: `'${attribute}' invalid action.interval value`
        }
  },

  repeat: (attribute = 0) => {
    return Number.isInteger(attribute)
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: 0,
          message: `'${attribute}' invalid action.repeat value`
        }
  },

  group: (attribute = '') => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `'${attribute}' invalid action.group value`
        }
  },

  callback: (attribute = '') => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `'${attribute}' invalid action.callback value`
        }
  },

  log: (attribute = false) => {
    return typeof attribute === 'boolean'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: false,
          message: `'${attribute}' invalid action.log value`
        }
  },

  middleware: (attribute = null) => {
    return typeof attribute === 'string'
      ? {ok: true, data: attribute}
      : {
          ok: false,
          data: null,
          message: `'${attribute}' invalid action.middleware value`
        }
  },

  at: (attribute = 0) => {
    // const at = new Date()
    return {
      ok: false,
      data: attribute,
      message: `'${attribute}'  action.at is an experimental feature, not applied yet`
    }
  }
};

/** @format */

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
    this.id = id;
    this.interval = interval || 16;
    this.events = {};
    this.timestamp = 0;
    this.timeline = new Set();
    this.waitingList = new Set();
    this.group = [];
    this.party = {};
    this.precision = 17;
    this.recuperating = 0;
    this.error = 0;
    console.log('%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ', 'background: rgb(151, 2, 151); color: white; display: block;');
  }

  _log(msg, clg = false) {
    return clg ? '!log into something else ' : console.log(msg)
  }

  /**
   *@param{string} type action.type
  
  */

  _taskWaitingList(type) {
    for (let id of this.waitingList) {
      this.events[this.party[id].type] ? (this.waitingList.delete(id), this._initiate(id)) : console.log('@cyre: type is not in waiting list');
    }
  }

  /**
   *@param{string} type action.type
   *@param{any} payload action.payload
   */
  _emitAction(type = '', payload = {}, response = {}) {
    for (const fn of this.events[type]) {
      fn(payload, response); //add response
    }
    return {ok: true, done: true, data: `${type} action emitted`}
  }

  /**
   *@param{object} result
   *@param{number} value
   */
  _recuperate(result = {}, value = 0) {
    result.data = result.ok
      ? result.data
          .sort((a, b) => {
            return b - a
          })
          .reverse()
      : [value];
    result.data = result.data[0] || result.data[1] || 0;
    return result
  }
  //@TODO this.recuperating should pause quartz when its not in use
  _quartz() {
    /*
      T.I.M.E. - K.E.E.P.E.R.
    */
    const now = performance.now();
    const time = now - this.timestamp;
    this.recuperating = 1;

    //Timed zone
    if (time >= this.interval) {
      this.timestamp = performance.now();
      const result = this.timeline.size ? this._processingUnit(this.timeline, this.interval) : {ok: false, data: []};
      this.interval = this._recuperate(result, this.interval).data;
    }
    if (this.timeline.size) {
      window.requestAnimationFrame(this._quartz.bind(this));
    } else {
      window.cancelAnimationFrame(this._quartz.bind(this));
      this.recuperating = 0;
    }
  }
  /**
   * @param {object} timeline list of actions in this.timeline
   * @param {number} precision adjustment to time interval
   */
  _processingUnit(timeline, precision) {
    return new Promise(success => {
      let info = {ok: true, data: [], id: []};
      for (const id of timeline) {
        //deduct precision from action.timeout
        this.party[id].timeout -= precision;
        info.data.push(this.party[id].timeout);
        info.id.push(id);
        this.party[id].timeout <= precision ? this._sendAction(id) : false;
        success(info);
      }
    })
  }

  /**
   * @param {string} id action id
   */
  _addToTimeline(id) {
    this.timeline.add(id);
    this.recuperating ? true : this._quartz();
    return {ok: true, done: false, data: ''}
  }

  /**
   * @param {string} id action id
   */
  _addToWaitingList(id) {
    this.waitingList.add(id);
    const response = {ok: true, done: false, id, data: this.party[id].payload, group: this.party[id].group || 0, message: 'added to action waiting list'};
    this.party[id].log ? this._log(response) : 0;
    return {
      ok: false,
      done: false,
      data: `${id} added to waiting list`
    }
  }

  /**
   * @param {string} id action id
   */
  _completeAction(id) {
    this.timeline.delete(id);
    return true
  }

  /**
   * @param {string} id action id
   */
  _repeatAction(id) {
    this.party[id].timeout = this.party[id].interval;
    --this.party[id].repeat;
    return false
  }

  /**
   * @param {string} id action id
   */
  _sendAction(id) {
    const done = this.party[id].repeat > 0 ? this._repeatAction(id) : this._completeAction(id);
    const response = {ok: true, done, id, data: this.party[id].payload, group: this.party[id].group || 0};
    this.party[id].log ? this._log(response) : 0;
    return this._emitAction(this.party[id].type, this.party[id].payload, response)
  }

  /**
   * @param {string} id action id
   */
  _initiate(id) {
    return this.party[id].timeout === 0 ? this._sendAction(id) : this._addToTimeline(id)
  }

  /**
   * @param {string} id action id
   * @param {string} type action type
   */
  _dispatchAction(id, type) {
    return this.events[type] ? this._initiate(id) : this._addToWaitingList(id)
  }

  /**
   * @param {object} action action cyre.action
   * @param {object} dataDefinitions$$1 data definitions for available action attributes
   */
  _createChannel(action, dataDefinitions$$1) {
    const condition = this.party[action.id] ? 'update' : 'insert';
    const result = middleware[condition](action, dataDefinitions$$1);
    if (!result.ok) {
      //console.error(`@Cyre : Action could not be created for '${action.id}' ${result.message}`)
      return {ok: false, data: condition, message: result.message}
    }

    this.party[action.id] = result.data;
    this.party[action.id].timeout = this.party[action.id].interval || 0;
    return {ok: true, data: condition}
  }

  /**
   * @param {function} fn unregister function from cyre.on
   */
  //system user interface
  off(fn) {
    //remove unwanted listener
    for (let type in this.events) {
      return this.events[type].has(fn) ? {ok: true, data: this.events[type].delete(fn)} : {ok: false, data: 'function not found'}
    }
  }

  //@TODO: list all registered functions action.type
  list() {
    for (let type in this.events) {
      for (let fn of this.events[type]) {
        this._log(type + ' ' + fn.name);
      }
    }
  }

  clr() {
    //clear all iterating actions
    return this.timeline.clear()
  }

  //@TODO: this meant to pause all iterable actions
  pause(id) {
    // pause _quartz
    //need some work
    return this.timeline.has(id) ? this.timeline.delete(id) : false
  }

  // User interfaces
  /**
   * @param {string} type action.type
   * @param {function} fn action type function
   * @param {array} group list of groups its part of
   */
  on(type, fn, group = []) {
    return typeof fn === 'function' && type !== ''
      ? {ok: true, data: this.events[type] ? this.events[type].add([fn]) : ((this.events[type] = new Set([fn])), this._taskWaitingList(type))}
      : {ok: false, data: type, message: 'invalid function'}
  }

  /**
   * @param {string} id action id
   * @param {string} type action type
   */
  type(id, type) {
    console.log(`cyre.type method not implemented yet in this version, would've update channel.id's type without dispatching the action`);
  }

  /**
   * @param {object} attribute list of action attributes. {id, type, payload, interval, repeat, log}
   */
  channel(attribute = {}) {
    if (this.party[attribute.id]) {
      console.error('@cyre.action: action already exist', attribute.id);
      return {ok: false, data: attribute.id, message: 'action already exist'}
    }
    return this._createChannel(attribute, dataDefinitions)
  }

  /**
   * @param {object} attribute list of action attributes. {id, type, payload, interval, repeat, log}
   */
  action(attribute = {}) {
    if (this.party[attribute.id]) {
      console.error('@cyre.action: action already exist', attribute.id);
      return {ok: false, data: attribute.id, message: 'action already exist'}
    }
    return this._createChannel(attribute, dataDefinitions)
  }

  /**
   * @param {string} id action.id
   * @param {any} payload action.payload.
   */
  call(id = '', payload = null) {
    return this.party[id]
      ? (payload && (this.party[id].payload = payload), this._dispatchAction(id, this.party[id].type))
      : {ok: false, data: console.error('@cyre.call : action not found', id)}
  }

  /**
   * @param {string} id action.id
   * @param {any} payload action.payload.
   */

  emit(id, payload) {
    return this.call(id, payload)
  }

  /**
   * @param {object} attribute list of action attributes. {id, type, payload, interval, repeat, log}
   */
  //dispatch accepts object type input eg {id: uber, type: call, payload: 0025100124}
  dispatch(attribute = {}) {
    attribute.id = attribute.id ? attribute.id : '';
    attribute.type ? 0 : console.error('@cyre.dispatch : action type required for - ', attribute.id);
    return this._createChannel(attribute, dataDefinitions).ok
      ? {ok: true, data: this._dispatchAction(attribute.id, attribute.type)}
      : {ok: false, data: attribute.id, message: console.log(`@Cyre couldn't dispatch action`)}
  }

  test() {
    return {ok: true, data: 200, message: 'Cyre: Hi there, what can I help you with'}
  }
}
const cyre = new Cyre('quantum-inceptions');

export default cyre;
export { cyre, Cyre };
