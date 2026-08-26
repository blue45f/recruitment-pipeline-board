import { defineConfig } from 'cypress'

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://127.0.0.1:4317',
    supportFile: 'cypress/support/e2e.ts',
  },
  screenshotOnRunFailure: true,
  video: false,
  viewportHeight: 900,
  viewportWidth: 1440,
})
