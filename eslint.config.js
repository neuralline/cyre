// eslint.config.js
export default {
  files: ['*.ts', '*.tsx'], // Specify the file types you want to lint
  languageOptions: {
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module'
    }
  },
  rules: {
    // Add your custom rules here
  }
}
