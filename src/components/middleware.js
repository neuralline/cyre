export const middleware = {
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
export default middleware