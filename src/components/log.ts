export const log = (msg: string, clg: boolean = false) => {
  clg ? '!log into something else ' : console.log(msg)
  return true
}

export const error = (msg: string) => {
  console.error(msg)
}
