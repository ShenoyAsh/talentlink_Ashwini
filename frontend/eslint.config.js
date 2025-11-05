import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import vitest from 'eslint-plugin-vitest' // <-- 1. Import vitest
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  
  // Base config for all .js/.jsx files
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // This rule is often helpful with Vite/React
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // 2. Add this new section for test files
  {
    files: ['src/**/*.{test,spec}.{js,jsx}'], // Target only test files
    plugins: {
      vitest, // Add vitest plugin
    },
    extends: [
      vitest.configs.recommended, // Apply recommended rules
    ],
    languageOptions: {
      globals: {
        ...vitest.environments.globals.globals, // <-- This adds the globals
      },
    },
  },
])