import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'backend/node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'android/**',
      'src/libs/**',
      '6.pdf',
      '7.pdf',
    ],
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-useless-catch': 'off',
      'no-async-promise-executor': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['backend/**/*.js', 'backend/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['__tests__/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
