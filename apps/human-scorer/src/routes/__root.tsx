import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Human Scoring Interface</h1>
          <p className="text-sm text-muted-foreground">
            Evaluate benchmark run outputs with human-in-the-loop feedback
          </p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
      {import.meta.env.PROD ? null : <TanStackRouterDevtools />}
    </div>
  ),
});
