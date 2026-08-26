import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [
        'cypress/**',
        'dist/**',
        'node_modules/**',
        'storybook-static/**',
      ],
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 10_000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary', 'html', 'lcov'],
        reportsDirectory: './coverage',
      },
    },
  }),
)
