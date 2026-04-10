// NetFree Inspector — Background Service Worker
// Detects HTTP 418 responses (NetFree block signal) on any browser tab.
//
// Block types:
//   'blacklisted'     — site was reviewed and explicitly blocked (block.avif)
//   'not_whitelisted' — site is unknown / pending whitelist review (unknown.avif)
//   'user_settings'   — blocked by the user's own personal settings (myset.avif)
//   'unknown'         — sub-resource block; type undetectable without the block page

const NETFREE_HOST = 'netfree.link';
const BLOCK_CODE   = 418;

// ─────────────────────────────────────────────────────────
// Session storage helpers
// (chrome.storage.session persists across SW restarts within
//  the same browser session, unlike in-memory Maps)
// ─────────────────────────────────────────────────────────

async function getTabData(tabId) {
  try {
    const key = `tab_${tabId}`;
    const res = await chrome.storage.session.get(key);
    return res[key] ?? { blocks: [], tabUrl: '' };
  } catch {
    return { blocks: [], tabUrl: '' };
  }
}

async function setTabData(tabId, data) {
  const key = `tab_${tabId}`;
  await chrome.storage.session.set({ [key]: data });
}

async function clearTabData(tabId) {
  await chrome.storage.session.remove(`tab_${tabId}`);
}

// ─────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────

async function refreshBadge(tabId) {
  const data  = await getTabData(tabId);
  const total = data.blocks.reduce((s, g) => s + g.requests.length, 0);

  if (total > 0) {
    chrome.action.setBadgeText({ tabId, text: String(total) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#EF4444' });
    try { chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' }); } catch {}
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

// ─────────────────────────────────────────────────────────
// webRequest — observe all completed requests
// ─────────────────────────────────────────────────────────

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const { tabId, statusCode, url, type, timeStamp, initiator } = details;
    if (tabId === -1) return; // background / extension-internal

    // ── 1. NetFree block signal: HTTP 418 ──────────────────────────────────
    if (statusCode === BLOCK_CODE && !url.includes(NETFREE_HOST)) {
      const data   = await getTabData(tabId);
      const domain = extractDomain(url);

      let group = data.blocks.find(g => g.domain === domain);
      if (!group) {
        group = { domain, blockType: 'unknown', requests: [] };
        data.blocks.push(group);
      }

      group.requests.push({
        url,
        resourceType: type,
        timestamp: timeStamp,
        initiator: initiator ?? '',
      });

      await setTabData(tabId, data);
      await refreshBadge(tabId);
      return;
    }

    // ── 2. Detect block TYPE from NetFree block-page assets ─────────────────
    //    When the main document is blocked, the browser loads the block page
    //    from netfree.link/block/.  The image filename reveals the block type:
    //      block.avif   → site is explicitly blacklisted
    //      unknown.avif → site is not whitelisted (unknown / pending review)
    if (url.includes(NETFREE_HOST + '/block/') || url.includes(NETFREE_HOST + '/')) {
      const data = await getTabData(tabId);
      if (!data.blocks.length) return;

      // Target the main-frame block group (or fall back to the latest group)
      const target =
        data.blocks.find(g => g.requests.some(r => r.resourceType === 'main_frame'))
        ?? data.blocks[data.blocks.length - 1];

      if (url.includes('block.avif')) {
        target.blockType = 'blacklisted';
        await setTabData(tabId, data);
      } else if (url.includes('unknown.avif')) {
        target.blockType = 'not_whitelisted';
        await setTabData(tabId, data);
      } else if (url.includes('myset.avif')) {
        target.blockType = 'user_settings';
        await setTabData(tabId, data);
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// ─────────────────────────────────────────────────────────
// Navigation — clear stale data when the user navigates away
// ─────────────────────────────────────────────────────────

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only
  await clearTabData(details.tabId);
  try { chrome.action.setBadgeText({ tabId: details.tabId, text: '' }); } catch {}
});

// ─────────────────────────────────────────────────────────
// Tab events
// ─────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await clearTabData(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const data = await getTabData(tabId);
    data.tabUrl = tab.url ?? changeInfo.url;
    await setTabData(tabId, data);
  }
});

// ─────────────────────────────────────────────────────────
// Messages from popup
// ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  switch (msg.type) {

    case 'GET_BLOCKS':
      getTabData(msg.tabId).then(reply);
      return true; // async

    case 'CLEAR_BLOCKS':
      clearTabData(msg.tabId).then(async () => {
        try { chrome.action.setBadgeText({ tabId: msg.tabId, text: '' }); } catch {}
        reply({ ok: true });
      });
      return true;

    case 'GET_TAB_URL':
      chrome.tabs.get(msg.tabId, (tab) => reply({ url: tab?.url ?? '' }));
      return true;
  }
});
