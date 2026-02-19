# Scrap Job

Agrégateur d'offres d'emploi. Scrape plusieurs job boards (HelloWork, Indeed, LinkedIn, Welcome to the Jungle, Isarta, Emploi Territorial) et centralise les résultats dans une interface web.

## Prérequis

- **Node.js >= 22** — vérifier avec `node -v`
- **pnpm** — gestionnaire de paquets. Si vous ne l'avez pas :
  ```bash
  corepack enable && corepack prepare pnpm@latest --activate
  ```
  Alternatives : `npm install -g pnpm` ou `brew install pnpm` (macOS)
- **Chromium** — installé automatiquement via Playwright (voir étape 3 ci-dessous)

> Sur Linux, Playwright peut nécessiter des dépendances système supplémentaires. En cas d'erreur au lancement, exécuter `npx playwright install-deps chromium`.

## Installation

```bash
# 1. Installer les dépendances du projet
pnpm install

# 2. Créer le fichier de configuration locale
cp .env.example .env.local

# 3. Installer le navigateur Chromium (utilisé pour le scraping)
npx playwright install chromium
```

Après l'étape 2, **ouvrez `.env.local`** et renseignez au minimum la variable `DEFAULT_SEARCH_KEYWORDS` (voir section Configuration).

## Configuration

Le fichier `.env.local` contient vos paramètres locaux. Il est créé à partir de `.env.example` et **n'est pas versionné** (présent dans `.gitignore`).

| Variable | Description | Obligatoire ? | Défaut |
|---|---|---|---|
| `DEFAULT_SEARCH_KEYWORDS` | Mots-clés de recherche, séparés par des virgules (ex: `react,typescript,frontend`) | **Oui** | — |
| `DEFAULT_SEARCH_LOCATION` | Ville ou région pour cibler les offres | Recommandé | *(vide)* |
| `DEFAULT_SEARCH_RADIUS_KM` | Rayon de recherche en km | Non | `50` |
| `DATABASE_PATH` | Chemin du fichier SQLite | Non | `./data/jobs.db` |
| `BROWSER_HEADLESS` | Mettre à `false` pour voir le navigateur en dev | Non | `true` |
| `PORT` | Port d'écoute du serveur | Non | `3000` |
| `SCRAPE_SECRET` | Token Bearer pour protéger `/api/scrape` (prod uniquement) | En prod | — |

## Développement

```bash
pnpm dev
```

L'app tourne sur [http://localhost:3000](http://localhost:3000).

> Si vous obtenez l'erreur **"No search keywords configured"**, vérifiez que `DEFAULT_SEARCH_KEYWORDS` est bien défini dans `.env.local`.

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

Alternative à l'installation locale — aucun prérequis Node/pnpm nécessaire.

```bash
pnpm docker:build
pnpm docker:run
```

Le conteneur lit la configuration depuis `--env-file .env.local` (défini dans le script). Les données sont persistées dans un volume Docker `scrap-job-data`.

## Production

- Déployé sur **Fly.io** (`fly deploy`)
- Scrape quotidien déclenché par **GitHub Actions**
- Variable `SCRAPE_SECRET` requise en prod pour protéger l'endpoint `/api/scrape` — le workflow GitHub Actions envoie ce token dans le header `Authorization: Bearer <token>`

## Stack

- TanStack Start + React 19 + Vite
- Drizzle ORM + SQLite
- Tailwind CSS v4
- Playwright (scraping navigateur)
