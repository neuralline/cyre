const emit = (id: string, payload: any) => {
  console.log('@emit/call : ', id)
  return {id, payload}
}
export default emit
