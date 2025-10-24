import { Link, useRouterState } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home } from 'lucide-react'
import { Fragment } from 'react'

const routeLabels: { [key: string]: string } = {
  '': 'Dashboard',
  'agents': 'Agents',
  'suites': 'Suites & Scenarios',
  'evaluators': 'Evaluators',
  'costs': 'Cost & Efficiency',
  'runs': 'Runs',
}

// Function to get a friendly label for dynamic segments
const getSegmentLabel = (segment: string, index: number, segments: string[]) => {
  // If it's a run ID (in the pattern /runs/$runId)
  if (index > 0 && segments[index - 1] === 'runs' && segment.length > 10) {
    return `Run ${segment.substring(0, 8)}...`
  }

  return routeLabels[segment] || segment
}

export function AppBreadcrumb() {
  const router = useRouterState()
  const pathname = router.location.pathname

  // Split path into segments and filter out empty strings
  const pathSegments = pathname.split('/').filter(Boolean)

  // If we're on the home page, just show home
  if (pathSegments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Dashboard
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {pathSegments.map((segment, index) => {
          const isLast = index === pathSegments.length - 1
          const href = '/' + pathSegments.slice(0, index + 1).join('/')
          const label = getSegmentLabel(segment, index, pathSegments)

          return (
            <Fragment key={segment}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
