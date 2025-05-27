import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000, // 15 seconds instead of 5
    hookTimeout: 10000, // 10 seconds for setup/teardown
    // Reporters
    reporters: ['default'],
    // Better test isolation
    isolate: true
  }
})
