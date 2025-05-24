import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 350000, // 15 seconds instead of 5
    hookTimeout: 20000, // 10 seconds for setup/teardown
    // Reporters
    reporters: ['verbose'],
    // Better test isolation
    isolate: true
  }
})
