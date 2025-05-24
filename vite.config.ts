// vite.config.ts
import {defineConfig} from 'vite'
import {resolve} from 'path'

export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Cyre',
      formats: ['es', 'cjs', 'umd'],
      fileName: format => {
        switch (format) {
          case 'es':
            return 'index.esm.js'
          case 'cjs':
            return 'index.cjs'
          case 'umd':
            return 'index.umd.js'
          default:
            return `index.${format}.js`
        }
      }
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    sourcemap: true,
    emptyOutDir: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
