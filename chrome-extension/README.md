# NetFree Inspector — Chrome Extension

גלה חסימות נט פרי בכל דף באחת · Instantly detect NetFree content filter blocks on any page.

---

## What it does

NetFree is a whitelist-based content filter. When a page loads slowly or breaks,
it's often because 3rd-party resources (scripts, images, API calls) are blocked — but
you can't tell at a glance.

**NetFree Inspector** monitors every network request in the background.
Click the toolbar icon on any page to instantly see:

- Which URLs were blocked (HTTP 418 = NetFree block signal)
- The **block type** per domain:
  - 🚫 **Blacklisted** — site was reviewed and explicitly blocked
  - ⏳ **Not whitelisted** — site is unknown, pending review
  - ⚙️ **Personal settings** — blocked by the user's own NetFree settings
  - ❓ **Blocked** — 3rd-party sub-resource (type undetectable without the block page)
- A **direct link** to open a pre-filled NetFree whitelist request for each blocked URL

---

## How to install (Developer / Unpacked mode)

1. Clone or download this folder (`chrome-extension/`)
2. Generate icons (first time only):
   ```bash
   node create-icons.js
   ```
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the `chrome-extension/` folder
6. The NetFree Inspector icon appears in your toolbar

---

## How to use

1. Visit any page that seems broken or slow
2. Click the **NetFree Inspector** icon in the toolbar
3. The popup shows all blocked requests grouped by domain
4. For each blocked domain:
   - Click **העתק / Copy** to copy all blocked URLs to clipboard
   - Click **פתח בקשה / Open NetFree Request** to open the NetFree support form
     pre-filled with the blocked URL and your current page as the referrer
5. Use **רענן ורשום / Reload & Record** to reload the page and capture all requests from scratch

---

## Technical details

| Item | Value |
|---|---|
| Manifest | Version 3 |
| Block signal | HTTP status 418 |
| Block type detection | `block.avif` → blacklisted · `unknown.avif` → not whitelisted · `myset.avif` → personal settings |
| State storage | `chrome.storage.session` (clears on browser close) |
| Permissions | `webRequest`, `tabs`, `storage`, `webNavigation`, `<all_urls>` |

---

## File structure

```
chrome-extension/
├── manifest.json        Manifest V3 config
├── background.js        Service worker — webRequest listener, state management
├── popup.html           Toolbar popup page
├── popup.css            Modern RTL-aware styles
├── popup.js             Popup render logic, i18n (Hebrew / English)
├── create-icons.js      Icon generator (pure Node.js, no dependencies)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```
