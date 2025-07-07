// Usage examples for persistent state in Cyre

import {cyre} from '../src/'

/*

      C.Y.R.E - P.E.R.S.I.S.T.E.N.T - S.T.A.T.E - U.S.A.G.E
      
      Examples of how to use the new persistent state system

*/

// Example 1: Basic initialization with auto-save
async function basicPersistentApp() {
  // Initialize with auto-save enabled
  await cyre.init({
    autoSave: true,
    saveKey: 'my-app-state'
  })

  // Register actions - automatically saved
  cyre.action({
    id: 'user-preferences',
    payload: {theme: 'dark', language: 'en'}
  })

  cyre.action({
    id: 'shopping-cart',
    payload: {items: [], total: 0}
  })

  // Set up handlers
  cyre.on('user-preferences', preferences => {
    console.log('User preferences:', preferences)
    return {updated: true}
  })

  cyre.on('shopping-cart', cart => {
    console.log('Cart updated:', cart)
    return {processed: true}
  })

  // State is automatically saved on changes
  await cyre.call('user-preferences', {theme: 'light', language: 'es'})
  await cyre.call('shopping-cart', {items: ['item1'], total: 29.99})

  // On next app startup, state will be automatically restored
}

// Example 2: Manual state management
async function manualStateApp() {
  // Initialize without auto-save
  await cyre.init({autoSave: false})

  // Set up app
  cyre.action({id: 'game-state', payload: {level: 1, score: 0}})
  cyre.on('game-state', state => {
    console.log('Game state:', state)
    return {saved: true}
  })

  // Play the game...
  await cyre.call('game-state', {level: 5, score: 1500})

  // Manually save important state
  await cyre.saveState('game-progress')

  // Later, manually load state
  await cyre.loadState('game-progress')
}

// Example 3: Loading from existing state
async function loadFromExistingState() {
  // Prepare existing state (could come from server, file, etc.)
  const existingState = {
    actions: {
      'user-session': {
        id: 'user-session',
        type: 'auth',
        payload: {userId: '123', token: 'abc', expires: Date.now() + 3600000}
      },
      'app-settings': {
        id: 'app-settings',
        type: 'config',
        payload: {notifications: true, autoSync: true}
      }
    },
    subscribers: {
      'user-session': {id: 'user-session', registered: true},
      'app-settings': {id: 'app-settings', registered: true}
    },
    payloadHistory: {},
    timestamp: Date.now(),
    version: '4.1.0'
  }

  // Initialize with existing state
  await cyre.init({
    persistentState: existingState,
    autoSave: true,
    saveKey: 'restored-app'
  })

  // Set up handlers for restored actions
  cyre.on('user-session', session => {
    console.log('User session restored:', session)
    return {authenticated: true}
  })

  cyre.on('app-settings', settings => {
    console.log('Settings restored:', settings)
    return {applied: true}
  })

  // Actions are already registered and ready to use
  console.log('Current stats:', cyre.getStats())
}

// Example 4: Export/Import state
async function exportImportExample() {
  await cyre.init({autoSave: false})

  // Set up some state
  cyre.action({
    id: 'document',
    payload: {content: 'Hello World', modified: true}
  })
  cyre.on('document', doc => ({saved: doc.modified}))

  await cyre.call('document', {content: 'Updated content', modified: true})

  // Export current state
  const exportedState = cyre.exportState()
  console.log('Exported state:', exportedState)

  // Could save to file, send to server, etc.
  const stateJson = JSON.stringify(exportedState)

  // Later, in another session or different device
  const importedState = JSON.parse(stateJson)
  await cyre.init({
    persistentState: importedState,
    autoSave: true
  })

  // State is restored
  console.log('Imported stats:', cyre.getStats())
}

// Example 5: Graceful shutdown with state preservation
function setupGracefulShutdown() {
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down gracefully...')
    cyre.shutdown() // Automatically saves state if autoSave enabled
  })

  process.on('SIGTERM', () => {
    console.log('Terminating...')
    cyre.shutdown()
  })

  // Handle browser page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      // Quick synchronous save for browser
      const state = cyre.exportState()
      localStorage.setItem('cyre-emergency-backup', JSON.stringify(state))
    })
  }
}

// Usage patterns
export const persistentStateExamples = {
  basicPersistentApp,
  manualStateApp,
  loadFromExistingState,
  exportImportExample,
  setupGracefulShutdown
}

basicPersistentApp()
exportImportExample()
