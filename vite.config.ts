// vitest.config.ts
import {defineConfig} from 'vitest/config'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {dirname} from 'path'

// Get the directory name from the current module URL
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      include: ['src/components/cyre-time-keeper.ts']
    },
    deps: {
      inline: [/^(?!.*node_modules).*$/]
    },
    root: '.',
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/app.ts'),
      name: 'cyre',
      formats: ['es'],
      fileName: format => `${format}/index.js`
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        dir: 'dist',
        entryFileNames: `[format]/index.js`,
        chunkFileNames: `[format]/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
        exports: 'named',
        extend: true,
        name: 'cyre'
      },
      input: {
        index: path.resolve(__dirname, 'src/app.ts')
      }
    },
    sourcemap: true,
    emptyOutDir: true
  }
})
