import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold">
              Ze Benchmarks
            </Link>
            <div className="flex gap-6">
              <Link
                to="/"
                className="text-sm font-medium transition-colors hover:text-primary"
                activeProps={{ className: 'text-primary' }}
              >
                Dashboard
              </Link>
              <Link
                to="/agents"
                className="text-sm font-medium transition-colors hover:text-primary"
                activeProps={{ className: 'text-primary' }}
              >
                Agents
              </Link>
              <Link
                to="/suites"
                className="text-sm font-medium transition-colors hover:text-primary"
                activeProps={{ className: 'text-primary' }}
              >
                Suites
              </Link>
              <Link
                to="/evaluators"
                className="text-sm font-medium transition-colors hover:text-primary"
                activeProps={{ className: 'text-primary' }}
              >
                Evaluators
              </Link>
              <Link
                to="/costs"
                className="text-sm font-medium transition-colors hover:text-primary"
                activeProps={{ className: 'text-primary' }}
              >
                Costs
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  ),
})
