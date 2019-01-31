export const middleware = {
    insert: (action, dataDefinitions) => {
        const data = {};
        for (const type in action) {
            data[type] = dataDefinitions[type] ? dataDefinitions[type](action[type]) : false;
        }
        return { ok: true, data }
    },
    update: (action, dataDefinitions) => {
        const data = {};
        for (const type in action) {
            data[type] = dataDefinitions[type] ? dataDefinitions[type](action[type]) : false;
        }
        return { ok: true, data }
    }
};
export default middleware