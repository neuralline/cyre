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

function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
}

var CyreLog = function (msg, clg) {
    if (clg === void 0) { clg = false; }
    clg ? '!log into something else ' : console.log(__assign({}, msg));
    return true;
};
var CyreError = function (log) {
    console.error('@cyre.error: ', __assign({}, log));
};

//@ts-check
var middleware = {
    /**
     *@param{object} action cyre.action
     *@param{object} dataDefinitions action attributes
    
    */
    insert: function (action, dataDefinitions) {
        var data = {};
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
                CyreError('required :' + data);
                return {
                    ok: false,
                    payload: data,
                    message: data[attribute].message
                };
            }
            data[attribute].ok ? true : CyreError(data[attribute]);
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
            data[attribute] = dataDefinitions[attribute]
                ? dataDefinitions[attribute](action[attribute])
                : false;
            data[attribute].ok
                ? true
                : console.error(data[attribute].message);
            data[attribute] = data[attribute].data;
        }
        return { ok: true, message: 'channel updated', payload: data };
    }
};

/**
 *
 * @  handles the process of creating channel
 * @
 */
var CyreChannel = function (bot, dataDefinitions) {
    var condition = bot ? 'insert' : 'update';
    var response = middleware[condition](bot, dataDefinitions);
    if (!response.ok) {
        CyreError("@Cyre : Action could not be created for '" + bot.id + "' " + response.message);
        return {
            ok: false,
            payload: condition,
            message: response.message
        };
    }
    return __assign(__assign(__assign({}, bot), response.payload), { timeout: bot.interval || 0, ok: true });
};

var _prepareActionToEmit = function (io, events) {
    var response = __assign(__assign({}, io), { ok: true, done: true });
    return response;
};
var _repeatAction = function (io) {
    return io.repeat ? __assign(__assign({}, io), { timeout: io.interval, done: false }) : __assign({}, io); // _removeTaskFromTimeline(io, [])
};
var _emitAction = function (io, events) {
    if (events === void 0) { events = []; }
    var internalNeuron = [];
    events.forEach(function (fn) {
        try {
            internalNeuron.push(fn(io.payload) || []);
        }
        catch (err) {
            CyreError({ id: io.id, err: err });
        }
    });
    return __assign(__assign({}, io), { ok: true, listeners: events.length, internalNeuron: internalNeuron });
};
var _initiateAction = function (io, events) {
    if (events === void 0) { events = []; }
    return events ? true : false;
};
var CyreAction = function (io, events) {
    if (events === void 0) { events = []; }
    return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    try {
                        io = _prepareActionToEmit(io, events);
                        io = _emitAction(io, events);
                        io = _repeatAction(io);
                    }
                    catch (_c) {
                    }
                    if (!_initiateAction(io, events)) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.all([_prepareActionToEmit, _emitAction, _repeatAction])];
                case 1:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = __assign(__assign({}, io), { ok: false, done: false });
                    _b.label = 3;
                case 3:
                    if (io.log)
                        CyreLog(__assign({}, io));
                    return [4 /*yield*/, io];
                case 4: return [2 /*return*/, _b.sent()];
            }
        });
    });
};

var CyreOn = function (events, fn) {
    if (events === void 0) { events = []; }
    if (typeof fn !== 'function') {
        return { ok: false, message: 'invalid function', payload: fn };
    }
    events.push(fn);
    return {
        ok: true,
        message: '@cyre.on : subscription successful',
        payload: __spreadArrays(events)
    };
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
    toc: function (attribute) {
        if (attribute === void 0) { attribute = 0; }
        return Number.isInteger(attribute)
            ? { ok: true, payload: attribute }
            : {
                ok: false,
                payload: 0,
                message: "'" + attribute + "' invalid @cyre.call time of creation value",
                required: true
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
var Cyre = function (line) {
    var _this = this;
    var globalEvents = {};
    var globalParty = {};
    var state = { globalEvents: globalEvents, globalTimeline: {}, globalParty: globalParty };
    var constructor = function (id, interval) {
        console.log('%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0--2.L3 ', 'background: rgb(151, 2, 151); color: white; display: block;');
    };
    var setState = function (id, action) {
        state[id][action.id] = __assign({}, action);
        //call(id, {...state})
    };
    var setParty = function (state) {
        var id = state.id;
        globalParty[id] = __assign({}, state);
        //call(id, {...state})
    };
    var on = function (type, fn) {
        var subscribers = [];
        if (Array.isArray(type)) {
            var dValue = type.map(function (bot) {
                var name = bot.id;
                var func = bot.payload;
                subscribers = globalEvents[name] ? __spreadArrays(globalEvents[name]) : [];
                globalEvents[name] = CyreOn(subscribers, func).payload;
                /**
                 * seeing the possibility if this process can be handled by cyre create channel
                 * const action = CyreChannel(attribute, typeDefinitions)
                 */
            });
        }
        else if (typeof type === 'string' && typeof fn === 'function') {
            subscribers = globalEvents[type] ? __spreadArrays(globalEvents[type]) : [];
            globalEvents[type] = CyreOn(subscribers, fn).payload;
        }
        else
            return {
                ok: false,
                message: 'invalid function',
                payload: type
            };
        return this;
    };
    /*  cyre-channel.ts was here */
    var action = function (attribute) {
        if (!attribute) {
            CyreLog({
                ok: false,
                payload: undefined,
                message: '@cyre.action: action id is required'
            });
        }
        else if (Array.isArray(attribute)) {
            attribute.forEach(function (bot) {
                bot.type = bot.type || bot.id;
                setParty(CyreChannel(bot, dataDefinitions));
            });
        }
        else {
            attribute.type = attribute.type || attribute.id;
            setParty(CyreChannel(attribute, dataDefinitions));
        }
    };
    var call = function (id, payload) {
        if (id === void 0) { id = null; }
        if (payload === void 0) { payload = null; }
        var io = {
            id: id.trim() || null,
            ok: false,
            done: false,
            toc: performance.now(),
            payload: payload
        };
        if (!io.id) {
            CyreError({
                ok: false,
                done: false,
                payload: null,
                message: '@cyre.call: id does not exist'
            });
            return false;
        }
        if (!globalParty[io.id]) {
            CyreError({
                ok: false,
                done: false,
                toc: performance.now(),
                payload: null,
                message: "@cyre.call: " + id + "; The subscriber you called is not responding "
            });
            return false;
        }
        if (globalParty[io.id].isThrottling)
            return;
        io = payload
            ? __assign(__assign(__assign({}, io), globalParty[io.id]), { payload: payload }) : __assign(__assign({}, io), globalParty[io.id]);
        if (globalParty[io.id].isBouncing)
            return;
        if (io.timeout === 0) {
            if (io.throttle) {
                globalParty[io.id].isThrottling = true;
                io.hold = io.throttle || 1000;
            }
            else if (io.debounce) {
                globalParty[io.id].isBouncing = true;
                io.hold = io.throttle || 1000;
            }
            CyreAction(__assign({}, io), globalEvents[io.type]).then(function (data) {
                if (data.internalNeuron) {
                    data.internalNeuron.map(function (internal) {
                        if (internal.id) {
                            call(internal.id, internal.payload || null);
                        }
                    });
                }
            });
        }
        else {
            sendActionToTimeline(io);
        }
    };
    var sendActionToTimeline = function (io) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('@cyre.timeline : action sent to timeline ', io);
                    return [4 /*yield*/, setTimeout(function () {
                            console.log('@cyre.timeline : action has been executed');
                            CyreAction(io, globalEvents[io.type]).then(function (data) {
                                setState('globalEvents', __assign({}, data));
                            }, io.timeout);
                        })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, false];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    /**
     * new feature to chain commands in one thread like structure
     *
    **/
    var chain = function () {
    };
    var test = function () {
        return {
            ok: true,
            payload: 200,
            message: '@cyre: Hi there, what can I help you with?'
        };
    };
    return {
        test: test,
        call: call,
        //dispatch,
        action: action,
        chain: chain,
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
