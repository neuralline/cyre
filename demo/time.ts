// demo/time.ts

import {log} from '../src'
import TimeKeeper from '../src/components/cyre-timekeeper'

// 1. Simple delays in async functions
async function processData() {
  console.log('Processing...')
  await TimeKeeper.wait(2000) // Wait 2 seconds
  console.log('Done!')
}

// 2. Rate limiting
async function apiCall() {
  log.info('hiyaa')
  await TimeKeeper.wait(5000) // Wait before next call
  log.critical('woooow')
  await TimeKeeper.wait(5000) // Wait before next call
  log.sys('final')
}

processData()
apiCall()
