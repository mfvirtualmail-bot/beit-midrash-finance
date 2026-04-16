// NetFree Inspector — Options page

const USER_CUSTOM_KEY  = 'harmlessUserList';
const REMOTE_CACHE_KEY = 'harmlessRemoteCache';
const LANG_KEY         = 'lang';

let lang = 'he';

// ── i18n ─────────────────────────────────────────────
function applyLang(newLang) {
  lang = newLang;
  const html = document.documentElement;
  html.lang  = lang;
  html.dir   = lang === 'he' ? 'rtl' : 'ltr';
  document.getElementById('langBtn').textContent = lang === 'he' ? 'EN' : 'עב';
  document.querySelectorAll('[data-he][data-en]').forEach(el => {
    // If the element has only text children, swap textContent
    if (el.children.length === 0 || el.tagName === 'A') {
      el.textContent = el.dataset[lang];
    }
  });
  chrome.storage.local.set({ [LANG_KEY]: lang });
}

// ── Load / save user list ───────────────────────────
async function loadUserList() {
  const r = await chrome.storage.local.get(USER_CUSTOM_KEY);
  const list = r[USER_CUSTOM_KEY] ?? [];
  document.getElementById('userList').value = list.join('\n');
}

async function saveUserList() {
  const raw = document.getElementById('userList').value;
  const list = raw
    .split(/[\n,]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s && !s.startsWith('#') && /^[a-z0-9.-]+$/.test(s));

  // Deduplicate
  const unique = Array.from(new Set(list));

  await chrome.storage.local.set({ [USER_CUSTOM_KEY]: unique });
  document.getElementById('userList').value = unique.join('\n');
  flashStatus();
}

async function resetUserList() {
  await chrome.storage.local.remove(USER_CUSTOM_KEY);
  document.getElementById('userList').value = '';
  flashStatus();
}

function flashStatus() {
  const el = document.getElementById('status');
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 1500);
}

// ── Remote list info ────────────────────────────────
async function refreshRemoteInfo() {
  const r = await chrome.storage.local.get(REMOTE_CACHE_KEY);
  const cache = r[REMOTE_CACHE_KEY];
  if (!cache) {
    document.getElementById('remoteVersion').textContent = '—';
    document.getElementById('remoteUpdated').textContent = '—';
    document.getElementById('remoteCount').textContent   = '—';
    document.getElementById('remoteFetched').textContent = '—';
    return;
  }
  document.getElementById('remoteVersion').textContent = cache.version ?? '—';
  document.getElementById('remoteUpdated').textContent = cache.updated ?? '—';
  document.getElementById('remoteCount').textContent   =
    Array.isArray(cache.domains) ? String(cache.domains.length) : '—';
  document.getElementById('remoteFetched').textContent = cache.fetchedAt
    ? new Date(cache.fetchedAt).toLocaleString()
    : '—';
}

async function forceRefreshRemote() {
  // Clear fetchedAt so the service worker re-fetches on next check.
  const r = await chrome.storage.local.get(REMOTE_CACHE_KEY);
  const cache = r[REMOTE_CACHE_KEY] ?? {};
  await chrome.storage.local.set({
    [REMOTE_CACHE_KEY]: { ...cache, fetchedAt: 0 },
  });
  // Ask the service worker to refresh right now.
  try {
    await chrome.runtime.sendMessage({ type: 'REFRESH_HARMLESS_LIST' });
  } catch {}
  // Give the SW a moment, then repaint.
  setTimeout(refreshRemoteInfo, 800);
}

// ── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(LANG_KEY);
  applyLang(stored[LANG_KEY] ?? 'he');

  // Fill extension version from manifest
  try {
    document.getElementById('extVersion').textContent =
      chrome.runtime.getManifest().version;
  } catch {}

  await loadUserList();
  await refreshRemoteInfo();

  document.getElementById('langBtn').addEventListener('click', () => {
    applyLang(lang === 'he' ? 'en' : 'he');
  });
  document.getElementById('saveBtn').addEventListener('click', saveUserList);
  document.getElementById('resetBtn').addEventListener('click', resetUserList);
  document.getElementById('refreshBtn').addEventListener('click', forceRefreshRemote);
});
