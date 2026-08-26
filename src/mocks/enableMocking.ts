export async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') {
    return
  }

  const { worker } = await import('@/mocks/browser')

  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  })
}
