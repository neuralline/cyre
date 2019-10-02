export interface dataDefinitions {
  id: string
  type: string
  payload: any
  interval?: number
  throttle?: number | boolean
  debounce?: number | boolean
  repeat?: number
  group?: string
  middleware?: object
  definitions?: object
  at?: number
  ok?: boolean
  done?: boolean
  onError: string
  timeout?: number
  log?: boolean
  message?: string
  toc?: number
  internalNeuron?: object | undefined | boolean
}

export interface Party {
  ok?: boolean
  done?: boolean
  id?: string
  appID?: string
  type?: string
  payload?: any
  timeout?: number
  interval?: number
  throttle?: number
  debounce?: number
  repeat?: number
  log?: boolean
  toc?: number
  message?: string
  onError?: string
  hold?: number
  holding?: boolean
  isThrottling?: boolean
  isBouncing?: boolean
  internalNeuron?: [{id:string, payload:any}]
}
export interface Events {
  type?: {}
  has?: any
  fn?: Function
  appID?: string
  onError?: string
}
