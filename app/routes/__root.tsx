/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import * as React from 'react'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Scrap Job — Agrégateur d\'offres d\'emploi' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <header className="border-b bg-card">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link
              to="/"
              className="text-lg font-bold text-primary"
              activeOptions={{ exact: true }}
            >
              Scrap Job
            </Link>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
              activeProps={{ className: 'text-sm font-semibold text-foreground' }}
              activeOptions={{ exact: true }}
            >
              Offres
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
