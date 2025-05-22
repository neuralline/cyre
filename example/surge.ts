//src/test/quantum-surge.ts

import {cyre, log} from '../src/app'

/*

    C.Y.R.E. - Q.U.A.N.T.U.M. S.U.R.G.E.
    Stress test for Cyre protection system

*/

let messageCount = 0
let surgeCount = 0
let chainDepth = 0

// Create a deeper chain reaction
cyre.on([
  {
    id: 'quantum-initiator',
    fn: payload => {
      // Massive parallel surge
      for (let i = 0; i < 50; i++) {
        // Increased from 10 to 50
        messageCount++
        cyre.call('quantum-amplifier', {
          id: messageCount,
          thread: i,
          depth: 0,
          timestamp: Date.now()
        })
      }
    }
  },
  {
    id: 'quantum-amplifier',
    fn: payload => {
      surgeCount++
      chainDepth = Math.max(chainDepth, payload.depth)

      // Create chain reaction
      if (payload.depth < 3) {
        // Allow up to 3 levels deep
        for (let i = 0; i < 3; i++) {
          // Each level creates 3 more
          cyre.call('quantum-amplifier', {
            id: `${payload.id}-${i}`,
            thread: payload.thread,
            depth: payload.depth + 1,
            timestamp: payload.timestamp
          })
        }
      }

      // Also trigger reactor
      cyre.call('quantum-reactor', {
        ...payload,
        processTime: Date.now()
      })
    }
  },
  {
    id: 'quantum-reactor',
    fn: payload => {
      const totalDelay = Date.now() - payload.timestamp
      const processDelay = Date.now() - payload.processTime

      log.info(
        `Reactor [ID: ${payload.id}, Thread: ${payload.thread}, Depth: ${payload.depth}] ` +
          `Total delay: ${totalDelay}ms, Process delay: ${processDelay}ms`
      )
    }
  }
])

// Register actions with minimal initial protection
cyre.action([
  {
    id: 'quantum-initiator',
    payload: {start: true},
    repeat: 5, // Reduced repeats due to higher intensity
    interval: 50 // Faster interval
  },
  {
    id: 'quantum-amplifier',
    payload: null,
    throttle: 100 // Start with minimal protection
  },
  {
    id: 'quantum-reactor',
    payload: null,
    debounce: 100 // Start with minimal protection
  }
])

// Start the cascade
const startTime = Date.now()
cyre.call('quantum-initiator')

// Enhanced monitoring
const monitor = setInterval(() => {
  const runTime = (Date.now() - startTime) / 1000

  log.debug({
    timestamp: Date.now(),
    runtime: `${runTime.toFixed(1)}s`,
    messagesSent: messageCount,
    surgesProcessed: surgeCount,
    maxChainDepth: chainDepth,
    protectionRatio: (surgeCount / messageCount).toFixed(3),
    messagesPerSecond: (messageCount / runTime).toFixed(1),
    surgesPerSecond: (surgeCount / runTime).toFixed(1)
  })

  if (runTime > 10 || messageCount > 5000) {
    clearInterval(monitor)
    cyre.shutdown()
    log.success('Quantum surge test complete')
  }
}, 1000)
