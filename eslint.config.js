// eslint.config.js
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // Disable TypeScript strict rules temporarily
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',

      // General rules - keep these lenient for now
      'no-console': 'off',
      'prefer-const': 'off',
      'no-var': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  },
  {
    // Ignore certain files/directories
    ignores: [
      'dist/*',
      'dev/*',
      'server/**/*',
      'node_modules/**/*',
      'coverage/**/*',
      '**/*.test.ts',
      '**/*.spec.ts',
      'src/ssr/**/*',
      'src/streams/**/*'
    ]
  }
]
