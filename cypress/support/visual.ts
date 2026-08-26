import 'cypress-axe'
import { addCompareSnapshotCommand } from 'cypress-visual-regression/dist/command'

addCompareSnapshotCommand({
  capture: 'viewport',
  disableTimersAndAnimations: true,
  errorThreshold: 0,
  overwrite: true,
  pixelmatchOptions: {
    includeAA: false,
    threshold: 0.1,
  },
  scale: false,
})
