(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
typeof define === 'function' && define.amd ? define(['exports'], factory) :
(global = global || self, factory(global.Cyre = {}));
}(this, function (exports) { 'use strict';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

var _this = undefined;
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
var _prepareActionToEmit = function (party, events) {
    var response = __assign({}, party, { ok: true, done: true });
    // console.log('@party true ', party)
    // party.log ? _log(response) : false
    return response;
};
var _repeatAction = function (party) {
    return party.repeat ? __assign({}, party, { timeout: party.interval, ok: true, done: false }) : __assign({}, party); // _removeTaskFromTimeline(party, new Set())
};
var _emitAction = function (party, events) {
    events[party.type].forEach(function (fn) { return fn(party.payload, party); });
    return __assign({}, party, { listeners: events[party.type].size });
};
var _initiateAction = function (party, events) {
    return events[party.type] ? true : false; //_addToWaitingList(party)
};
var Action = function (party, events) { return __awaiter(_this, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                try {
                    party = _prepareActionToEmit(party, events);
                    party = _emitAction(party, events);
                    party = _repeatAction(party);
                }
                catch (_c) {
                }
                if (!_initiateAction) return [3 /*break*/, 2];
                return [4 /*yield*/, Promise.all([_prepareActionToEmit, _emitAction, _repeatAction])];
            case 1:
                _a = _b.sent();
                return [3 /*break*/, 3];
            case 2:
                _a = __assign({}, party, { ok: false, done: false });
                _b.label = 3;
            case 3:
                return [2 /*return*/, party];
        }
    });
}); };

//@ts-check
var middleware = {
    /**
     *@param{object} action cyre.action
     *@param{object} dataDefinitions action attributes
    
    */
    insert: function (action, dataDefinitions) {
        var data = {};
        action.type = action.type || action.id;
        for (var attribute in action) {
            data[attribute] = dataDefinitions[attribute]
                ? dataDefinitions[attribute](action[attribute])
                : {
                    ok: false,
                    payload: null,
                    message: "'" + attribute + "' data definition not found",
                    required: false
                };
            if (!data[attribute].ok && data[attribute].required) {
                console.warn('required :', data);
                return { ok: false, payload: data, message: data[attribute].message };
            }
            data[attribute].ok ? true : console.error(data[attribute].message);
            data[attribute] = data[attribute].payload;
        }
        return { ok: true, message: 'channel created', payload: data };
    },
    /**
     *@param{object} action cyre.action
     *@param{object} dataDefinitions action attributes
    
    */
    update: function (action, dataDefinitions) {
        var data = {};
        for (var attribute in action) {
            data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false;
            data[attribute].ok ? true : console.error(data[attribute].message);
            data[attribute] = data[attribute].data;
        }
        return { ok: true, message: 'channel updated', payload: data };
    }
};

/**
 * @format
 * @param {object} action action cyre.action
 * @param {object} dataDefinitions$$1 data definitions for available action attributes
 */
var createChannel = function (party, dataDefinitions) {
    party.type ? false : (party.type = party.id);
    var condition = party ? 'insert' : 'update';
    var result = middleware[condition](party, dataDefinitions);
    if (!result.ok) {
        //console.error(`@Cyre : Action could not be created for '${action.id}' ${result.message}`)
        return { ok: false, payload: condition, message: result.message };
    }
    return __assign({}, party, result.payload, { timeout: party.interval || 0, ok: true });
};

//@ts-check
var dataDefinitions = {
    id: function (attribute) {
        if (attribute === void 0) { attribute = null; }
        return typeof attribute === 'string'
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: null,
                message: "action.id must be a string. Received '" + attribute + "'",
                required: true
            };
    },
    type: function (attribute) {
        if (attribute === void 0) { attribute = null; }
        return typeof attribute === 'string'
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: null,
                message: "action.type must be a string. Received '" + attribute + "'",
                required: true
            };
    },
    payload: function (attribute) {
        if (attribute === void 0) { attribute = null; }
        return { ok: true, payload: attribute };
    },
    interval: function (attribute) {
        if (attribute === void 0) { attribute = 0; }
        return Number.isInteger(attribute)
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: 0,
                message: "'" + attribute + "' invalid action.interval value",
                required: false
            };
    },
    repeat: function (attribute) {
        if (attribute === void 0) { attribute = 0; }
        return Number.isInteger(attribute)
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: 0,
                message: "'" + attribute + "' invalid action.repeat value",
                required: false
            };
    },
    message: function (attribute) {
        if (attribute === void 0) { attribute = ''; }
        return typeof attribute === 'string'
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: '',
                message: "action.message must be a string. Received '" + attribute + "'",
                required: false
            };
    },
    /**
     * feature attributes
     */
    group: function (attribute) {
        if (attribute === void 0) { attribute = null; }
        return typeof attribute === 'string'
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: null,
                message: "'" + attribute + "' invalid action.group value",
                required: false
            };
    },
    callback: function (attribute) {
        if (attribute === void 0) { attribute = null; }
        return typeof attribute === 'string'
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: null,
                message: "'" + attribute + "' invalid action.callback value",
                required: false
            };
    },
    log: function (attribute) {
        if (attribute === void 0) { attribute = false; }
        return typeof attribute === 'boolean'
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: false,
                message: "'" + attribute + "' invalid action.log value",
                required: false
            };
    },
    middleware: function (attribute) {
        if (attribute === void 0) { attribute = null; }
        return typeof attribute === 'string'
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: null,
                message: "'" + attribute + "' invalid action.middleware value",
                required: false
            };
    },
    at: function (attribute) {
        if (attribute === void 0) { attribute = 0; }
        // const at = new Date()
        return {
            ok: false,
            payload: attribute,
            message: "'" + attribute + "'  action.at is an experimental feature, not applied yet",
            required: false
        };
    }
};

var error = function (msg) {
    console.error(msg);
};

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
var Cyre = function (line) {
    var globalEvents = {};
    var globalParty = {};
    var constructor = function (id, interval) {
        console.log('%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ', 'background: rgb(151, 2, 151); color: white; display: block;');
    };
    var setParty = function (state) {
        var id = state.id;
        globalParty[id] = __assign({}, state);
        //call(id, {...state})
    };
    var on = function (type, fn) {
        var result = typeof fn === 'function' && type !== ''
            ? {
                ok: true,
                payload: globalEvents[type]
                    ? globalEvents[type].add([fn])
                    : (globalEvents[type] = new Set([fn]))
            }
            : { ok: false, message: 'invalid function' };
        return __assign({}, result, { payload: type });
    };
    /*  cyre-channel.ts was here */
    var action = function (attribute) {
        if (!attribute)
            return {
                ok: false,
                payload: undefined,
                message: '@cyre.action: action id is required'
            };
        if (globalParty[attribute.id]) {
            error("@cyre.action: action already exist " + attribute.id);
            return {
                ok: false,
                payload: attribute.id,
                message: 'action already exist'
            };
        }
        var party = createChannel(attribute, dataDefinitions);
        return setParty(party);
    };
    var call = function (id, payload) {
        if (id === void 0) { id = ''; }
        if (payload === void 0) { payload = null; }
        if (!id.trim()) {
            error("@cyre.call : id does not exist " + id);
            return {
                ok: false,
                payload: undefined,
                message: '@cyre.call : id does not exist'
            };
        }
        if (!globalParty[id]) {
            error("@cyre.call: action does not exist " + id);
            return {
                ok: false,
                payload: undefined,
                message: '@cyre.call : action not found ' + id
            };
        }
        var res = Action(__assign({}, globalParty[id], { payload: payload }), globalEvents).then(function (data) { return setParty(__assign({}, data, { payload: null })); });
        globalParty[id].timeout === 0 ? true : false; //_sendActonToTimeline(party)
    };
    var test = function () {
        return {
            ok: true,
            payload: 200,
            message: 'Cyre: Hi there, what can I help you with'
        };
    };
    return {
        test: test,
        call: call,
        //dispatch,
        action: action,
        //channel,
        //type,
        on: on,
        //emit,
        constructor: constructor
    };
};
var cyre = Cyre();
cyre.constructor();

exports.Cyre = Cyre;
exports.cyre = cyre;
exports.default = cyre;

Object.defineProperty(exports, '__esModule', { value: true });

}));
