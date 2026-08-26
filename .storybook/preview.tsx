import type { Decorator, Preview } from '@storybook/react-vite'
import { Tooltip } from 'radix-ui'
import { mswLoader } from 'msw-storybook-addon/csf3'

import '../src/styles/globals.css'

const withTooltipProvider: Decorator = (Story) => (
  <Tooltip.Provider delayDuration={300}>
    <Story />
  </Tooltip.Provider>
)

const preview: Preview = {
  decorators: [withTooltipProvider],
  loaders: [mswLoader()],
  parameters: {
    a11y: {
      test: 'error',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
  },
}

export default preview
