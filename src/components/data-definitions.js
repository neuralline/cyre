export const dataDefinitions = {
    id: (x) => {
        return (typeof x === 'string') ? x : 0
    },
    type: (x) => {
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
export default dataDefinitions