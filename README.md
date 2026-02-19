# Scrap Job

Agrégateur d'offres d'emploi. Scrape plusieurs job boards (HelloWork, Indeed, LinkedIn, Welcome to the Jungle, Isarta, Emploi Territorial) et centralise les résultats dans une interface web.

## Prérequis

- Node.js >= 22
- pnpm
- Chromium (installé via Playwright)

## Installation

```bash
pnpm install
cp .env.example .env.local
npx playwright install chromium
```

## Développement

```bash
pnpm dev
```

L'app tourne sur [http://localhost:3000](http://localhost:3000).

## Lancer un scrape

Le serveur de dev doit tourner (`pnpm dev`).

```bash
# Scraper toutes les sources
pnpm scrape

# Scraper une source spécifique
pnpm scrape -- --source hellowork
```

Sources disponibles : `emploi-territorial`, `hellowork`, `indeed`, `isarta`, `linkedin`, `welcometothejungle`.

## Docker

```bash
pnpm docker:build
pnpm docker:run
```

Les données sont persistées dans un volume Docker `scrap-job-data`.

## Production

- Déployé sur **Fly.io** (`fly deploy`)
- Scrape quotidien déclenché par **GitHub Actions**
- Variable `SCRAPE_SECRET` requise en prod pour protéger l'endpoint `/api/scrape`

## Stack

- TanStack Start + React 19 + Vite
- Drizzle ORM + SQLite
- Tailwind CSS v4
- Playwright (scraping navigateur)
