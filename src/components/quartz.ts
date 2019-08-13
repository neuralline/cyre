/** @format */

import _processingUnit from './processing-unit'

//@ts-check
//@TODO this.recuperating should pause quartz when its not in use
/**
 *
 * @param {Set} timeline
 * @param {object} party
 */
const _quartz = (timeline = new Set(), party = {}): object => {
  /*
      T.I.M.E. - K.E.E.P.E.R.
    */
  console.log('tyme')
  let timestamp = 0
  let recuperating = 1
  const timeKeeper = () => {
    const now = performance.now()
    const time: number = now - timestamp
    let precisionAdjustment: number = 20

    //Timed zone
    if (time >= precisionAdjustment) {
      return inTimeZone(timeline, party, precisionAdjustment)
    }
    if (timeline.size) {
      window.requestAnimationFrame(timeKeeper)
    } else {
      recuperating = 0
    }
  }
  return {...timeline}
}

/**
 *
 * @param {Set} timeline
 * @param {object} party
 * @param {number} interval
 * @param {function} callback
 */
export const inTimeZone = (timeline, party: object, precisionAdjustment: number): object => {
  console.log('@inTimeZone ')
  return timeline.size ? _processingUnit(timeline, party, precisionAdjustment) : {ok: false, payload: []}
}

export default _quartz
