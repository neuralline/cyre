export const dataDefinitions = {
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
export default dataDefinitions