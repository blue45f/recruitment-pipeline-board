import 'cypress-axe'
import { addCompareSnapshotCommand } from 'cypress-visual-regression/dist/command'

addCompareSnapshotCommand({
  capture: 'viewport',
  disableTimersAndAnimations: true,
  errorThreshold: 0,
  overwrite: true,
  pixelmatchOptions: {
    includeAA: true,
    threshold: 0,
  },
  scale: false,
})
