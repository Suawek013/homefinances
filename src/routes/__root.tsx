import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { PersonProvider, usePerson, PEOPLE, personColor } from "@/lib/person";
import { Toaster } from "@/components/ui/sonner";
import { LayoutDashboard, PlusCircle, Repeat, Receipt } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Household Budget" },
      { name: "description", content: "Shared household budget for two." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Household Budget" },
      { property: "og:description", content: "Shared household budget for two." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PersonProvider>
        <AppShell />
        <Toaster position="top-center" />
      </PersonProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const { current, setCurrent } = usePerson();
  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Household Budget</h1>
            <p className="text-xs text-muted-foreground">Slawek &amp; Natalia</p>
          </div>
          <div className="flex rounded-full bg-muted p-1">
            {PEOPLE.map((p) => {
              const active = current === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setCurrent(p.id)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={
                    active
                      ? { background: personColor(p.id), color: "white" }
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/add", label: "Add", icon: PlusCircle },
    { to: "/recurring", label: "Recurring", icon: Repeat },
    { to: "/receipts", label: "Receipts", icon: Receipt },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto grid w-full max-w-xl grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
            activeOptions={{ exact: it.to === "/" }}
            activeProps={{ className: "flex flex-col items-center gap-1 py-2 text-xs text-primary" }}
          >
            <it.icon className="h-5 w-5" />
            <span>{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
