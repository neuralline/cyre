export const middleware = {
    insert: (action, dataDefinitions) => {
        const data = {};
        for (const attribute in action) {
            data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false;
        }
        return { ok: true, data }
    },
    update: (action, dataDefinitions) => {
        const data = {};
        for (const attribute in action) {
            data[attribute] = dataDefinitions[attribute] ? dataDefinitions[attribute](action[attribute]) : false;
        }
        return { ok: true, data }
    }
};
export default middleware