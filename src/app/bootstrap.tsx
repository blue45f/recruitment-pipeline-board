import { StrictMode, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { BootErrorPage } from '@/app/BootErrorPage'
import { enableMocking } from '@/mocks/enableMocking'

interface AppModule {
  App: ComponentType
}

interface BootstrapDependencies {
  loadApp?: () => Promise<AppModule>
  startMocking?: () => Promise<void>
}

const loadApp = () => import('@/app/App')

export async function bootstrap(
  rootElement: HTMLElement,
  {
    loadApp: loadAppModule = loadApp,
    startMocking = enableMocking,
  }: BootstrapDependencies = {},
): Promise<Root> {
  const root = createRoot(rootElement)

  try {
    const [{ App }] = await Promise.all([loadAppModule(), startMocking()])

    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (error) {
    console.error('애플리케이션 초기화에 실패했습니다.', error)
    root.render(
      <StrictMode>
        <BootErrorPage />
      </StrictMode>,
    )
  }

  return root
}
