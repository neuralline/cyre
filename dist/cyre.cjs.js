'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/** @format */
//@ts-check
var middleware = {
  insert: function insert(action, dataDefinitions) {
    var data = {};
    action.id = action.id || null;
    action.type = action.type || null;

    for (var attribute in action) {
      data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : {
        ok: false,
        data: null,
        message: "'" + attribute + "' data definition not found",
        required: false
      };

      if (!data[attribute].ok && data[attribute].required) {
        console.log('middleware error');
        return {
          ok: false,
          data: data,
          message: data[attribute].message
        };
      }

      data[attribute].ok ? true : console.error(data[attribute].message);
      data[attribute] = data[attribute].data;
    }

    return {
      ok: true,
      data: data
    };
  },
  update: function update(action, dataDefinitions) {
    var data = {};

    for (var attribute in action) {
      data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false;
      data[attribute].ok ? true : console.error(data[attribute].message);
      data[attribute] = data[attribute].data;
    }

    return {
      ok: true,
      data: data
    };
  }
};

/** @format */
//@ts-check
var dataDefinitions = {
  id: function id(attribute) {
    if (attribute === void 0) {
      attribute = 0;
    }

    if (typeof attribute !== 'string') {
      return {
        ok: false,
        data: null,
        message: "action.id must be a string. Received '" + attribute + "'",
        required: true
      };
    }

    return {
      ok: true,
      data: attribute,
      required: true
    };
  },
  type: function type(attribute) {
    if (attribute === void 0) {
      attribute = '';
    }

    return typeof attribute === 'string' ? {
      ok: true,
      data: attribute
    } : {
      ok: false,
      data: null,
      message: "action.type must be a string. Received '" + attribute + "'",
      required: true
    };
  },
  payload: function payload(attribute) {
    if (attribute === void 0) {
      attribute = null;
    }

    return {
      ok: true,
      data: attribute
    };
  },
  interval: function interval(attribute) {
    if (attribute === void 0) {
      attribute = 0;
    }

    return Number.isInteger(attribute) ? {
      ok: true,
      data: attribute
    } : {
      ok: false,
      data: 0,
      message: "'" + attribute + "' invalid action.interval value"
    };
  },
  repeat: function repeat(attribute) {
    if (attribute === void 0) {
      attribute = 0;
    }

    return Number.isInteger(attribute) ? {
      ok: true,
      data: attribute
    } : {
      ok: false,
      data: 0,
      message: "'" + attribute + "' invalid action.repeat value"
    };
  },
  group: function group(attribute) {
    if (attribute === void 0) {
      attribute = '';
    }

    return typeof attribute === 'string' ? {
      ok: true,
      data: attribute
    } : {
      ok: false,
      data: null,
      message: "'" + attribute + "' invalid action.group value"
    };
  },
  callback: function callback(attribute) {
    if (attribute === void 0) {
      attribute = '';
    }

    return typeof attribute === 'string' ? {
      ok: true,
      data: attribute
    } : {
      ok: false,
      data: null,
      message: "'" + attribute + "' invalid action.callback value"
    };
  },
  log: function log(attribute) {
    if (attribute === void 0) {
      attribute = false;
    }

    return typeof attribute === 'boolean' ? {
      ok: true,
      data: attribute
    } : {
      ok: false,
      data: false,
      message: "'" + attribute + "' invalid action.log value"
    };
  },
  middleware: function middleware(attribute) {
    if (attribute === void 0) {
      attribute = null;
    }

    return typeof attribute === 'string' ? {
      ok: true,
      data: attribute
    } : {
      ok: false,
      data: null,
      message: "'" + attribute + "' invalid action.middleware value"
    };
  },
  at: function at(attribute) {
    if (attribute === void 0) {
      attribute = 0;
    }

    // const at = new Date()
    return {
      ok: false,
      data: attribute,
      message: "'" + attribute + "'  action.at is an experimental feature, not applied yet"
    };
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

var Cyre =
/*#__PURE__*/
function () {
  function Cyre(id, interval) {
    if (id === void 0) {
      id = '';
    }

    if (interval === void 0) {
      interval = 0;
    }

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

    this._quartz();
  }

  var _proto = Cyre.prototype;

  _proto._log = function _log(msg, clg) {
    if (clg === void 0) {
      clg = false;
    }

    return clg ? '!log into something else ' : console.log(msg);
  };

  _proto._wait = function _wait(type) {
    if (type === void 0) {
      type = null;
    }

    for (var _iterator = this.waitingList, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      var id = _ref;
      this.events[this.party[id].type] ? (this.waitingList.delete(id), this._initiate(id)) : console.log('@wait list nop');
    }
  };

  _proto._emitAction = function _emitAction(type, payload, response) {
    if (type === void 0) {
      type = '';
    }

    if (payload === void 0) {
      payload = {};
    }

    if (response === void 0) {
      response = {};
    }

    for (var _iterator2 = this.events[type], _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref2 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref2 = _i2.value;
      }

      var fn = _ref2;
      fn(payload, response); //add response
    }

    return {
      ok: true,
      done: true,
      data: type + " action emitted"
    };
  };

  _proto._recuperate = function _recuperate(result, value) {
    if (result === void 0) {
      result = {};
    }

    if (value === void 0) {
      value = 0;
    }

    result.data = result.ok ? result.data.sort(function (a, b) {
      return b - a;
    }).reverse() : [value];
    result.data = result.data[0] || result.data[1] || 0;
    return result;
  };

  _proto._quartz = function _quartz() {
    /*
      T.I.M.E. - K.E.E.P.E.R.
    */
    var now = performance.now();
    var time = now - this.timestamp; //Timed zone

    if (time >= this.interval) {
      this.timestamp = performance.now();
      var result = this.timeline.size ? this._processingUnit(this.timeline, this.interval) : {
        ok: false,
        data: []
      };
      this.interval = this._recuperate(result, this.interval).data;
    }

    this.recuperating = requestAnimationFrame(this._quartz.bind(this));
  };

  _proto._processingUnit = function _processingUnit(timeline, precision) {
    var _this = this;

    return new Promise(function (success) {
      var info = {
        ok: true,
        data: [],
        id: []
      };

      for (var _iterator3 = timeline, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref3 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref3 = _i3.value;
        }

        var id = _ref3;
        //deduct precision from action.timeout
        _this.party[id].timeout -= precision;
        info.data.push(_this.party[id].timeout);
        info.id.push(id);
        _this.party[id].timeout <= precision ? _this._sendAction(id) : false;
        success(info);
      }
    });
  };

  _proto._addToTimeline = function _addToTimeline(id) {
    return {
      ok: true,
      done: false,
      data: this.timeline.add(id)
    };
  };

  _proto._addToWaitingList = function _addToWaitingList(id) {
    this.waitingList.add(id);
    var response = {
      ok: true,
      done: false,
      id: id,
      data: this.party[id].payload,
      group: this.party[id].group || 0,
      message: 'added to action waiting list'
    };
    this.party[id].log ? this._log(response) : 0;
    return {
      ok: false,
      done: false,
      data: id + " added to waiting list"
    };
  };

  _proto._completeAction = function _completeAction(id) {
    this.timeline.delete(id);
    return true;
  };

  _proto._repeatAction = function _repeatAction(id) {
    this.party[id].timeout = this.party[id].interval;
    --this.party[id].repeat;
    return false;
  };

  _proto._sendAction = function _sendAction(id) {
    var done = this.party[id].repeat > 0 ? this._repeatAction(id) : this._completeAction(id);
    var response = {
      ok: true,
      done: done,
      id: id,
      data: this.party[id].payload,
      group: this.party[id].group || 0
    };
    this.party[id].log ? this._log(response) : 0;
    return this._emitAction(this.party[id].type, this.party[id].payload, response);
  };

  _proto._initiate = function _initiate(id) {
    return this.party[id].timeout === 0 ? this._sendAction(id) : this._addToTimeline(id);
  };

  _proto._dispatchAction = function _dispatchAction(id, type) {
    return this.events[type] ? this._initiate(id) : this._addToWaitingList(id);
  };

  _proto._createChannel = function _createChannel(action, dataDefinitions$$1) {
    var condition = this.party[action.id] ? 'update' : 'insert';
    var result = middleware[condition](action, dataDefinitions$$1);

    if (!result.ok) {
      console.error("@Cyre : Action could not be created for '" + action.id + "' " + result.message);
      return {
        ok: false,
        data: null,
        message: result.message
      };
    }

    this.party[action.id] = result.data;
    this.party[action.id].timeout = this.party[action.id].interval || 0;
    return {
      ok: true,
      data: true
    };
  } //system user interface
  ;

  _proto.off = function off(fn) {
    //remove unwanted listener
    for (var type in this.events) {
      return this.events[type].has(fn) ? {
        ok: true,
        data: this.events[type].delete(fn)
      } : {
        ok: false,
        data: 'Function type not found'
      };
    }
  };

  _proto.list = function list() {
    //list all registered functions action.type
    for (var type in this.events) {
      for (var _iterator4 = this.events[type], _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray4) {
          if (_i4 >= _iterator4.length) break;
          _ref4 = _iterator4[_i4++];
        } else {
          _i4 = _iterator4.next();
          if (_i4.done) break;
          _ref4 = _i4.value;
        }

        var fn = _ref4;

        this._log(fn.name);
      }
    }
  };

  _proto.clr = function clr() {
    //clear all iterating actions
    return this.timeline.clear();
  };

  _proto.pause = function pause(id) {
    // pause _quartz
    //need some work
    return this.timeline.has(id) ? this.timeline.delete(id) : false;
  } // User interfaces
  ;

  _proto.on = function on(type, fn, group) {
    var _this2 = this;

    if (group === void 0) {
      group = [];
    }

    return new Promise(function (success, reject) {
      typeof fn === 'function' ? success({
        ok: true,
        data: _this2.events[type] ? _this2.events[type].add([fn]) : (_this2.events[type] = new Set([fn]), _this2._wait(type))
      }) : reject({
        ok: false,
        data: 'invalid function',
        message: console.log(type, fn)
      });
    });
  };

  _proto.type = function type(id, _type) {
    console.log("cyre.type method not implemented yet in this version, would've update channel.id's type without dispatching the action");
  };

  _proto.channel = function channel(attribute) {
    if (attribute === void 0) {
      attribute = {};
    }

    if (this.party[attribute.id]) return console.error('@cyre.action: action already exist', attribute.id);
    return this._createChannel(attribute, dataDefinitions);
  };

  _proto.action = function action(attribute) {
    if (attribute === void 0) {
      attribute = {};
    }

    if (this.party[attribute.id]) return console.error('@cyre.action: action already exist', attribute.id);
    return this._createChannel(attribute, dataDefinitions);
  };

  _proto.emit = function emit(id, payload) {
    if (id === void 0) {
      id = null;
    }

    if (payload === void 0) {
      payload = null;
    }

    return this.party[id] ? (this.party[id].payload = payload, this._dispatchAction(id, this.party[id].type)) : console.error('@cyre.call : channel not found', id);
  };

  _proto.call = function call(id, payload) {
    if (id === void 0) {
      id = null;
    }

    if (payload === void 0) {
      payload = null;
    }

    this.emit(id, payload);
  } //dispatch accepts object type input eg {id: uber, type: call, payload: 0025100124}
  ;

  _proto.dispatch = function dispatch(attribute) {
    if (attribute === void 0) {
      attribute = {};
    }

    attribute.id = attribute.id ? attribute.id : null;
    attribute.type ? 0 : console.error('@cyre.dispatch : action type required for - ', attribute.id);
    return this._createChannel(attribute, dataDefinitions).ok ? {
      ok: true,
      data: this._dispatchAction(attribute.id, attribute.type)
    } : {
      ok: false,
      data: attribute.id,
      message: console.log("@Cyre couldn't dispatch action")
    };
  } //respond accepts array of input eg { uber,  call, 0025100124}
  ;

  _proto.respond = function respond(id, type, payload, interval, repeat) {
    if (id === void 0) {
      id = null;
    }

    if (type === void 0) {
      type = null;
    }

    if (payload === void 0) {
      payload = null;
    }

    if (interval === void 0) {
      interval = 0;
    }

    if (repeat === void 0) {
      repeat = 0;
    }

    var data = {
      id: id,
      type: type,
      payload: payload,
      interval: interval,
      repeat: repeat
    };

    this._createChannel(data, dataDefinitions);

    this._dispatchAction(data.id, data.type);

    return {
      ok: true,
      data: data.id
    };
  };

  return Cyre;
}();

var cyre = new Cyre('quantum-inceptions');

exports.cyre = cyre;
exports.Cyre = Cyre;
exports.default = cyre;
