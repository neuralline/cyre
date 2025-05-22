// vite.config.ts
import {defineConfig} from 'vitest/config'
import {resolve} from 'path'
import {fileURLToPath, URL} from 'node:url'

export default defineConfig({
  // Test configuration
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'
    ],
    coverage: {
      provider: 'v8', // v8 is faster and more accurate than istanbul
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.{test,spec}.ts',
        '**/types/**',
        '**/interfaces/**',
        '**/*.d.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    deps: {
      inline: [/^(?!.*node_modules).*$/]
    }
  },

  // Build configuration
  build: {
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
      // Externalize deps that shouldn't be bundled
      external: [],

      output: [
        // ESM build
        {
          format: 'es',
          entryFileNames: 'index.esm.js',
          exports: 'named',
          preserveModules: false
        },
        // CommonJS build
        {
          format: 'cjs',
          entryFileNames: 'index.cjs',
          exports: 'named',
          interop: 'auto'
        },
        // UMD build for browsers
        {
          format: 'umd',
          name: 'Cyre',
          entryFileNames: 'index.umd.js',
          exports: 'named',
          globals: {}
        }
      ]
    },

    // Optimization
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'], // Remove specific console methods
        passes: 2 // Multiple passes for better compression
      },
      mangle: {
        properties: false // Don't mangle property names to avoid breaking APIs
      },
      format: {
        comments: false // Remove comments
      }
    },

    // Modern target for better tree-shaking
    target: 'es2020',

    // Generate source maps for debugging
    sourcemap: true,

    // Clean output directory
    emptyOutDir: true,

    // Output directory
    outDir: 'dist',

    // Chunk size warnings
    chunkSizeWarningLimit: 500,

    // Ensure reproducible builds
    reportCompressedSize: true
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  // Define global constants
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
  }
})
