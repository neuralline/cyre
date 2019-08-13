export interface dataDefinitions {
  id: [string | number]
  type: [string]

  payload: any

  interval: number

  group: string

  callback: any

  log: [string, string]

  middleware: any

  at: number
}

export interface Party {
  ok?: boolean
  done?: boolean
  id?: string
  type?: string
  payload?: any
  timeout?: number
  interval?: number
  repeat?: number
  log?: boolean
}
export interface Events {
  type?: {}
}
