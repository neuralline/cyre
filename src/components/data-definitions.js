//@ts-check
const dataDefinitions = {
	id: (attribute = 0) => {
		if (typeof attribute !== 'string') {
			return {
				ok: false,
				data: null,
				message: `@Cyre : '${attribute}' action.id is mandatory and must be a string`
			};
		}

		return { ok: true, data: attribute };
	},
	type: (attribute = null) => {
		return typeof attribute === 'string'
			? { ok: true, data: attribute }
			: {
					ok: false,
					data: null,
					message: `@Cyre : '${attribute}' action.type is mandatory and must be a string`
				};
	},

	payload: (attribute = null) => {
		return { ok: true, data: attribute };
	},

	interval: (attribute = 0) => {
		return Number.isInteger(attribute)
			? { ok: true, data: attribute }
			: {
					ok: false,
					attribute: 0,
					message: `@Cyre : '${attribute}' invalid action.interval value`
				};
	},

	repeat: (attribute = 0) => {
		return Number.isInteger(attribute)
			? { ok: true, data: attribute }
			: {
					ok: false,
					attribute: 0,
					message: `@Cyre : '${attribute}' invalid action.repeat value`
				};
	},

	group: (attribute = null) => {
		return typeof attribute === 'string'
			? { ok: true, data: attribute }
			: {
					ok: false,
					data: null,
					message: `@Cyre : '${attribute}' invalid action.group value`
				};
	},

	callback: (attribute = null) => {
		return typeof attribute === 'string'
			? { ok: true, data: attribute }
			: {
					ok: false,
					data: null,
					message: `@Cyre : '${attribute}' invalid action.callback value`
				};
	},

	log: (attribute = false) => {
		return typeof attribute === 'boolean'
			? { ok: true, data: attribute }
			: {
					ok: false,
					attribute: false,
					message: `@Cyre : '${attribute}' invalid action.log value`
				};
	},

	middleware: (attribute = null) => {
		return typeof attribute === 'string'
			? { ok: true, data: attribute }
			: {
					ok: false,
					data: null,
					message: `@Cyre : '${attribute}' invalid action.middleware value`
				};
	},

	at: (attribute) => {
		// const at = new Date()
		return {
			ok: false,
			data: attribute,
			message: `@Cyre : '${attribute}'  action.at is in experimental state`
		};
	}
};
export default dataDefinitions;
