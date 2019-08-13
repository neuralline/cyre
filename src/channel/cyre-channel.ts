/* const action = (attribute: Party) => {
  if (globalParty[attribute.id]) {
    error(`@cyre.action: action already exist ${attribute.id}`)
    return {ok: false, payload: attribute.id, message: 'action already exist'}
  }
  const party = createChannel(attribute, dataDefinitions).data
  return setParty(party, party)
}
 */

export default () => 'hello'
