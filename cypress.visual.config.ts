import { defineConfig } from 'cypress'
import { configureVisualRegression } from 'cypress-visual-regression'

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://127.0.0.1:4317',
    expose: {
      visualRegressionBaseDirectory: 'cypress/snapshots/base',
      visualRegressionDiffDirectory: 'cypress/screenshots/visual-diff',
      visualRegressionFailSilently: false,
      visualRegressionGenerateDiff: 'fail',
      visualRegressionType: 'regression',
      visualRegressionUpdateSnapshots: false,
    },
    setupNodeEvents(on) {
      configureVisualRegression(on)
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.isHeadless) {
          launchOptions.args.push('--force-device-scale-factor=1')
          launchOptions.args.push('--window-size=1600,1100')
        }

        return launchOptions
      })
    },
    specPattern: 'cypress/visual/**/*.cy.ts',
    supportFile: 'cypress/support/visual.ts',
  },
  screenshotOnRunFailure: true,
  screenshotsFolder: 'cypress/screenshots/visual-actual',
  video: false,
  viewportHeight: 900,
  viewportWidth: 1440,
})
