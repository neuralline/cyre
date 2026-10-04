// demo/neural-network-channels.ts
// A small feedforward neural network (2 inputs -> 3 hidden [ReLU] -> 1
// output [sigmoid], trained on XOR with plain gradient descent) modeled
// with Cyre channels - the improved version of the "channels as a
// computation substrate" idea from demo/mathematician-functional.ts, this
// time drawing a hard line between two different jobs a channel can do
// instead of blurring them together:
//
//   STATE channels - every weight, bias, and activation. Created ONCE via
//   cyre.action({id, payload}) before training starts, then updated by
//   calling cyre.action() again with a new payload every time the value
//   changes. Read with cyre.get(id)?.req. None of these have a .on()
//   handler, and none of them ever need one:
//
//     cyre.action({id, payload}) writes straight to payloadState
//     (src/components/cyre-actions.ts, the payloadState.setReq() call at
//     registration) without going anywhere near the dispatch pipeline -
//     no handler lookup, no subscriber invocation, nothing in
//     src/components/cyre-dispatch.ts even runs. Only cyre.call() dispatches
//     to .on() listeners, and only cyre.call() fails with "no subscriber"
//     when a channel doesn't have one. Setting an action is not calling a
//     channel - so a channel that only needs to hold a value never needs a
//     handler, and setting it never "fires" anything. That's the direct
//     answer to the question this demo grew out of.
//
//   EVENT channels - nn/epoch-complete and nn/converged. These DO have
//   .on() handlers, because they represent something actually happening
//   (an epoch finished; loss crossed a convergence threshold), not a value
//   being held. nn/epoch-complete has TWO independent subscribers (a
//   progress logger and a convergence watcher) - cyre fans a single
//   cyre.call() out to every registered handler in parallel automatically
//   once a channel has more than one (see determineExecutionOperator() in
//   src/components/cyre-on.ts), which a plain callback list doesn't give
//   you for free.
//
// The forward/backward pass math reads and writes STATE channels directly
// (cyre.get()/cyre.action()) instead of chaining cyre.call() across
// dependent channels the way mathematician-functional.ts's readValue() did.
// That recursive call-chain pattern is what made that file's Fibonacci test
// recompute the same channel thousands of times over for a single result -
// a weight only needs to be READ, not re-derived through a full dispatch,
// so a direct state read is both correct here and roughly three orders of
// magnitude cheaper than routing the same read through cyre.call().
//
// And unlike mathematician-functional.ts's per-iteration channel churn
// (new uniquely-named channels created and destroyed every iteration),
// every channel in this file is created exactly once, before training
// starts, and lives for the whole run, updated in place thousands of
// times. This is the shape a channel-based system is actually good at: a
// stable, addressable graph of long-lived nodes - not disposable
// call-stack frames wearing a channel costume.
import {cyre} from '../src'

// =============================================================================
// Network shape + training config
// =============================================================================
const INPUTS = 2
const HIDDEN = 3
const EPOCHS = 5000
const LEARNING_RATE = 0.5
const CONVERGENCE_LOSS = 0.01
const LOG_EVERY = 500

const XOR_DATA: Array<{input: [number, number]; target: number}> = [
  {input: [0, 0], target: 0},
  {input: [0, 1], target: 1},
  {input: [1, 0], target: 1},
  {input: [1, 1], target: 0}
]

// cyre never throws on its own - it returns {ok:false, message} instead -
// so this stays the one place that turns a failed set/subscribe into a
// hard stop, same pattern as mathematician-functional.ts's assertOk().
const assertOk = (
  response: {ok: boolean; message: string},
  context: string
): void => {
  if (!response.ok) {
    throw new Error(`${context} failed: ${response.message}`)
  }
}

// =============================================================================
// STATE helpers - action-only, no .on(), no dispatch pipeline involved.
// =============================================================================
const setState = (id: string, payload: number): void => {
  assertOk(cyre.action({id, payload}), `state(${id})`)
}

const getState = (id: string): number => {
  // cyre.get(id) returns the payload-state wrapper {req, res, metadata},
  // not the bare value - .req is what setState() above just wrote.
  const entry = cyre.get(id)
  return typeof entry?.req === 'number' ? entry.req : 0
}

const relu = (x: number): number => Math.max(0, x)
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))
const randomWeight = (): number => (Math.random() * 2 - 1) * 0.5

// Channel id helpers - keep the naming in one place
const w1Id = (i: number, j: number) => `nn/w1/${i}/${j}`
const b1Id = (j: number) => `nn/b1/${j}`
const w2Id = (j: number) => `nn/w2/${j}`
const inputId = (i: number) => `nn/input/${i}`
const hiddenId = (j: number) => `nn/hidden/${j}`

// =============================================================================
// Setup - register every channel exactly once. Parameters/activations get
// no .on() at all (pure state). The two event channels get real handlers.
// =============================================================================
let converged = false
let convergedAtEpoch = -1

const setupNetwork = (): void => {
  for (let i = 0; i < INPUTS; i++) {
    for (let j = 0; j < HIDDEN; j++) setState(w1Id(i, j), randomWeight())
    setState(inputId(i), 0)
  }
  for (let j = 0; j < HIDDEN; j++) {
    setState(b1Id(j), 0)
    setState(w2Id(j), randomWeight())
    setState(hiddenId(j), 0)
  }
  setState('nn/b2', 0)
  setState('nn/output', 0)

  // Event channels need cyre.action() too, same as state channels -
  // .on() only attaches a handler, it doesn't register the channel itself.
  // cyre.call() checks the channel exists (io.get(id)) before it ever
  // looks at handlers, so skipping this makes cyre.call() fail with
  // "Channel does not exist" even though a handler was registered - no
  // payload needed here, these two only ever carry a call-time payload.
  assertOk(cyre.action({id: 'nn/epoch-complete'}), 'action(nn/epoch-complete)')
  assertOk(cyre.action({id: 'nn/converged'}), 'action(nn/converged)')

  // Progress logger - reacts to every "epoch finished" event, but only
  // prints on a stride so 5000 epochs doesn't flood the console.
  assertOk(
    cyre.on('nn/epoch-complete', ({epoch, loss}: {epoch: number; loss: number}) => {
      if (epoch % LOG_EVERY === 0) {
        console.log(`  epoch ${epoch}: loss=${loss.toFixed(4)}`)
      }
      return {epoch, loss}
    }),
    'on(nn/epoch-complete) logger'
  )

  // Convergence watcher - an independent second subscriber on the SAME
  // channel. Registering it here (rather than folding this check into the
  // logger above) is the point: two unrelated concerns, two handlers, one
  // event - cyre runs both in parallel per call instead of forcing one
  // handler to do both jobs.
  assertOk(
    cyre.on('nn/epoch-complete', ({epoch, loss}: {epoch: number; loss: number}) => {
      if (loss < CONVERGENCE_LOSS && !converged) {
        cyre.call('nn/converged', {epoch, loss})
      }
      return {epoch, loss}
    }),
    'on(nn/epoch-complete) convergence watcher'
  )

  // A distinct event for "training is done", separate from "an epoch
  // finished" - a real state transition, not just another progress tick.
  assertOk(
    cyre.on('nn/converged', ({epoch, loss}: {epoch: number; loss: number}) => {
      converged = true
      convergedAtEpoch = epoch
      console.log(
        `  ✅ converged at epoch ${epoch} (loss=${loss.toFixed(4)} < ${CONVERGENCE_LOSS})`
      )
      return {epoch, loss}
    }),
    'on(nn/converged)'
  )
}

// =============================================================================
// Forward pass - pure read + compute + write. No cyre.call() anywhere in
// here: this runs thousands of times per training run, and none of it is
// an "event" - it's arithmetic over already-known state.
// =============================================================================
const forward = (input: [number, number]): number => {
  setState(inputId(0), input[0])
  setState(inputId(1), input[1])

  const hiddenActivations: number[] = []
  for (let j = 0; j < HIDDEN; j++) {
    let sum = getState(b1Id(j))
    for (let i = 0; i < INPUTS; i++) sum += getState(w1Id(i, j)) * input[i]
    const activated = relu(sum)
    hiddenActivations.push(activated)
    setState(hiddenId(j), activated)
  }

  let outSum = getState('nn/b2')
  for (let j = 0; j < HIDDEN; j++) outSum += getState(w2Id(j)) * hiddenActivations[j]

  const output = sigmoid(outSum)
  setState('nn/output', output)
  return output
}

// =============================================================================
// One training step: forward + backprop + weight update for a single
// sample. Recomputes its own forward pass (rather than reusing forward()
// above) so the pre-activation sums needed for the ReLU derivative don't
// have to be smuggled out through a state channel just for this function's
// own internal use.
// =============================================================================
const trainStep = (input: [number, number], target: number, lr: number): number => {
  const hiddenSums: number[] = []
  const hiddenActivations: number[] = []
  for (let j = 0; j < HIDDEN; j++) {
    let sum = getState(b1Id(j))
    for (let i = 0; i < INPUTS; i++) sum += getState(w1Id(i, j)) * input[i]
    hiddenSums.push(sum)
    hiddenActivations.push(relu(sum))
  }

  const w2Before = Array.from({length: HIDDEN}, (_, j) => getState(w2Id(j)))
  let outSum = getState('nn/b2')
  for (let j = 0; j < HIDDEN; j++) outSum += w2Before[j] * hiddenActivations[j]
  const output = sigmoid(outSum)

  // Publish this step's activations as state - anything else in the app
  // could read nn/output or nn/hidden/* mid-training without being handed
  // a reference to these local variables.
  setState(inputId(0), input[0])
  setState(inputId(1), input[1])
  for (let j = 0; j < HIDDEN; j++) setState(hiddenId(j), hiddenActivations[j])
  setState('nn/output', output)

  const loss = 0.5 * (target - output) ** 2

  // Backprop - standard two-layer gradient descent. dOutput is dLoss/d(outSum).
  const dOutput = (output - target) * output * (1 - output)

  for (let j = 0; j < HIDDEN; j++) {
    setState(w2Id(j), w2Before[j] - lr * dOutput * hiddenActivations[j])
  }
  setState('nn/b2', getState('nn/b2') - lr * dOutput)

  // Hidden layer uses w2Before (the pre-update weights) - backprop needs
  // the weights as they were during the forward pass, not the ones just
  // rewritten two lines up.
  for (let j = 0; j < HIDDEN; j++) {
    const reluDerivative = hiddenSums[j] > 0 ? 1 : 0
    const dHidden = dOutput * w2Before[j] * reluDerivative
    for (let i = 0; i < INPUTS; i++) {
      setState(w1Id(i, j), getState(w1Id(i, j)) - lr * dHidden * input[i])
    }
    setState(b1Id(j), getState(b1Id(j)) - lr * dHidden)
  }

  return loss
}

// =============================================================================
// Training loop - one nn/epoch-complete event per EPOCH, not per sample.
// Firing a real dispatch for every one of the ~20,000 individual weight
// updates above would repeat mathematician-functional.ts's mistake; firing
// one per epoch (5000 total, at most) is the right granularity for
// something that's genuinely an event other code might want to react to.
// =============================================================================
const trainNetwork = async (): Promise<number> => {
  let epoch = 0
  let lastLoss = 1

  for (; epoch < EPOCHS && !converged; epoch++) {
    let epochLoss = 0
    for (const sample of XOR_DATA) {
      epochLoss += trainStep(sample.input, sample.target, LEARNING_RATE)
    }
    epochLoss /= XOR_DATA.length
    lastLoss = epochLoss

    assertOk(
      await cyre.call('nn/epoch-complete', {epoch, loss: epochLoss}),
      `call(nn/epoch-complete, ${epoch})`
    )
  }

  return lastLoss
}

// =============================================================================
// Run
// =============================================================================
const runNeuralNetworkDemo = async (): Promise<void> => {
  console.log('🧠 CYRE NEURAL NETWORK (channels as state + channels as events)')
  console.log('==================================================================')

  await cyre.init({breathing: {limits: {maxCallRate: 20000}}})

  setupNetwork()

  console.log(`\nTraining on XOR (${EPOCHS} epoch cap, stop below loss ${CONVERGENCE_LOSS})...`)
  const finalLoss = await trainNetwork()

  console.log('\n📊 RESULTS')
  console.log('==========')
  console.log(`Final epoch: ${converged ? convergedAtEpoch : EPOCHS}`)
  console.log(`Final loss: ${finalLoss.toFixed(4)}`)
  console.log(`Converged: ${converged ? 'yes' : 'no (hit epoch cap)'}`)

  console.log('\nPredictions:')
  for (const sample of XOR_DATA) {
    const prediction = forward(sample.input)
    const rounded = prediction >= 0.5 ? 1 : 0
    const correct = rounded === sample.target ? '✅' : '❌'
    console.log(
      `  [${sample.input.join(', ')}] -> ${prediction.toFixed(4)} ` +
        `(rounds to ${rounded}, expected ${sample.target}) ${correct}`
    )
  }

  // The learned weights are ordinary state - inspectable from cyre.get()
  // without ever having threaded a reference to them through the training
  // loop above.
  console.log('\nLearned output-layer weights (nn/w2/*):')
  for (let j = 0; j < HIDDEN; j++) {
    console.log(`  w2[${j}] = ${getState(w2Id(j)).toFixed(4)}`)
  }

  cyre.shutdown()
}

runNeuralNetworkDemo()
