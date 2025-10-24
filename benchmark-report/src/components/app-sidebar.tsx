import { Link, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  CircleDollarSign,
  Home,
  Users,
  FolderTree,
  CheckCircle,
  PlayCircle,
  Layers,
  GitCompare,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'

const navigation = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/',
        icon: Home,
      },
      {
        title: 'Runs',
        url: '/runs',
        icon: PlayCircle,
      },
    ],
  },
  {
    title: 'Batches',
    items: [
      {
        title: 'All Batches',
        url: '/batches',
        icon: Layers,
      },
      {
        title: 'Compare Batches',
        url: '/batches/compare',
        icon: GitCompare,
      },
    ],
  },
  {
    title: 'Analysis',
    items: [
      {
        title: 'Agents',
        url: '/agents',
        icon: Users,
      },
      {
        title: 'Suites & Scenarios',
        url: '/suites',
        icon: FolderTree,
      },
      {
        title: 'Evaluators',
        url: '/evaluators',
        icon: CheckCircle,
      },
      {
        title: 'Cost & Efficiency',
        url: '/costs',
        icon: CircleDollarSign,
      },
    ],
  },
]

export function AppSidebar() {
  const router = useRouterState()
  const currentPath = router.location.pathname

  const isActive = (url: string) => {
    if (url === '/') {
      return currentPath === '/'
    }
    return currentPath.startsWith(url)
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <span className="text-lg font-bold">Ze Benchmarks</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          Benchmark Reports v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
