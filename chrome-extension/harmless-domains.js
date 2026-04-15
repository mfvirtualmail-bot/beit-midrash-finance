// NetFree Inspector — Harmless-domain list
//
// These domains almost always represent third-party ads, analytics, trackers,
// or social pixels that NetFree blocks but whose absence doesn't break the page.
// They're hidden by default in the popup; users can toggle them on.
//
// Kept conservative on purpose — inclusion here means "blocking this never
// stops a normal user from doing what they came to do."
//
// Matches are on the request's hostname (case-insensitive, suffix match).
// e.g. "doubleclick.net" matches "ad.doubleclick.net" and "stats.g.doubleclick.net".

const HARMLESS_DOMAIN_SUFFIXES = [
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
  'clarity.ms',          // Microsoft Clarity
  'bing.com/bat.js',     // (path match ignored — hostname match below)
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

  // ── Israeli ad / analytics ──────────────────────────────────────────────
  'walla.co.il/adv',     // (path ignored — hostname match if specific)
  'ynet.co.il/ads',      // (path ignored)
  'adsnative.com',

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

function isHarmlessHost(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  for (const suffix of HARMLESS_DOMAIN_SUFFIXES) {
    // suffix match: "doubleclick.net" ⇒ matches "x.doubleclick.net" and "doubleclick.net"
    if (h === suffix || h.endsWith('.' + suffix)) return true;
  }
  return false;
}

// Exported via service-worker global scope (importScripts)
self.isHarmlessHost            = isHarmlessHost;
self.HARMLESS_DOMAIN_SUFFIXES  = HARMLESS_DOMAIN_SUFFIXES;
