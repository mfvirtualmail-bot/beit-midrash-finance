// NetFree Inspector — Harmless-domain list
//
// Blocks against these domains almost always represent third-party ads,
// analytics, trackers, or social pixels. NetFree blocks them, but their
// absence doesn't break the page. They're hidden by default in the popup.
//
// Matching is case-insensitive suffix match on the request's hostname:
//   "doubleclick.net"  matches  "ad.doubleclick.net" and "doubleclick.net"
//
// ── Sources (merged at runtime, deduplicated) ────────────────────────────
//   1. BUNDLED_FALLBACK  — hardcoded below, always available offline.
//   2. Remote JSON       — fetched once per day from GitHub Pages:
//        https://mfvirtualmail-bot.github.io/beit-midrash-finance/
//                netfree-inspector/harmless-domains.json
//      Cached in chrome.storage.local, falls back gracefully if offline.
//   3. User custom list  — entries the user added via the options page.

const BUNDLED_FALLBACK = [
  // ── Google ads / analytics / tag manager ────────────────────────────────
  'doubleclick.net',
  'googlesyndication.com',
  'googletagmanager.com',
  'googletagservices.com',
  'google-analytics.com',
  'googleadservices.com',
  'adservice.google.com',
  'adsystem.google.com',
  'pagead2.googlesyndication.com',

  // ── Facebook / Meta tracking ────────────────────────────────────────────
  'facebook.net',
  'connect.facebook.net',

  // ── Twitter / X ads ─────────────────────────────────────────────────────
  'ads-twitter.com',
  'analytics.twitter.com',

  // ── TikTok / Snap / Pinterest pixels ────────────────────────────────────
  'analytics.tiktok.com',
  'sc-static.net',
  'ct.pinterest.com',

  // ── Common analytics / heatmap / session-replay ─────────────────────────
  'hotjar.com',
  'mouseflow.com',
  'fullstory.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'heap.io',
  'heapanalytics.com',
  'clarity.ms',
  'bat.bing.com',

  // ── General ad networks ─────────────────────────────────────────────────
  'adsrvr.org',
  'adnxs.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'quantcount.com',
  'adform.net',

  // ── Tag / consent managers ──────────────────────────────────────────────
  'onetrust.com',
  'cookielaw.org',
  'cookiebot.com',
  'trustarc.com',

  // ── Error / performance telemetry ───────────────────────────────────────
  'sentry.io',
  'bugsnag.com',
  'newrelic.com',
  'nr-data.net',
  'datadoghq.com',
  'logrocket.com',
  'rollbar.com',
];

const REMOTE_URL =
  'https://mfvirtualmail-bot.github.io/beit-midrash-finance/netfree-inspector/harmless-domains.json';

const REMOTE_CACHE_KEY = 'harmlessRemoteCache';
const USER_CUSTOM_KEY  = 'harmlessUserList';
const REFRESH_EVERY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── In-memory active suffix set (rebuilt after any change) ────────────────
let activeSuffixes = new Set(BUNDLED_FALLBACK.map(s => s.toLowerCase()));

function rebuildSet(remoteDomains, userDomains) {
  const set = new Set(BUNDLED_FALLBACK.map(s => s.toLowerCase()));
  if (Array.isArray(remoteDomains)) {
    for (const d of remoteDomains) {
      if (typeof d === 'string' && d.trim()) set.add(d.trim().toLowerCase());
    }
  }
  if (Array.isArray(userDomains)) {
    for (const d of userDomains) {
      if (typeof d === 'string' && d.trim()) set.add(d.trim().toLowerCase());
    }
  }
  activeSuffixes = set;
}

async function loadCachedAndUser() {
  try {
    const r = await chrome.storage.local.get([REMOTE_CACHE_KEY, USER_CUSTOM_KEY]);
    const remoteList = r[REMOTE_CACHE_KEY]?.domains;
    const userList   = r[USER_CUSTOM_KEY];
    rebuildSet(remoteList, userList);
  } catch {
    // storage unavailable — fallback stays active
  }
}

async function refreshRemoteIfStale() {
  try {
    const r       = await chrome.storage.local.get(REMOTE_CACHE_KEY);
    const cached  = r[REMOTE_CACHE_KEY];
    const fetched = cached?.fetchedAt ?? 0;
    if (Date.now() - fetched < REFRESH_EVERY_MS) return; // still fresh

    const res = await fetch(REMOTE_URL, { cache: 'no-cache' });
    if (!res.ok) return;
    const json = await res.json();
    if (!Array.isArray(json.domains)) return;

    await chrome.storage.local.set({
      [REMOTE_CACHE_KEY]: {
        domains:   json.domains,
        version:   json.version ?? null,
        updated:   json.updated ?? null,
        fetchedAt: Date.now(),
      },
    });
    await loadCachedAndUser();
  } catch {
    // offline / blocked / malformed — we just keep the previous cache
  }
}

function isHarmlessHost(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  for (const suffix of activeSuffixes) {
    if (h === suffix || h.endsWith('.' + suffix)) return true;
  }
  return false;
}

// React to live changes from the options page — rebuild the set immediately.
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[USER_CUSTOM_KEY] || changes[REMOTE_CACHE_KEY]) {
      loadCachedAndUser();
    }
  });
}

// Kick off initial load + refresh on service-worker startup.
loadCachedAndUser().then(() => refreshRemoteIfStale());

// Export to service-worker scope (importScripts)
self.isHarmlessHost       = isHarmlessHost;
self.refreshHarmlessList  = refreshRemoteIfStale;
self.HARMLESS_REMOTE_URL  = REMOTE_URL;
