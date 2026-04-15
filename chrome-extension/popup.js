// NetFree Inspector — Popup Script

// ─────────────────────────────────────────────
// i18n strings
// ─────────────────────────────────────────────
const T = {
  he: {
    subtitle:         'בודק חסימות',
    checking:         'בודק…',
    noBlocks:         'לא נמצאו חסימות',
    noBlocksSub:      'כל הבקשות בדף זה עברו בהצלחה דרך נט פרי.',
    noBlocksHint:     'אם הדף לא עובד כראוי, נסה לרענן.',
    noMeaningful:     'לא נמצאו חסימות משמעותיות',
    noMeaningfulSub:  'נמצאו רק חסימות פרסומות/מעקב שלא משפיעות על הדף.',
    blocksFound:      (n) => `נמצאו ${n} חסימ${n === 1 ? 'ה' : 'ות'} בדף זה`,
    blocksSubFound:   'לחץ על "פתח בקשה" לפנייה ישירה לנט פרי',
    blacklisted:      '🚫 חסום — האתר ברשימה השחורה',
    notWhitelisted:   '⏳ לא ברשימה הלבנה — ממתין לאישור',
    userSettings:     '⚙️ חסום בהגדרות אישיות',
    unknown:          '❓ חסום — צד שלישי',
    copyUrl:          'העתק',
    copyAll:          'העתק הכל',
    openTicket:       'פתח בקשה ב-NetFree ↗',
    reload:           'רענן ורשום',
    copied:           '✓ הועתק',
    requests:         (n) => `${n} ${n === 1 ? 'בקשה' : 'בקשות'}`,
    moreRequests:     (n) => `+ ${n} בקשות נוספות`,
    loading:          'טוען…',
    harmlessHidden:   (n) => `+ ${n} חסימות פרסומות/מעקב מוסתרות`,
  },
  en: {
    subtitle:         'Block Inspector',
    checking:         'Checking…',
    noBlocks:         'No blocks detected',
    noBlocksSub:      'All requests on this page passed through NetFree successfully.',
    noBlocksHint:     'If the page isn\'t working correctly, try reloading below.',
    noMeaningful:     'No meaningful blocks detected',
    noMeaningfulSub:  'Only ad/tracker blocks were found — these don\'t affect the page.',
    blocksFound:      (n) => `${n} block${n !== 1 ? 's' : ''} found on this page`,
    blocksSubFound:   'Click "Open Request" to report directly to NetFree',
    blacklisted:      '🚫 Blacklisted — explicitly blocked',
    notWhitelisted:   '⏳ Not whitelisted — pending review',
    userSettings:     '⚙️ Blocked by personal settings',
    unknown:          '❓ Blocked — 3rd party resource',
    copyUrl:          'Copy',
    copyAll:          'Copy All',
    openTicket:       'Open NetFree Request ↗',
    reload:           'Reload & Record',
    copied:           '✓ Copied',
    requests:         (n) => `${n} request${n !== 1 ? 's' : ''}`,
    moreRequests:     (n) => `+ ${n} more request${n !== 1 ? 's' : ''}`,
    loading:          'Loading…',
    harmlessHidden:   (n) => `+ ${n} ad/tracker block${n !== 1 ? 's' : ''} hidden`,
  },
};

// Badge / card config per block type
const BLOCK_META = {
  blacklisted: {
    badgeClass: 'badge-blacklisted',
    stripClass: 'strip-blacklisted',
    label: (t) => t.blacklisted,
  },
  not_whitelisted: {
    badgeClass: 'badge-not-whitelisted',
    stripClass: 'strip-not-whitelisted',
    label: (t) => t.notWhitelisted,
  },
  user_settings: {
    badgeClass: 'badge-user-settings',
    stripClass: 'strip-user-settings',
    label: (t) => t.userSettings,
  },
  unknown: {
    badgeClass: 'badge-unknown',
    stripClass: 'strip-unknown',
    label: (t) => t.unknown,
  },
};

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let lang           = 'he';
let tabId          = null;
let tabUrl         = '';
let blocks         = [];
let showHarmless   = false;   // persisted in chrome.storage.local

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Restore persisted preferences
  const stored = await chrome.storage.local.get(['lang', 'showHarmless']);
  lang         = stored.lang ?? 'he';
  showHarmless = !!stored.showHarmless;
  applyLang(lang, false);

  // Sync harmless toggle state
  const tg = document.getElementById('harmlessToggle');
  if (tg) tg.checked = showHarmless;

  // Identify current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabId  = tab.id;
  tabUrl = tab.url ?? '';

  // Show domain in page bar
  try {
    document.getElementById('pageDomain').textContent = new URL(tabUrl).hostname;
  } catch {
    document.getElementById('pageDomain').textContent = tabUrl || '—';
  }

  // Fetch block data from the service worker
  await loadBlocks();

  // Wire up buttons
  document.getElementById('langBtn').addEventListener('click', toggleLang);
  document.getElementById('reloadBtn').addEventListener('click', reloadTab);
  document.getElementById('copyAllBtn').addEventListener('click', copyAll);

  const harmlessEl = document.getElementById('harmlessToggle');
  if (harmlessEl) {
    harmlessEl.addEventListener('change', async () => {
      showHarmless = harmlessEl.checked;
      await chrome.storage.local.set({ showHarmless });
      render();
    });
  }
});

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
async function loadBlocks() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_BLOCKS', tabId });
  blocks = res?.blocks ?? [];
  render();
}

// ─────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────
function render() {
  const t     = T[lang];
  const list  = document.getElementById('blocksList');
  const sum   = document.getElementById('summary');
  const sumTl = document.getElementById('summaryTitle');
  const sumSb = document.getElementById('summarySub');
  const sumIc = document.getElementById('summaryIcon');
  const hBar  = document.getElementById('harmlessBar');
  const hCnt  = document.getElementById('harmlessCount');

  // Count both harmless and total across all groups
  let totalAll       = 0;
  let totalHarmless  = 0;
  for (const g of blocks) {
    for (const r of g.requests) {
      totalAll++;
      if (r.harmless) totalHarmless++;
    }
  }
  const meaningful = totalAll - totalHarmless;

  // Harmless bar — only visible if there are harmless blocks
  if (hBar) {
    if (totalHarmless > 0) {
      hBar.style.display = '';
      if (hCnt) hCnt.textContent = t.harmlessHidden(totalHarmless).replace(/^\+\s*/, '');
    } else {
      hBar.style.display = 'none';
    }
  }

  // ── Summary banner ──────────────────────────────────────
  if (totalAll === 0) {
    sum.className    = 'summary state-clean';
    sumIc.textContent = '✅';
    sumTl.textContent = t.noBlocks;
    sumSb.textContent = '';

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <div class="empty-title">${esc(t.noBlocks)}</div>
        <div class="empty-sub">${esc(t.noBlocksSub)}<br/><br/>${esc(t.noBlocksHint)}</div>
      </div>
    `;
    return;
  }

  // Only harmless blocks found — green "no meaningful blocks" state
  if (meaningful === 0 && !showHarmless) {
    sum.className    = 'summary state-clean';
    sumIc.textContent = '✅';
    sumTl.textContent = t.noMeaningful;
    sumSb.textContent = t.noMeaningfulSub;

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <div class="empty-title">${esc(t.noMeaningful)}</div>
        <div class="empty-sub">${esc(t.noMeaningfulSub)}</div>
      </div>
    `;
    return;
  }

  // Filter requests per the toggle
  const visibleBlocks = blocks
    .map(g => ({
      ...g,
      requests: showHarmless ? g.requests : g.requests.filter(r => !r.harmless),
    }))
    .filter(g => g.requests.length > 0);

  const shownTotal = visibleBlocks.reduce((s, g) => s + g.requests.length, 0);

  sum.className     = 'summary state-blocks';
  sumIc.textContent = '🔴';
  sumTl.textContent = t.blocksFound(shownTotal);
  sumSb.textContent = t.blocksSubFound;

  // ── Block cards ─────────────────────────────────────────
  list.innerHTML = '';
  for (const group of visibleBlocks) {
    list.appendChild(buildCard(group, t));
  }
}

// ─────────────────────────────────────────────
// Build card DOM
// ─────────────────────────────────────────────
function buildCard(group, t) {
  const { domain, blockType, requests } = group;
  const meta = BLOCK_META[blockType] ?? BLOCK_META.unknown;

  // Ticket URL — use the first blocked URL + current tab as referrer
  const ticketUrl = makeTicketUrl(requests[0]?.url ?? `https://${domain}/`, tabUrl);

  // Show up to 4 requests; collapse the rest
  const MAX_SHOW    = 4;
  const shown       = requests.slice(0, MAX_SHOW);
  const hiddenCount = requests.length - shown.length;

  const card = document.createElement('div');
  card.className = 'block-card';

  card.innerHTML = `
    <div class="block-card-strip ${meta.stripClass}"></div>

    <div class="block-card-head">
      <span class="block-badge ${meta.badgeClass}">${esc(meta.label(t))}</span>
    </div>

    <div style="display:flex;align-items:center;gap:6px;padding:4px 12px 8px;">
      <span class="block-domain">${esc(domain)}</span>
      <span class="block-count-pill">${esc(t.requests(requests.length))}</span>
    </div>

    <div class="block-requests" id="reqs-${esc(domain)}">
      ${shown.map(req => reqRowHtml(req)).join('')}
      ${hiddenCount > 0 ? `<div class="more-rows">${esc(t.moreRequests(hiddenCount))}</div>` : ''}
    </div>

    <div class="block-card-actions">
      <button class="card-action-btn copy-group-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        ${esc(t.copyUrl)}
      </button>
      <button class="card-action-btn ticket-btn" data-ticket-url="${esc(ticketUrl)}" type="button">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${esc(t.openTicket)}
      </button>
    </div>
  `;

  // Per-row copy buttons
  card.querySelectorAll('.req-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyText(btn.dataset.url);
    });
  });

  // Group copy button
  card.querySelector('.copy-group-btn').addEventListener('click', () => {
    copyText(requests.map(r => r.url).join('\n'));
  });

  // Ticket button — open NetFree request form in a separate Chrome popup
  // window (a small, frameless window), not a full browser tab.
  const ticketBtn = card.querySelector('.ticket-btn');
  if (ticketBtn) {
    ticketBtn.addEventListener('click', () => {
      openTicketWindow(ticketBtn.dataset.ticketUrl);
    });
  }

  return card;
}

// Open the NetFree ticket form as a small popup window.
// Falls back to a new tab if the windows API is unavailable (very old Chrome).
function openTicketWindow(url) {
  if (!url) return;
  if (chrome.windows && chrome.windows.create) {
    chrome.windows.create({
      url,
      type:   'popup',
      width:  520,
      height: 720,
    });
  } else {
    chrome.tabs.create({ url });
  }
}

function reqRowHtml(req) {
  const short = shortenUrl(req.url);
  return `
    <div class="req-row">
      <span class="req-type">${esc(req.resourceType)}</span>
      <span class="req-url" title="${esc(req.url)}" dir="ltr">${esc(short)}</span>
      <button class="req-copy-btn" data-url="${esc(req.url)}" title="Copy URL">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Language
// ─────────────────────────────────────────────
function applyLang(newLang, doRender = true) {
  lang = newLang;
  const html = document.documentElement;
  html.lang = lang;
  html.dir  = lang === 'he' ? 'rtl' : 'ltr';

  document.getElementById('langBtn').textContent        = lang === 'he' ? 'EN' : 'עב';
  document.getElementById('hdr-subtitle').textContent   = T[lang].subtitle;

  // Update all data-he/data-en elements
  document.querySelectorAll('[data-he][data-en]').forEach(el => {
    el.textContent = el.dataset[lang];
  });

  chrome.storage.local.set({ lang });
  if (doRender) render();
}

function toggleLang() {
  applyLang(lang === 'he' ? 'en' : 'he');
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────
async function reloadTab() {
  if (tabId !== null) {
    await chrome.tabs.reload(tabId);
    window.close();
  }
}

async function copyAll() {
  const allUrls = blocks.flatMap(g => g.requests.map(r => r.url)).join('\n');
  if (allUrls) await copyText(allUrls);
}

async function copyText(text) {
  const t = T[lang];
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for restricted contexts
    const ta = Object.assign(document.createElement('textarea'), {
      value: text, style: 'position:fixed;opacity:0'
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast(t.copied);
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 1800);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function makeTicketUrl(blockedUrl, referrer) {
  const u = encodeURIComponent(blockedUrl);
  const r = encodeURIComponent(referrer);
  return `https://netfree.link/app/#/tickets/new?u=${u}&r=${r}&t=site&bi=`;
}

function shortenUrl(url) {
  try {
    const { pathname, search } = new URL(url);
    const p = pathname + search;
    return p.length > 50 ? p.slice(0, 48) + '…' : p;
  } catch {
    return url.slice(0, 50);
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
