!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((t=t||self).Cyre={})}(this,function(t){"use strict";var e={insert:function(t,e){var i={};for(var a in t.id=t.id||null,t.type=t.type||t.id,t){if(i[a]=e[a]?e[a](t[a]):{ok:!1,data:null,message:"'"+a+"' data definition not found",required:!1},!i[a].ok&&i[a].required)return{ok:!1,data:i,message:i[a].message};i[a].ok||console.error(i[a].message),i[a]=i[a].data}return{ok:!0,data:i}},update:function(t,e){var i={};for(var a in t)i[a]=!!e[a]&&e[a](t[a]),i[a].ok||console.error(i[a].message),i[a]=i[a].data;return{ok:!0,data:i}}},i={id:function(t){return void 0===t&&(t=0),"string"!=typeof t?{ok:!1,data:null,message:"action.id must be a string. Received '"+t+"'",required:!0}:{ok:!0,data:t,required:!0}},type:function(t){return void 0===t&&(t=""),"string"==typeof t?{ok:!0,data:t}:{ok:!1,data:null,message:"action.type must be a string. Received '"+t+"'",required:!0}},payload:function(t){return void 0===t&&(t=null),{ok:!0,data:t}},interval:function(t){return void 0===t&&(t=0),Number.isInteger(t)?{ok:!0,data:t}:{ok:!1,data:0,message:"'"+t+"' invalid action.interval value"}},repeat:function(t){return void 0===t&&(t=0),Number.isInteger(t)?{ok:!0,data:t}:{ok:!1,data:0,message:"'"+t+"' invalid action.repeat value"}},group:function(t){return void 0===t&&(t=""),"string"==typeof t?{ok:!0,data:t}:{ok:!1,data:null,message:"'"+t+"' invalid action.group value"}},callback:function(t){return void 0===t&&(t=""),"string"==typeof t?{ok:!0,data:t}:{ok:!1,data:null,message:"'"+t+"' invalid action.callback value"}},log:function(t){return void 0===t&&(t=!1),"boolean"==typeof t?{ok:!0,data:t}:{ok:!1,data:!1,message:"'"+t+"' invalid action.log value"}},middleware:function(t){return void 0===t&&(t=null),"string"==typeof t?{ok:!0,data:t}:{ok:!1,data:null,message:"'"+t+"' invalid action.middleware value"}},at:function(t){return void 0===t&&(t=0),{ok:!1,data:t,message:"'"+t+"'  action.at is an experimental feature, not applied yet"}}},a=function(){function t(t,e){void 0===t&&(t=""),void 0===e&&(e=0),this.id=t,this.interval=e||16,this.events={},this.timestamp=0,this.timeline=new Set,this.waitingList=new Set,this.group=[],this.party={},this.precision=17,this.recuperating=0,this.error=0,console.log("%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ","background: rgb(151, 2, 151); color: white; display: block;")}var a=t.prototype;return a._log=function(t,e){return void 0===e&&(e=!1),e?"!log into something else ":console.log(t)},a._taskWaitingList=function(t){for(var e=Array.isArray(a=this.waitingList),i=0,a=e?a:a[Symbol.iterator]();;){var n;if(e){if(i>=a.length)break;n=a[i++]}else{if((i=a.next()).done)break;n=i.value}var o=n;this.events[this.party[o].type]?(this.waitingList.delete(o),this._initiate(o)):console.log("@cyre: type is not in waiting list")}},a._emitAction=function(t,e,i){void 0===t&&(t=""),void 0===e&&(e={}),void 0===i&&(i={});for(var a=Array.isArray(o=this.events[t]),n=0,o=a?o:o[Symbol.iterator]();;){var r;if(a){if(n>=o.length)break;r=o[n++]}else{if((n=o.next()).done)break;r=n.value}r(e,i)}return{ok:!0,done:!0,data:t+" action emitted"}},a._recuperate=function(t,e){return void 0===t&&(t={}),void 0===e&&(e=0),t.data=t.ok?t.data.sort(function(t,e){return e-t}).reverse():[e],t.data=t.data[0]||t.data[1]||0,t},a._quartz=function(){var t=performance.now()-this.timestamp;if(this.recuperating=1,t>=this.interval){this.timestamp=performance.now();var e=this.timeline.size?this._processingUnit(this.timeline,this.interval):{ok:!1,data:[]};this.interval=this._recuperate(e,this.interval).data}this.timeline.size?window.requestAnimationFrame(this._quartz.bind(this)):(window.cancelAnimationFrame(this._quartz.bind(this)),this.recuperating=0)},a._processingUnit=function(t,e){var i=this;return new Promise(function(a){for(var n={ok:!0,data:[],id:[]},o=Array.isArray(s=t),r=0,s=o?s:s[Symbol.iterator]();;){var d;if(o){if(r>=s.length)break;d=s[r++]}else{if((r=s.next()).done)break;d=r.value}var u=d;i.party[u].timeout-=e,n.data.push(i.party[u].timeout),n.id.push(u),e>=i.party[u].timeout&&i._sendAction(u),a(n)}})},a._addToTimeline=function(t){return this.timeline.add(t),this.recuperating||this._quartz(),{ok:!0,done:!1,data:""}},a._addToWaitingList=function(t){return this.waitingList.add(t),this.party[t].log&&this._log({ok:!0,done:!1,id:t,data:this.party[t].payload,group:this.party[t].group||0,message:"added to action waiting list"}),{ok:!1,done:!1,data:t+" added to waiting list"}},a._completeAction=function(t){return this.timeline.delete(t),!0},a._repeatAction=function(t){return this.party[t].timeout=this.party[t].interval,--this.party[t].repeat,!1},a._sendAction=function(t){var e={ok:!0,done:this.party[t].repeat>0?this._repeatAction(t):this._completeAction(t),id:t,data:this.party[t].payload,group:this.party[t].group||0};return this.party[t].log&&this._log(e),this._emitAction(this.party[t].type,this.party[t].payload,e)},a._initiate=function(t){return 0===this.party[t].timeout?this._sendAction(t):this._addToTimeline(t)},a._dispatchAction=function(t,e){return this.events[e]?this._initiate(t):this._addToWaitingList(t)},a._createChannel=function(t,i){var a=this.party[t.id]?"update":"insert",n=e[a](t,i);return n.ok?(this.party[t.id]=n.data,this.party[t.id].timeout=this.party[t.id].interval||0,{ok:!0,data:a}):{ok:!1,data:a,message:n.message}},a.off=function(t){for(var e in this.events)return this.events[e].has(t)?{ok:!0,data:this.events[e].delete(t)}:{ok:!1,data:"function not found"}},a.list=function(){for(var t in this.events)for(var e=Array.isArray(a=this.events[t]),i=0,a=e?a:a[Symbol.iterator]();;){var n;if(e){if(i>=a.length)break;n=a[i++]}else{if((i=a.next()).done)break;n=i.value}this._log(t+" "+n.name)}},a.clr=function(){return this.timeline.clear()},a.pause=function(t){return!!this.timeline.has(t)&&this.timeline.delete(t)},a.on=function(t,e,i){return void 0===i&&(i=[]),"function"==typeof e&&""!==t?{ok:!0,data:this.events[t]?this.events[t].add([e]):(this.events[t]=new Set([e]),this._taskWaitingList(t))}:{ok:!1,data:t,message:"invalid function"}},a.type=function(t,e){console.log("cyre.type method not implemented yet in this version, would've update channel.id's type without dispatching the action")},a.channel=function(t){return void 0===t&&(t={}),this.party[t.id]?(console.error("@cyre.action: action already exist",t.id),{ok:!1,data:t.id,message:"action already exist"}):this._createChannel(t,i)},a.action=function(t){return void 0===t&&(t={}),this.party[t.id]?(console.error("@cyre.action: action already exist",t.id),{ok:!1,data:t.id,message:"action already exist"}):this._createChannel(t,i)},a.call=function(t,e){return void 0===t&&(t=""),void 0===e&&(e=null),this.party[t]?(e&&(this.party[t].payload=e),this._dispatchAction(t,this.party[t].type)):{ok:!1,data:console.error("@cyre.call : action not found",t)}},a.emit=function(t,e){return this.call(t,e)},a.dispatch=function(t){return void 0===t&&(t={}),t.id=t.id?t.id:"",!t.type&&console.error("@cyre.dispatch : action type required for - ",t.id),this._createChannel(t,i).ok?{ok:!0,data:this._dispatchAction(t.id,t.type)}:{ok:!1,data:t.id,message:console.log("@Cyre couldn't dispatch action")}},a.test=function(){return{ok:!0,data:200,message:"Cyre: Hi there, what can I help you with"}},t}(),n=new a("quantum-inceptions");t.cyre=n,t.Cyre=a,t.default=n,Object.defineProperty(t,"__esModule",{value:!0})});
