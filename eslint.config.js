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
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],

      // General rules
      'no-console': ['warn', {allow: ['warn', 'error', 'info', 'debug']}],
      'prefer-const': 'warn',
      'no-var': 'error'

      // React rules (if you use React)
      // 'react/prop-types': 'off',
      // 'react/react-in-jsx-scope': 'off',
    }
  }
]
