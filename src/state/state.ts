import {Party, Events} from '../interfaces/interface'

const setState = (state: object = {}, party: Party, call) => {
  const id = party.id
  call(id, {...state})
  return {...state}
}
