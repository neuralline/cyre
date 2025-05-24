// src/types/global.d.ts
// Global type declarations for Cyre

declare global {
  namespace NodeJS {
    interface Global {
      crypto: Crypto
      performance: Performance
    }
  }

  // Extend the global scope for browser environments
  interface Window {
    cyre?: typeof import('../index')
  }
}

// Module declaration for 'cyre' to ensure TypeScript recognizes it
declare module 'cyre' {
  export * from '../index'
  export {default} from '../index'
}

// Export empty object to make this a module
export {}
