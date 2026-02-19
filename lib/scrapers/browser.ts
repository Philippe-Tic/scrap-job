import type { Browser, BrowserContext } from 'playwright'
import type { FetchResult } from './utils'

let chromiumLauncher: typeof import('playwright').chromium | null = null

async function getChromium() {
  if (!chromiumLauncher) {
    const pw = await import('playwright')
    chromiumLauncher = pw.chromium
  }
  return chromiumLauncher
}

const TAG = 'browser'
const IS_PROD = process.env.NODE_ENV === 'production'
const IDLE_TIMEOUT_MS = 60_000
const CHALLENGE_TIMEOUT_MS = 10_000
const NAV_TIMEOUT_MS = 30_000

// Only match actual block pages, not incidental "captcha" references in scripts
const BLOCK_MARKERS = [
  'id="challenge-running"',
  'id="challenge-stage"',
  'cf-browser-verification',
  'please verify you are a human',
  'just a moment',
  'checking your browser',
]

let browser: Browser | null = null
let context: BrowserContext | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser

  const headless = IS_PROD || process.env.BROWSER_HEADLESS !== 'false'
  console.log(`[${TAG}] Launching Chromium (headless: ${headless})...`)
  const chromium = await getChromium()
  browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  })

  browser.on('disconnected', () => {
    console.warn(`[${TAG}] Browser disconnected`)
    browser = null
    context = null
  })

  return browser
}

async function getContext(): Promise<BrowserContext> {
  if (context) return context

  const b = await getBrowser()
  context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  })

  return context
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    console.log(`[${TAG}] Idle timeout — closing browser`)
    closeBrowser()
  }, IDLE_TIMEOUT_MS)
}

export async function fetchWithBrowser(
  url: string,
  opts?: { tag?: string },
): Promise<FetchResult> {
  const tag = opts?.tag ?? TAG

  const ctx = await getContext()
  const page = await ctx.newPage()

  try {
    console.log(`[${tag}] Navigating: ${url}`)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    })

    // Wait for Cloudflare challenge to resolve
    try {
      await page.waitForFunction(
        () => !document.querySelector('#challenge-running') && !document.querySelector('#challenge-stage'),
        { timeout: CHALLENGE_TIMEOUT_MS },
      )
    } catch {
      console.warn(`[${tag}] Challenge did not resolve within ${CHALLENGE_TIMEOUT_MS}ms, waiting for networkidle...`)
      try {
        await page.waitForLoadState('networkidle', { timeout: 15_000 })
      } catch {
        // continue anyway and check the HTML
      }
    }

    const html = await page.content()

    const lower = html.toLowerCase()
    const matchedMarker = BLOCK_MARKERS.find((m) => lower.includes(m))
    const blocked = !!matchedMarker

    if (blocked) {
      console.warn(`[${tag}] Blocked (marker: "${matchedMarker}") on ${url}`)
      return { html: '', blocked: true }
    }

    return { html, blocked: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${tag}] Browser fetch failed for ${url}: ${message}`)
    return { html: '', blocked: false }
  } finally {
    await page.close()
    resetIdleTimer()
  }
}

export async function closeBrowser(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  if (context) {
    await context.close().catch(() => {})
    context = null
  }
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
  }
  console.log(`[${TAG}] Browser closed`)
}

// Cleanup on process exit to avoid zombie Chromium processes
function handleExit() {
  if (browser) {
    browser.close().catch(() => {})
    browser = null
    context = null
  }
}

process.on('SIGINT', handleExit)
process.on('SIGTERM', handleExit)
