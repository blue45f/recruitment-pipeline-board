import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Tooltip } from 'radix-ui'
import type { PropsWithChildren } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'

import { AppErrorFallback } from '@/app/providers/AppErrorFallback'
import { CandidateMovementProvider } from '@/domains/recruitment'
import { queryClient } from '@/lib/query/queryClient'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <CandidateMovementProvider>
          <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
        </CandidateMovementProvider>
        <Toaster
          closeButton
          position="bottom-center"
          richColors
          toastOptions={{ duration: 4_000 }}
        />
        {import.meta.env.DEV ? (
          <ReactQueryDevtools initialIsOpen={false} />
        ) : null}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
