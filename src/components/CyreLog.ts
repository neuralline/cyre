export const CyreLog = (msg: {}, clg: boolean = false) => {
  clg ? '!log into something else ' : console.log({...msg})
  return true
}

export const CyreError = (log: {}) => {
  console.error('@cyre.error: ', {...log})
}
