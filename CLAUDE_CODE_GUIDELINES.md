# Job Search Aggregator — Project Guidelines for Claude Code

## 1. Vision du projet

Créer un agrégateur d'offres d'emploi personnel qui collecte automatiquement les offres depuis plusieurs plateformes, les centralise dans une base de données locale, et les affiche sur une interface web unique avec recherche et filtres. L'objectif est de gagner du temps en évitant de consulter chaque site individuellement.

---

## 2. Stack technique

Le projet est **full TypeScript**, mono-repo.

| Couche | Techno | Notes |
|---|---|---|
| Framework | **TanStack Start** | Full-stack Vite, file-based routing, server functions, déploiement via Nitro |
| Routing | **TanStack Router** | Type-safe, file-based routing, intégré nativement à TanStack Start |
| ORM / DB | **Drizzle ORM + SQLite** | Type-safe, léger. Fichier `.db` local pour commencer. Migration possible vers PostgreSQL plus tard. |
| Scraping statique | **Cheerio** | Parsing HTML pour les sites qui servent du contenu côté serveur |
| Scraping dynamique | **Playwright** | Uniquement pour les sites dont le contenu est rendu en JS côté client (SPA, lazy loading…) |
| HTTP Client | **fetch** natif (Node 18+) | Pour les appels API et le téléchargement de pages HTML |
| Scheduling | **node-cron** | Exécution périodique des scrapes (toutes les heures ou configurable). Serveur persistant Nitro = le cron tourne en continu. |
| State / Fetching | **TanStack Query** | Intégré nativement à TanStack Start. Gestion du cache et du fetching côté client. |
| UI / Style | **Tailwind CSS + shadcn/ui** | Design system cohérent, composants accessibles |
| Validation | **Zod** | Validation des données scrapées avant insertion en base |

---

## 3. Sites cibles et stratégie de collecte

Chaque source doit implémenter une interface commune `JobSource` (voir section Architecture). Prioriser les API officielles quand elles existent, scraper en dernier recours.

### 3.1 — LinkedIn (`linkedin.com/jobs`)

- **Méthode** : Scraping Playwright (contenu rendu côté client, protection anti-bot)
- **Difficulté** : 🔴 Élevée — LinkedIn bloque activement le scraping (rate limiting, captchas, exigence de login)
- **Stratégie** : Cibler les pages publiques de recherche d'emploi (`linkedin.com/jobs/search?keywords=...&location=...`). Ne pas tenter de se connecter avec un compte. Implémenter des délais aléatoires entre les requêtes (2-5 sec). Rotation de User-Agent. Prévoir un fallback : si LinkedIn devient inaccessible, le système doit continuer à fonctionner avec les autres sources.
- **Données à extraire** : Titre, entreprise, localisation, lien vers l'offre, date de publication, type de contrat si disponible.
- **⚠️ Risque légal** : Les CGU de LinkedIn interdisent le scraping. Usage strictement personnel.

### 3.2 — Indeed (`fr.indeed.com`)

- **Méthode** : Scraping Cheerio + fetch (le HTML contient les offres en SSR) ou Playwright si nécessaire
- **Difficulté** : 🟠 Moyenne — Indeed a des protections anti-bot (Cloudflare) mais les pages de résultats sont relativement accessibles
- **Stratégie** : Requêter `fr.indeed.com/jobs?q=...&l=...` avec les paramètres de recherche. Parser les cards d'offres dans le HTML. Gérer la pagination (`&start=10`, `&start=20`…). Implémenter des délais entre les pages.
- **Données à extraire** : Titre, entreprise, localisation, salaire (si affiché), résumé, lien, date de publication.

### 3.3 — Welcome to the Jungle (`welcometothejungle.com`)

- **Méthode** : Scraping Playwright (SPA React, contenu chargé dynamiquement)
- **Difficulté** : 🟠 Moyenne
- **Stratégie** : Naviguer sur la page de recherche, attendre le chargement des résultats, parser le DOM. WTTJ a une structure de données assez propre. Vérifier s'il existe une API interne non documentée dans les appels réseau (souvent un endpoint GraphQL ou REST que le front utilise) — si oui, l'utiliser directement avec fetch, c'est plus fiable et rapide que le scraping DOM.
- **Données à extraire** : Titre, entreprise, localisation, type de contrat, tags/compétences, lien, date, description courte.

### 3.4 — Isarta (`isarta.com/emplois`)

- **Méthode** : Scraping Cheerio + fetch (tester d'abord si le HTML statique contient les offres) ou Playwright si nécessaire
- **Difficulté** : 🟢 Faible à moyenne
- **Stratégie** : Site plus petit, probablement moins de protections. Identifier la structure des pages de résultats et parser les offres. Vérifier la présence d'une API ou d'un flux RSS.
- **Données à extraire** : Titre, entreprise, localisation, type de contrat, lien, date.

### 3.5 — HelloWork (`hellowork.com`)

- **Méthode** : Scraping Cheerio + fetch (tester le HTML statique d'abord)
- **Difficulté** : 🟢 Faible à moyenne
- **Stratégie** : HelloWork (anciennement RegionsJob) a des pages de résultats assez classiques. Parser les cards d'offres. Gérer la pagination. Vérifier s'ils exposent un flux RSS ou une API.
- **Données à extraire** : Titre, entreprise, localisation, type de contrat, salaire, lien, date.

### 3.6 — Emploi Territorial (`emploi-territorial.fr`)

- **Méthode** : Scraping Cheerio + fetch (site institutionnel, probablement du HTML classique côté serveur)
- **Difficulté** : 🟢 Faible — site public institutionnel, peu ou pas de protections anti-bot
- **Stratégie** : Site spécialisé fonction publique territoriale. Identifier la page de recherche et ses paramètres (catégorie, filière, localisation). Parser les résultats. Ce site est probablement le plus simple à scraper.
- **Données à extraire** : Titre du poste, collectivité/employeur, localisation, grade/catégorie, date limite de candidature, lien.

### Résumé des priorités d'implémentation

| Priorité | Site | Raison |
|---|---|---|
| 1 | Emploi Territorial | Le plus simple, bon pour valider l'architecture |
| 2 | HelloWork | HTML classique, bonne couverture d'offres |
| 3 | Isarta | Relativement simple |
| 4 | Indeed | Large volume d'offres, scraping un peu plus complexe |
| 5 | Welcome to the Jungle | SPA, nécessite Playwright |
| 6 | LinkedIn | Le plus complexe et risqué, implémenter en dernier |

---

## 4. Architecture du projet

### 4.1 — Structure des dossiers

```
job-aggregator/
├── app/
│   ├── routes/
│   │   ├── __root.tsx            # Layout racine
│   │   ├── index.tsx             # Page principale (liste des offres)
│   │   └── jobs/
│   │       └── $id.tsx           # Détail d'une offre
│   ├── components/               # Composants React
│   │   ├── JobCard.tsx
│   │   ├── JobList.tsx
│   │   ├── SearchBar.tsx
│   │   ├── Filters.tsx
│   │   └── SourceStatus.tsx
│   ├── routeTree.gen.ts          # Généré automatiquement
│   ├── client.tsx                # Point d'entrée client
│   ├── router.tsx                # Configuration du router
│   └── ssr.tsx                   # Point d'entrée SSR
├── server/
│   ├── api/
│   │   ├── jobs.ts               # GET : recherche/filtrage
│   │   ├── scrape.ts             # POST : scrape manuel
│   │   └── sources.ts            # GET : statut des sources
│   └── functions/                # Server functions
├── lib/
│   ├── db/
│   │   ├── schema.ts             # Schéma Drizzle
│   │   ├── index.ts              # Instance de connexion
│   │   └── migrations/
│   ├── scrapers/
│   │   ├── types.ts              # Interface JobSource + types communs
│   │   ├── linkedin.ts
│   │   ├── indeed.ts
│   │   ├── welcometothejungle.ts
│   │   ├── isarta.ts
│   │   ├── hellowork.ts
│   │   ├── emploi-territorial.ts
│   │   └── index.ts              # Registry de toutes les sources
│   ├── scheduler.ts              # Configuration node-cron
│   ├── dedup.ts                  # Logique de déduplication
│   └── utils.ts
├── types/
│   └── index.ts                  # Types globaux
├── app.config.ts                 # Config TanStack Start
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.local                    # Variables d'environnement
```

### 4.2 — Interface commune des scrapers

Chaque source doit implémenter cette interface :

```typescript
// lib/scrapers/types.ts

export interface JobOffer {
  sourceId: string;          // ex: "linkedin", "indeed"
  externalId: string;        // ID unique sur le site source
  title: string;
  company: string;
  location: string;
  url: string;               // Lien direct vers l'offre
  publishedAt: Date | null;
  contractType?: string;     // CDI, CDD, freelance…
  salary?: string;
  description?: string;      // Résumé court si disponible
  tags?: string[];           // Compétences, mots-clés
  raw?: Record<string, unknown>; // Données brutes pour debug
}

export interface ScrapeResult {
  source: string;
  success: boolean;
  jobsFound: number;
  jobsNew: number;           // Après dédup
  errors?: string[];
  duration: number;          // En ms
}

export interface JobSource {
  name: string;
  id: string;
  baseUrl: string;
  scrape(params: SearchParams): Promise<JobOffer[]>;
}

export interface SearchParams {
  keywords: string[];        // ex: ["développeur frontend", "react"]
  location: string;          // ex: "Paris", "Île-de-France"
  radius?: number;           // En km
  contractTypes?: string[];
  maxResults?: number;
}
```

### 4.3 — Schéma de base de données

```typescript
// lib/db/schema.ts — Schéma Drizzle pour SQLite

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: text("source_id").notNull(),        // "linkedin", "indeed"…
  externalId: text("external_id").notNull(),     // ID sur le site source
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  url: text("url").notNull(),
  publishedAt: text("published_at"),             // ISO 8601
  contractType: text("contract_type"),
  salary: text("salary"),
  description: text("description"),
  tags: text("tags"),                            // JSON stringifié
  firstSeenAt: text("first_seen_at").notNull(),  // Date du premier scrape
  lastSeenAt: text("last_seen_at").notNull(),    // Date du dernier scrape
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isFavorite: integer("is_favorite", { mode: "boolean" }).default(false),
  isHidden: integer("is_hidden", { mode: "boolean" }).default(false),
  notes: text("notes"),                          // Notes personnelles
});

// Index unique pour éviter les doublons par source
// CREATE UNIQUE INDEX idx_source_external ON jobs(source_id, external_id);

export const scrapeRuns = sqliteTable("scrape_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: text("source_id").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  success: integer("success", { mode: "boolean" }),
  jobsFound: integer("jobs_found"),
  jobsNew: integer("jobs_new"),
  errors: text("errors"),                        // JSON stringifié
});
```

---

## 5. Logique de déduplication

Les doublons peuvent apparaître de deux façons :
1. **Même offre scrapée deux fois** sur la même source → géré par l'index unique `(source_id, external_id)`
2. **Même offre publiée sur plusieurs sites** → déduplication "fuzzy" basée sur :
   - Normalisation du titre (lowercase, suppression des espaces multiples)
   - Normalisation du nom d'entreprise
   - Comparaison de localisation
   - Si titre + entreprise + ville correspondent à >90%, marquer comme doublon et garder la version la plus complète

Implémenter la dédup en deux passes :
- **Pass 1 (exacte)** : contrainte unique en base par source
- **Pass 2 (fuzzy)** : script de dédup cross-source exécuté après chaque cycle de scrape

---

## 6. Fonctionnalités de l'interface

### MVP (v1)
- [ ] Liste paginée des offres avec tri par date
- [ ] Barre de recherche full-text (titre, entreprise, description)
- [ ] Filtres : source, type de contrat, localisation, date
- [ ] Badge coloré par source (LinkedIn = bleu, Indeed = violet…)
- [ ] Lien direct vers l'offre originale
- [ ] Bouton "favori" et "masquer"
- [ ] Indicateur de statut des sources (dernier scrape, nombre d'offres)
- [ ] Bouton pour déclencher un scrape manuel

### V2 (améliorations futures)
- [ ] Notes personnelles sur chaque offre
- [ ] Suivi de candidature (statuts : à postuler, postulé, entretien, refus…)
- [ ] Notifications (nouvelles offres correspondant à des critères sauvegardés)
- [ ] Export CSV
- [ ] Dark mode

---

## 7. Bonnes pratiques de scraping

- **Rate limiting** : Minimum 2-3 secondes entre chaque requête vers un même site. Délais aléatoires (jitter).
- **User-Agent** : Utiliser un User-Agent réaliste de navigateur, en rotation.
- **Respect du robots.txt** : Vérifier et respecter les directives.
- **Gestion d'erreurs** : Chaque scraper doit être résilient. Un échec sur une source ne doit pas bloquer les autres. Logger les erreurs proprement.
- **Retry** : Max 2 retries avec backoff exponentiel en cas d'échec réseau.
- **Cache** : Ne pas re-scraper une page si elle a été scrapée il y a moins de X minutes (configurable).
- **Validation** : Valider chaque offre avec Zod avant insertion en base. Rejeter silencieusement les offres malformées (mais les logger).

---

## 8. Variables d'environnement

```env
# .env.local
SCRAPE_INTERVAL_MINUTES=60        # Fréquence des scrapes automatiques
SCRAPE_DELAY_MS_MIN=2000          # Délai minimum entre requêtes (ms)
SCRAPE_DELAY_MS_MAX=5000          # Délai maximum entre requêtes (ms)
DEFAULT_SEARCH_KEYWORDS=développeur frontend,react,typescript
DEFAULT_SEARCH_LOCATION=Paris
DEFAULT_SEARCH_RADIUS_KM=50
DATABASE_PATH=./data/jobs.db
```

---

## 9. Commandes de développement

```bash
# Installation
pnpm install

# Lancer en dev (TanStack Start via Vite)
pnpm dev

# Générer les migrations Drizzle
pnpm drizzle-kit generate

# Appliquer les migrations
pnpm drizzle-kit migrate

# Lancer un scrape manuel (via API)
curl -X POST http://localhost:3000/api/scrape

# Build production (Nitro)
pnpm build

# Lancer en production
pnpm start
```

---

## 10. Contraintes et rappels

- **TypeScript strict** : `strict: true` dans tsconfig. Pas de `any` sauf cas exceptionnel justifié.
- **Pas de scraping abusif** : Ce projet est à usage personnel uniquement.
- **Modularité** : Chaque scraper est indépendant. On doit pouvoir en ajouter ou en désactiver un sans toucher au reste.
- **Logs** : Utiliser un logger structuré (console.log formaté ou pino) pour tracer les scrapes.
- **Tests** : Écrire au minimum des tests unitaires pour la logique de dédup et la validation Zod des offres.
