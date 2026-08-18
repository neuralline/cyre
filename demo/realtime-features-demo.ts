// demo/realtime-features-demo.ts
// Real-world uses of buffer, debounce and delay - each scenario picks the
// protection that actually fits the problem, not just to show it off.
import {cyre, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) SEARCH-AS-YOU-TYPE  →  debounce
//
// The user is still typing until they stop. Every keystroke should cancel
// the previous pending search and restart the wait - that's exactly what
// debounce is for (buffer would fire on a fixed window regardless of
// whether the user is still mid-word).
// =============================================================================
cyre.action({
  id: 'search-autocomplete://',
  debounce: 400 // wait for a 400ms pause in typing before actually searching
})

cyre.on('search-autocomplete://', async (query: string) => {
  log.debug(`🔍 searching for "${query}"...`)
  await wait(150) // pretend this is a network call to a search API
  const results = [`${query} tutorial`, `${query} docs`, `${query} examples`]
  log.debug(`🔍 results for "${query}":`, results)
  return results
})

console.log('\n=== 1) search-as-you-type (debounce) ===')
const typed = 'cyre'
for (let i = 1; i <= typed.length; i++) {
  const partial = typed.slice(0, i)
  console.log(`  typing: "${partial}"`)
  await cyre.call('search-autocomplete://', partial)
  await wait(80) // keystrokes arrive faster than the debounce window
}
console.log('  user stopped typing, waiting for the debounced search...')
await wait(600)

// =============================================================================
// 2) "X, Y and N others liked your post"  →  buffer (append)
//
// Likes arrive in a burst - notifying on every single one would spam the
// post's author. Buffer collects everything that lands in the window and
// delivers it as one batch when the window closes, which is exactly the
// grouped-notification shape social apps show.
// =============================================================================
cyre.action({
  id: 'post-likes://',
  buffer: {window: 1500, strategy: 'append'}
})

cyre.on('post-likes://', (likers: string[] | string) => {
  const names = Array.isArray(likers) ? likers : [likers]
  const summary =
    names.length <= 2
      ? names.join(' and ')
      : `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`
  log.debug(`❤️  ${summary} liked your post`)
  return names
})

console.log('\n=== 2) grouped like notifications (buffer, append) ===')
const likers = ['Alice', 'Bob', 'Chidi', 'Dana', 'Eve']
for (const name of likers) {
  console.log(`  ${name} liked the post`)
  await cyre.call('post-likes://', name)
  await wait(200) // likes trickling in over the window, well under 1500ms
}
console.log('  waiting for the like window to close...')
await wait(1600)

// =============================================================================
// 3) SENSOR WARM-UP  →  delay (+ interval/repeat)
//
// A freshly powered-on sensor's first reading is often unreliable while its
// ADC/reference voltage settles. delay defers the FIRST execution only;
// interval/repeat then take over for the steady-state polling cadence -
// two different timing concerns, each handled by the field meant for it.
// =============================================================================
cyre.action({
  id: 'temperature-sensor://',
  delay: 1000, // let the sensor stabilize before trusting its first reading
  interval: 800,
  repeat: 4
})

let reading = 0
cyre.on('temperature-sensor://', () => {
  reading++
  const celsius = (21 + Math.sin(reading) * 1.5).toFixed(1)
  log.debug(`🌡️  reading #${reading}: ${celsius}°C`)
  return celsius
})

console.log('\n=== 3) sensor warm-up delay + steady polling ===')
console.log(
  '  powering on sensor, waiting 1000ms warm-up before first reading...'
)
await cyre.call('temperature-sensor://')
await wait(1000 + 800 * 4 + 300) // warm-up + all repeats + margin

// =============================================================================
// 4) AUTOSAVE WHILE TYPING  →  debounce + maxWait
//
// Debounce alone is wrong here: if the user never pauses for 800ms (e.g.
// they type continuously for a minute), a plain debounce would NEVER fire
// and the draft would never save. maxWait guarantees a save happens at
// least every 2s regardless of how continuously they're typing.
// =============================================================================
cyre.action({
  id: 'draft-autosave://',
  debounce: 800,
  maxWait: 2000
})

let saveCount = 0
cyre.on('draft-autosave://', (draft: string) => {
  saveCount++
  log.debug(`💾 autosaved (#${saveCount}): "${draft}"`)
  return draft
})

console.log(
  '\n=== 4) autosave under continuous typing (debounce + maxWait) ==='
)
console.log(
  '  simulating continuous typing, never pausing long enough to debounce naturally...'
)
let draft = ''
for (let i = 0; i < 12; i++) {
  draft += 'x'
  await cyre.call('draft-autosave://', draft)
  await wait(500) // faster than the 800ms debounce - would never fire without maxWait
}
console.log('  typing stopped, waiting for the final debounced save...')
await wait(1000)
console.log(
  saveCount > 1
    ? `✅ maxWait forced ${saveCount} saves during continuous typing, draft was never at risk`
    : '❌ expected multiple saves during continuous typing - maxWait did not kick in'
)

cyre.lock()
console.log('\ndone.')
