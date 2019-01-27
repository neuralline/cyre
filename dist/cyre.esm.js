const middleware = {
    insert: (payload, dataDefinitions) => {
        const data = {};
        for (const type in payload) {
            data[type] = dataDefinitions[type] ? dataDefinitions[type](payload[type]) : false;
        }
        return { ok: true, data }
    },
    update: (payload, dataDefinitions) => {
        const data = {};
        for (const type in payload) {
            data[type] = dataDefinitions[type] ? dataDefinitions[type](payload[type]) : false;
        }
        return { ok: true, data }
    }
};

const dataDefinitions = {
    id: (x) => {
        return (typeof x === 'string') ? x : 0
    },
    action: (x) => {
        return (typeof x === 'string') ? x : 0
    },
    payload: (x) => {
        return x || 0
    },
    interval: (x) => {
        return Number.isInteger(x) && x || 0;
    },
    repeat: (x) => {
        return Number.isInteger(x) && x || 0;
    },
    group: (x) => {
        return (typeof x === 'string') ? x : 0
    },
    callback: (x) => {
        return (typeof x === 'function') ? x : 0
    },
    log: (x) => {
        return (typeof x === 'boolean') ? x : false
    },
    middleware: (x) => {
        return (typeof x === 'string') ? x : 'insert'
    },
    /* at: (x) => {
        const at = new Date().
    }
 */
};

// @ts-check

/* 

    Neural Line
    Time based event manager
    C.Y.R.E
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    EVENT HANDLER 01 - 01 - 2019 



    eg simple use
    cyre.dispatch{id: uber, action: call, payload: 004485648634}
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

  kick(fn) {
    for (let action in this.events) {
      return this.events[action].has(fn) ? { ok: true, data: this.events[action].delete(fn) } : {
        ok: false,
        data: 'Nothing to kick'
      };
    }
  }

  list() {
    for (let action in this.events) {
      for (let fn of this.events[action]) {
        this._log(fn.name, 1);
      }
    }
  }

  clr() {
    return this.timeline.clear();
  }

  _log(msg, c = 0) {
    return c ? console.log(msg) : console.log('! ', msg);
  }

  pause(id) {
    //need some work
    return this.timeline.has(id) ? this.timeline.delete(id) : false;
  }

  _wait(action) {
    for (let id of this.waitingList) {
      this.events[this.party[id].action] ? (this.waitingList.delete(id), this._initiate(id)) : console.log('@wait list nop');
    }
  }

  on(action, fn, group = []) {
    return new Promise((success, reject) => {
      (typeof fn === 'function')
        ? success({
          ok: true,
          data: this.events[action] ? this.events[action].add([fn]) : (this.events[action] = new Set([fn]), this._wait(action)),

        })
        : reject({ ok: false, data: 'invalid function', msg: console.log(action, fn) });
    })
  }

  emit(action, data, response, group = 0) {
    for (const fn of this.events[action]) {
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
    return this.emit(this.party[id].action, this.party[id].payload, this.party[id].repeat > 0 ? this._repeatAction(id) : this._taskComplete(id), this.party[id].group)
  }

  _initiate(id) {
    return this.party[id].timeout === 0 ? this._action(id) : this._addToTimeline(id)
  }

  _dispatch(id, action) {
    this.events[action] ? this._initiate(id) : { ok: false, data: this.waitingList.add(id) };
  }

  _createChannel(data, dataDefinitions$$1) {
    const condition = this.party[data.id] ? 'update' : 'insert';
    const result = middleware[condition](data, dataDefinitions$$1);
    result.ok ? this.party[data.id] = result.data : { ok: false, data: console.log('@respond : major malfunctions ', data.id) };
    this.party[data.id].timeout = this.party[data.id].interval || 0;
    return { ok: true, data: data }
  }


  // User interfaces

  channel(x = {}) {
    if (this.party[x.id]) return console.error('@cyre.channel: channel already exist', x.id)
    return this._createChannel(x, dataDefinitions)
  }

  call(id, payload = 0) {
    this.party[id] ? (this.party[id].payload = payload, this._dispatch(id, this.party[id].action)) : console.error('@cyre.call : channel not found', id);
  }

  //dispatch accepts object type input eg {id: uber, action: call, payload: 0025100124}

  dispatch(data = {}) {
    data.id = data.id ? data.id : 0;
    data.action ? 0 : console.log('@dispatch : data action required for - ', data.id);
    return this._createChannel(data, dataDefinitions).ok ? { ok: true, data: this._dispatch(data.id, data.action) } : { ok: true, data: data.id }
  }

  //respond accepts array of input eg { uber,  call, 0025100124}
  respond(id = 0, action = 0, payload = 0, interval = 0, repeat = 0) {
    const data = { id, action, payload, interval, repeat };
    this._createChannel(data, dataDefinitions);
    this._dispatch(data.id, data.action);
    return { ok: true, data: data.id }
  }
}
const cyre = new Cyre();

export { Cyre, cyre };
