import { createBrowserRouter } from 'react-router'

import { HomeRoute } from '@/routes/HomeRoute'
import { RouteErrorPage } from '@/routes/RouteErrorPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeRoute />,
    errorElement: <RouteErrorPage />,
  },
])
