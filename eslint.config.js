import js from '@eslint/js'
import query from '@tanstack/eslint-plugin-query'
import vitest from '@vitest/eslint-plugin'
import prettier from 'eslint-config-prettier'
import boundaries from 'eslint-plugin-boundaries'
import cypress from 'eslint-plugin-cypress'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import storybook from 'eslint-plugin-storybook'
import testingLibrary from 'eslint-plugin-testing-library'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '.husky/_',
    'coverage',
    'cypress/screenshots',
    'cypress/videos',
    'dist',
    'node_modules',
    'public/mockServiceWorker.js',
    'storybook-static',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  ...query.configs['flat/recommended'],
  {
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/files': [
        { category: 'app', pattern: 'src/app/**/*.{ts,tsx}' },
        { category: 'routes', pattern: 'src/routes/**/*.{ts,tsx}' },
        { category: 'domains', pattern: 'src/domains/**/*.{ts,tsx}' },
        {
          category: 'components',
          pattern: 'src/components/**/*.{ts,tsx}',
        },
        { category: 'lib', pattern: 'src/lib/**/*.{ts,tsx}' },
        { category: 'mocks', pattern: 'src/mocks/**/*.{ts,tsx}' },
        { category: 'test', pattern: 'src/test/**/*.{ts,tsx}' },
      ],
      'boundaries/root-path': import.meta.dirname,
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.app.json',
        },
      },
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'react/button-has-type': 'error',
      'react/no-array-index-key': 'warn',
      'react/prop-types': 'off',
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { file: { categories: 'routes' } },
              disallow: { to: { file: { categories: 'app' } } },
            },
            {
              from: { file: { categories: 'domains' } },
              disallow: {
                to: { file: { categories: { anyOf: ['app', 'routes'] } } },
              },
            },
            {
              from: {
                file: { categories: { anyOf: ['components', 'lib'] } },
              },
              disallow: {
                to: {
                  file: {
                    categories: { anyOf: ['app', 'routes', 'domains'] },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
  {
    ...testingLibrary.configs['flat/react'],
    files: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  {
    ...vitest.configs.recommended,
    files: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  {
    ...cypress.configs.recommended,
    files: ['cypress/**/*.ts', 'cypress.config.ts'],
  },
  {
    files: [
      '.storybook/**/*.ts',
      '*.config.{js,mjs,ts}',
      'vite.config.ts',
      'vitest.config.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...storybook.configs['flat/recommended'],
  prettier,
])
