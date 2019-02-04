// @ts-check
import middleware from './components/middleware';
import dataDefinitions from './components/data-definitions';

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
		console.log(
			'%c Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ',
			'background: purple; color: white; display: block;'
		);
		this._quartz();
	}

	_log(msg = '', c = 0) {
		return c ? console.log(msg) : console.log('!log into something else ', msg);
	}

	_wait(type = null) {
		for (let id of this.waitingList) {
			this.events[this.party[id].type]
				? (this.waitingList.delete(id), this._initiate(id))
				: console.log('@wait list nop');
		}
	}

	_emitAction(type, data, response, group = 0) {
		for (const fn of this.events[type]) {
			fn(data, response); //add response
		}
		return { ok: true, done: true, data: 'action emitted' };
	}

	_recuperate(result = {}, value = 0) {
		result.data = result.ok
			? result.data
					.sort((a, b) => {
						return b - a;
					})
					.reverse()
			: [ value ];
		result.data = result.data[0] || result.data[1] || 0;
		return result;
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
			const result = this.timeline.size
				? this._processingUnit(this.timeline, this.interval)
				: { ok: false, data: [] };
			this.interval = this._recuperate(result, this.interval).data;
		}
		this.recuperating = requestAnimationFrame(this._quartz.bind(this));
	}

	_processingUnit(timeline, precision) {
		return new Promise((success) => {
			let info = { ok: true, data: [], id: [] };
			for (const id of timeline) {
				//deduct precision from action.timeout
				this.party[id].timeout -= precision;
				info.data.push(this.party[id].timeout);
				info.id.push(id);
				this.party[id].timeout <= precision ? this._sendAction(id) : false;
				success(info);
			}
		});
	}

	_addToTimeline(id) {
		return { ok: true, done: false, data: this.timeline.add(id) };
	}

	_completedAction(id) {
		return { ok: true, done: true, data: this.timeline.delete(id) };
	}

	_repeatAction(id) {
		this.party[id].timeout = this.party[id].interval;
		return { ok: true, done: false, data: --this.party[id].repeat };
	}

	_sendAction(id) {
		return this._emitAction(
			this.party[id].type,
			this.party[id].payload,
			this.party[id].repeat > 0 ? this._repeatAction(id) : this._completedAction(id),
			this.party[id].group
		);
	}

	_initiate(id) {
		return this.party[id].timeout === 0 ? this._sendAction(id) : this._addToTimeline(id);
	}

	_dispatchAction(id, type) {
		return this.events[type] ? this._initiate(id) : { ok: false, done: false, data: this.waitingList.add(id) };
	}

	_createChannel(action, dataDefinitions$$1) {
		const condition = this.party[action.id] ? 'update' : 'insert';
		const result = middleware[condition](action, dataDefinitions$$1);
		result.ok
			? (this.party[action.id] = result.data)
			: { ok: false, data: console.log('@createAction : major malfunctions ', action.id) };
		this.party[action.id].timeout = this.party[action.id].interval || 0;
		return { ok: true, data: action };
	}

	//system user interface
	off(fn) {
		//remove unwanted listener
		for (let type in this.events) {
			return this.events[type].has(fn)
				? { ok: true, data: this.events[type].delete(fn) }
				: { ok: false, data: 'Function type not found' };
		}
	}

	list() {
		//list all registered functions action.type
		for (let type in this.events) {
			for (let fn of this.events[type]) {
				this._log(fn.name, 1);
			}
		}
	}

	clr() {
		//clear all iterating actions
		return this.timeline.clear();
	}

	pause(id) {
		// pause _quartz
		//need some work
		return this.timeline.has(id) ? this.timeline.delete(id) : false;
	}

	// User interfaces
	on(type, fn, group = []) {
		return new Promise((success, reject) => {
			typeof fn === 'function'
				? success({
						ok: true,
						data: this.events[type]
							? this.events[type].add([ fn ])
							: ((this.events[type] = new Set([ fn ])), this._wait(type))
					})
				: reject({ ok: false, data: 'invalid function', message: console.log(type, fn) });
		});
	}

	type(id, type) {
		console.log(
			`cyre.type method not implemented yet in this version, would've update channel.id's type without dispatching the action`
		);
	}

	channel(attribute = {}) {
		if (this.party[attribute.id]) return console.error('@cyre.action: action already exist', attribute.id);
		return this._createChannel(attribute, dataDefinitions);
	}

	action(attribute = {}) {
		if (this.party[attribute.id]) return console.error('@cyre.action: action already exist', attribute.id);
		return this._createChannel(attribute, dataDefinitions);
	}

	emit(id = null, payload = null) {
		this.party[id]
			? ((this.party[id].payload = payload), this._dispatchAction(id, this.party[id].type))
			: console.error('@cyre.call : channel not found', id);
	}

	call(id = null, payload = null) {
		this.emit(id, payload);
	}

	//dispatch accepts object type input eg {id: uber, type: call, payload: 0025100124}
	dispatch(attribute = {}) {
		attribute.id = attribute.id ? attribute.id : null;
		attribute.type ? 0 : console.error('@cyre.dispatch : action type required for - ', attribute.id);
		return this._createChannel(attribute, dataDefinitions).ok
			? { ok: true, data: this._dispatchAction(attribute.id, attribute.type) }
			: { ok: true, data: attribute.id };
	}

	//respond accepts array of input eg { uber,  call, 0025100124}
	respond(id = null, type = null, payload = null, interval = 0, repeat = 0) {
		const data = { id, type, payload, interval, repeat };
		this._createChannel(data, dataDefinitions);
		this._dispatchAction(data.id, data.type);
		return { ok: true, data: data.id };
	}
}

const cyre = new Cyre('quantum-inceptions');

export { cyre, Cyre };
