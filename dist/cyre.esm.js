const middleware = {
    insert: (action, dataDefinitions) => {
        const data = {};
        for (const attribute in action) {
            data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false;
        }
        return { ok: true, data }
    },
    update: (action, dataDefinitions) => {
        const data = {};
        for (const attribute in action) {
            data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false;
        }
        return { ok: true, data }
    }
};

const dataDefinitions = {
    id: (x) => {
        return (typeof x === 'string') ? x : null
    },
    type: (x) => {
        return (typeof x === 'string') ? x : null
    },
    payload: (x) => {
        return x || null
    },
    interval: (x) => {
        return Number.isInteger(x) && x || 0
    },
    repeat: (x) => {
        return Number.isInteger(x) && x || 0
    },
    group: (x) => {
        return (typeof x === 'string') ? x : null
    },
    callback: (x) => {
        return (typeof x === 'function') ? x : null
    },
    log: (x) => {
        return (typeof x === 'boolean') ? x : false
    },
    middleware: (x) => {
        return (typeof x === 'string') ? x : null
    },
    at: (x) => {
        // const at = new Date()
        return false
    }

};

// @ts-check

/* 

    Neural Line
    Time based event manager
    C.Y.R.E
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    EVENT HANDLER 01 - 01 - 2019 



    eg simple use
    cyre.dispatch{id: uber, type: call, payload: 004485648634}
    cyre.on('call', callTaxi)
    const callTaxi =(number)=>{
      console.log('calling taxi on ', number)  
    }

*/



class Cyre {
  constructor (id, interval) {
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
    console.log("%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0 ", "background: purple; color: white; display: block;");
    this._quartz();
  }


  _log(msg, c = 0) {
    return c ? console.log(msg) : console.log('!log into something else ', msg);
  }

  _wait(type) {
    for (let id of this.waitingList) {
      this.events[this.party[id].type] ? (this.waitingList.delete(id), this._initiate(id)) : console.log('@wait list nop');
    }
  }

  _emit(type, data, response, group = 0) {
    for (const fn of this.events[type]) {
      fn(data, response); //add response
    }
    // return response;
  }

  _recuperator(result, value) {
    result.data = result.ok ? result.data.sort((a, b) => {
      return b - a;
    }).reverse() : [value];
    result.data = result.data[0] || result.data[1] || 0;
    return result
  }

  _quartz() {
    /*
      T.I.M.E. - K.E.E.P.E.R.
    */
    const now = performance.now();
    const time = now - this.timestamp;
    //Timed zone
    if (time >= this.interval) {
      this.timestamp = performance.now();
      const result = this.timeline.size ? this._processingUnit(this.timeline, this.interval) : {
        ok: false,
        data: []
      };
      this.interval = this._recuperator(result, this.interval).data;
    }
    this.recuperating = requestAnimationFrame(this._quartz.bind(this));
  }

  _processingUnit(timeline, precision) {
    return new Promise((success) => {
      let info = { ok: true, data: [], id: [] };
      for (const id of timeline) {
        this.party[id].timeout -= precision;
        info.data.push(this.party[id].timeout);
        info.id.push(id);
        this.party[id].timeout <= precision ? this._action(id) : false;
        success(info);
      }
    })
  }

  _addToTimeline(id) {
    return { ok: true, data: this.timeline.add(id) }
  }

  _taskComplete(id) {
    return { ok: true, done: this.timeline.delete(id) }
  }

  _repeatAction(id) {
    this.party[id].timeout = this.party[id].interval;
    return { ok: true, done: false, data: --this.party[id].repeat }
  }

  _action(id) {
    return this._emit(this.party[id].type, this.party[id].payload, this.party[id].repeat > 0 ? this._repeatAction(id) : this._taskComplete(id), this.party[id].group)
  }

  _initiate(id) {
    return this.party[id].timeout === 0 ? this._action(id) : this._addToTimeline(id)
  }

  _dispatch(id, type) {
    this.events[type] ? this._initiate(id) : { ok: false, data: this.waitingList.add(id) };
  }

  _createChannel(data, dataDefinitions$$1) {
    const condition = this.party[data.id] ? 'update' : 'insert';
    const result = middleware[condition](data, dataDefinitions$$1);
    result.ok ? this.party[data.id] = result.data : { ok: false, data: console.log('@createAction : major malfunctions ', data.id) };
    this.party[data.id].timeout = this.party[data.id].interval || 0;
    return { ok: true, data: data }
  }

  //system user interface

  kick(fn) { //remove unwanted listener
    for (let type in this.events) {
      return this.events[type].has(fn) ? { ok: true, data: this.events[type].delete(fn) } : {
        ok: false,
        data: 'Nothing to kick'
      };
    }
  }

  list() {//list all registered functions action.type
    for (let type in this.events) {
      for (let fn of this.events[type]) {
        this._log(fn.name, 1);
      }
    }
  }

  clr() { //clear all iterating actions
    return this.timeline.clear();
  }

  pause(id) {// pause _quartz
    //need some work
    return this.timeline.has(id) ? this.timeline.delete(id) : false;
  }

  // User interfaces
  on(type, fn, group = []) {
    return new Promise((success, reject) => {
      (typeof fn === 'function')
        ? success({
          ok: true,
          data: this.events[type] ? this.events[type].add([fn]) : (this.events[type] = new Set([fn]), this._wait(type)),

        })
        : reject({ ok: false, data: 'invalid function', msg: console.log(type, fn) });
    })
  }

  type(type, fn, group = []) {
    this.on(type, fn, group = []);
  }

  channel(x = {}) {
    if (this.party[x.id]) return console.error('@cyre.channel: channel already exist', x.id)
    return this._createChannel(x, dataDefinitions)
  }

  action(x = {}) {
    if (this.party[x.id]) return console.error('@cyre.action: action already exist', x.id)
    return this._createChannel(x, dataDefinitions)
  }

  emit(id = null, payload = null) {
    this.party[id] ? (this.party[id].payload = payload, this._dispatch(id, this.party[id].type)) : console.error('@cyre.call : channel not found', id);
  }

  call(id = null, payload = null) {
    this.emit(id, payload = 0);
  }

  //dispatch accepts object type input eg {id: uber, type: call, payload: 0025100124}
  dispatch(data = {}) {
    data.id = data.id ? data.id : null;
    data.type ? 0 : console.log('@dispatch : data type required for - ', data.id);
    return this._createChannel(data, dataDefinitions).ok ? { ok: true, data: this._dispatch(data.id, data.type) } : { ok: true, data: data.id }
  }

  //respond accepts array of input eg { uber,  call, 0025100124}
  respond(id = null, type = null, payload = null, interval = 0, repeat = 0) {
    const data = { id, type, payload, interval, repeat };
    this._createChannel(data, dataDefinitions);
    this._dispatch(data.id, data.type);
    return { ok: true, data: data.id }
  }
}

const cyre = new Cyre('quantum-inceptions');

export { Cyre, cyre };
