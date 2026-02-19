const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
]

export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

export function buildFetchHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    'User-Agent': randomUserAgent(),
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
    ...extra,
  }
}

const BLOCKED_STATUSES = new Set([403, 429, 503, 999])
const CAPTCHA_MARKERS = [
  'captcha',
  'challenge-running',
  'cf-browser-verification',
  'please verify you are a human',
]

export interface FetchResult {
  html: string
  blocked: boolean
}

export async function fetchWithRetry(
  url: string,
  opts?: {
    maxRetries?: number
    headers?: Record<string, string>
    tag?: string
  },
): Promise<FetchResult> {
  const maxRetries = opts?.maxRetries ?? 2
  const tag = opts?.tag ?? 'scraper'

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: buildFetchHeaders(opts?.headers),
      })

      if (BLOCKED_STATUSES.has(response.status)) {
        console.warn(
          `[${tag}] Blocked (HTTP ${response.status}) on ${url}`,
        )
        return { html: '', blocked: true }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()

      const lower = html.toLowerCase()
      if (CAPTCHA_MARKERS.some((m) => lower.includes(m))) {
        console.warn(`[${tag}] Captcha/challenge detected on ${url}`)
        return { html: '', blocked: true }
      }

      return { html, blocked: false }
    } catch (error) {
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000
        console.warn(
          `[${tag}] Retry ${attempt + 1}/${maxRetries} for ${url} (waiting ${backoffMs}ms)`,
        )
        await new Promise((r) => setTimeout(r, backoffMs))
      } else {
        console.error(`[${tag}] Failed after ${maxRetries + 1} attempts: ${url}`, error)
        return { html: '', blocked: false }
      }
    }
  }

  return { html: '', blocked: false }
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function filterByTitle<T extends { title: string }>(
  offers: T[],
  keywords: string[],
): T[] {
  if (keywords.length === 0) return []
  const patterns = keywords.map((kw) => {
    const escaped = normalizeText(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`)
  })
  return offers.filter((offer) => {
    const title = normalizeText(offer.title)
    return patterns.some((re) => re.test(title))
  })
}

export function filterByLocation<T extends { location: string }>(
  offers: T[],
  location: string,
): T[] {
  if (!location) return offers
  const normalized = normalizeText(location)
  return offers.filter((offer) => normalizeText(offer.location).includes(normalized))
}

/**
 * Parse relative date strings in French or English into a Date.
 * Handles: "il y a 3 jours", "aujourd'hui", "hier", "3 days ago", "today", "just posted"
 */
export function parseRelativeDate(text: string): Date | null {
  if (!text) return null

  const cleaned = text.trim().toLowerCase()
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // French
  if (cleaned.includes("aujourd'hui") || cleaned.includes('aujourd')) {
    return now
  }
  if (cleaned.includes('hier')) {
    now.setDate(now.getDate() - 1)
    return now
  }
  const frDaysMatch = cleaned.match(/il y a (\d+)\s*jour/)
  if (frDaysMatch) {
    now.setDate(now.getDate() - Number(frDaysMatch[1]))
    return now
  }
  const frMonthsMatch = cleaned.match(/il y a (\d+)\s*mois/)
  if (frMonthsMatch) {
    now.setMonth(now.getMonth() - Number(frMonthsMatch[1]))
    return now
  }

  // English
  if (
    cleaned.includes('today') ||
    cleaned.includes('just posted') ||
    cleaned.includes('just now')
  ) {
    return now
  }
  if (cleaned.includes('yesterday')) {
    now.setDate(now.getDate() - 1)
    return now
  }
  const enDaysMatch = cleaned.match(/(\d+)\s*days?\s*ago/)
  if (enDaysMatch) {
    now.setDate(now.getDate() - Number(enDaysMatch[1]))
    return now
  }
  const enMonthsMatch = cleaned.match(/(\d+)\s*months?\s*ago/)
  if (enMonthsMatch) {
    now.setMonth(now.getMonth() - Number(enMonthsMatch[1]))
    return now
  }
  const enHoursMatch = cleaned.match(/(\d+)\s*hours?\s*ago/)
  if (enHoursMatch) {
    // Same day
    return now
  }

  return null
}
