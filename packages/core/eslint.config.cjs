const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  { ignores: ['dist/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
];
