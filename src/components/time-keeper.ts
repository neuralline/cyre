/** @format */

import _processingUnit from './processing-unit'

//@ts-check
//@TODO this.recuperating should pause quartz when its not in use
/**
 *
 * @param {Set} timeline
 * @param {object} bot
 */
const _quartz = (timeline: [] = [], bot = {}): object => {
  /*
      T.I.M.E. - K.E.E.P.E.R.
    */
  console.log('TYME')
  let timestamp = 0
  let recuperating = 1

  return {...timeline}
}

/**
 *
 * @param {Set} timeline
 * @param {object} bot
 * @param {number} interval
 * @param {function} callback
 */
export const inTimeZone = (
  timeline,
  bot: object,
  precisionAdjustment: number
): object => {
  console.log('@inTimeZone ')
  return timeline.size
    ? _processingUnit(timeline, bot, precisionAdjustment)
    : {ok: false, payload: []}
}

const timeKeeper = () => {
  const now = performance.now()
  const time: number = now - timestamp
  let precisionAdjustment: number = 20

  //Timed zone
  if (time >= precisionAdjustment) {
    return inTimeZone(timeline, bot, precisionAdjustment)
  }
  if (timeline.length) {
    window.requestAnimationFrame(timeKeeper)
  } else {
    recuperating = 0
  }
}

export default _quartz
