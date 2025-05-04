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
      include: ['src/**/*.ts'],
      exclude: ['**/*.{test,spec}.ts']
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
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'cyre',
      formats: ['es', 'cjs', 'umd'],
      fileName: format => {
        switch (format) {
          case 'es':
            return 'es/index.js'
          case 'cjs':
            return 'cjs/index.js'
          case 'umd':
            return 'umd/cyre.js'
          default:
            return `${format}/index.js`
        }
      }
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        exports: 'named',
        extend: true,
        name: 'cyre',
        // Generate minified UMD version
        manualChunks: undefined
      }
    },
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
    terserOptions: {
      compress: {
        drop_console: false,
        pure_funcs: []
      }
    },
    emptyOutDir: true
  }
})
