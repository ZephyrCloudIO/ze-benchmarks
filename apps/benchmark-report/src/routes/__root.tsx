import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { Separator } from '@/components/ui/separator'

export const Route = createRootRoute({
  component: () => (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <AppBreadcrumb />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="py-4">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <TanStackRouterDevtools />
    </SidebarProvider>
  ),
})
