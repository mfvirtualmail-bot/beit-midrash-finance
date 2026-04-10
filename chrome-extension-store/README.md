# NetFree Inspector — Chrome Web Store Submission Kit

This folder contains **everything you need** to publish NetFree Inspector to the Chrome Web Store.

---

## What's in this folder

| File | Purpose |
|---|---|
| `netfree-inspector-v1.1.0.zip` | **The upload file.** Drop this into the Chrome Web Store dashboard. |
| `store-listing-he.md` | Hebrew store page text (name, short description, long description) |
| `store-listing-en.md` | English store page text (same, in English) |
| `privacy-policy.md` | Privacy policy — must be published as a public web page before submission |
| `promo-tile.svg` | Promotional tile design (440×280) — needs to be exported to PNG before upload |
| `screenshots-guide.md` | Step-by-step guide to taking the 5 store screenshots |
| `README.md` | This file |

---

## Prerequisites — one-time setup

### 1. Create a Chrome Web Store developer account ($5 one-time fee)

1. Go to: https://chrome.google.com/webstore/devconsole/
2. Sign in with the Google account you want the extension published under.
3. Accept the developer agreement.
4. Pay the **one-time $5 USD registration fee** (credit card required).
5. You'll now see the developer dashboard.

> **Important:** the Google account you use here is the one that will own the extension. Use a dedicated account if you want the listing separate from your personal Google identity.

### 2. Publish the privacy policy somewhere public

The Chrome Web Store **requires a public URL** for the privacy policy (a GitHub-hosted markdown file works fine).

**Easiest option:**
1. The `privacy-policy.md` file in this folder is already committed to the repo.
2. After it's merged to `main`, it will be viewable at:
   ```
   https://github.com/mfvirtualmail-bot/beit-midrash-finance/blob/main/chrome-extension-store/privacy-policy.md
   ```
3. That URL is what you paste into the store listing's "Privacy policy" field.

**Better option (optional):** Enable GitHub Pages on the repo and host the policy at a cleaner URL like `https://mfvirtualmail-bot.github.io/beit-midrash-finance/privacy-policy.html`. Not required though — the GitHub markdown URL works.

### 3. Convert the promo tile SVG → PNG

The store accepts PNG/JPEG, not SVG. You need to convert `promo-tile.svg` → `promo-tile.png` at exactly **440×280 px**.

**Easiest ways to convert:**
- **Online:** https://cloudconvert.com/svg-to-png → upload `promo-tile.svg` → set width 440, height 280 → download PNG.
- **Photopea:** https://www.photopea.com → File → Open → select the SVG → set canvas to 440×280 → File → Export As → PNG.
- **Inkscape (desktop):** File → Export PNG Image → DPI = 96 → width 440.
- **Command line (if you have ImageMagick or rsvg-convert):**
  ```
  rsvg-convert -w 440 -h 280 promo-tile.svg -o promo-tile.png
  ```

Save the resulting PNG as `promo-tile.png` in this folder. It **must** be exactly 440×280 — the store will reject anything else.

### 4. Take the screenshots

Follow `screenshots-guide.md` to capture at least 1 (ideally 5) screenshots at 1280×800 px.

---

## Submission walkthrough

Once you have:
- ✅ Developer account paid for
- ✅ Privacy policy URL (public and reachable)
- ✅ `netfree-inspector-v1.1.0.zip` (in this folder — already built)
- ✅ `promo-tile.png` (converted from SVG)
- ✅ At least 1 screenshot at 1280×800

…here's how to submit:

### Step 1 — Upload the ZIP
1. Go to https://chrome.google.com/webstore/devconsole/
2. Click **"New item"** (top right).
3. Drag `netfree-inspector-v1.1.0.zip` into the upload area.
4. Wait ~10 seconds for Chrome to parse the manifest.
5. You'll be taken to the item's edit page.

### Step 2 — Fill in the Store Listing tab

Copy-paste the content from `store-listing-he.md` (recommended as primary, since it's a Hebrew-speaking audience) or `store-listing-en.md`.

| Field | What to paste |
|---|---|
| **Name** | `NetFree Inspector` |
| **Short description** | Short description from the listing file (132 chars max) |
| **Detailed description** | Full detailed description from the listing file |
| **Category** | `Developer Tools` (primary choice) — or `Productivity` |
| **Language** | `Hebrew` as primary, add `English` as secondary |
| **Screenshots** | Upload 1–5 PNGs from your screenshots folder |
| **Small promo tile (440×280)** | Upload `promo-tile.png` |
| **Marquee promo tile (1400×560)** | Optional — skip unless you want "featured" placement |
| **Icon** | Already in the ZIP (no upload needed) |
| **Official URL** | Optional — can link to the GitHub repo |
| **Homepage URL** | `https://github.com/mfvirtualmail-bot/beit-midrash-finance` (or your repo URL) |
| **Support URL** | `https://github.com/mfvirtualmail-bot/beit-midrash-finance/issues` |

### Step 3 — Fill in the Privacy tab

This is the most scrutinized tab. **Be thorough and honest** — bad answers here will get your extension rejected.

| Field | Value |
|---|---|
| **Single purpose description** | `Detects and lists URLs blocked by the NetFree content filter (HTTP 418 responses) on the current browser tab.` |
| **Permission justifications:** | |
| `webRequest` | `Required to observe HTTP responses and detect 418 status codes that indicate NetFree has blocked a URL.` |
| `tabs` | `Required to associate blocked requests with the correct browser tab so each tab shows its own block list.` |
| `storage` | `Required to temporarily store detected block data in chrome.storage.session so the popup can read it from the background service worker.` |
| `webNavigation` | `Required to detect when the user navigates to a new page so stale block data from the previous page can be cleared.` |
| **Host permission (`<all_urls>`) justification** | `NetFree can block requests on any website, so the extension must be able to observe HTTP responses from all URLs. The extension only reads response status codes and URLs — it does not read or modify page content.` |
| **Remote code** | **No** — the extension contains no remote code. |
| **Data usage disclosure** | Check **none** of the "personally identifiable information", "health info", "financial info", "authentication info", "personal communications", "location", "web history", "user activity", "website content" boxes. The extension observes URLs locally but does not collect or transmit them. |
| **Data use certifications** | Check all 3: (1) not selling data to third parties, (2) not using for purposes unrelated to single purpose, (3) not using for credit/lending. |
| **Privacy policy URL** | Paste the public URL of `privacy-policy.md` (GitHub raw link or GitHub Pages URL) |

### Step 4 — Distribution tab

| Field | Value |
|---|---|
| **Visibility** | `Public` |
| **Regions** | `All regions` (or select only Israel + worldwide Jewish diaspora regions if you want to limit) |
| **Pricing** | Free |

### Step 5 — Submit for review

1. Click **Save draft** at the top.
2. If all required fields are filled (you'll see green checkmarks on each tab), the **Submit for review** button becomes enabled.
3. Click it. Confirm in the dialog.
4. Status changes to **Pending review**.

### Step 6 — Wait for review

- **Typical review time:** a few hours to a few business days.
- Google sends email notifications when status changes.
- If approved → status becomes **Published** and the extension is live on the store. Share the store URL.
- If rejected → the email explains why. Fix and re-submit (no penalty).

### Step 7 — Share the store URL

Once published, your extension will be at:
```
https://chromewebstore.google.com/detail/netfree-inspector/<your-extension-id>
```

Share that URL with NetFree users, post it in relevant communities, etc.

---

## Common rejection reasons (avoid these)

1. **Vague permission justifications** — don't write "needed for functionality". Be specific: "needed to read HTTP status codes so 418 blocks can be detected".
2. **Missing privacy policy** — must be a **public URL** (not a local file, not a Google Doc with restricted sharing).
3. **"Remote code" = yes when it should be no** — we don't load any remote JS, so this is No. (The logo image from netfree.link is an image, not code.)
4. **Screenshots that don't show the extension UI** — each screenshot must visibly feature the popup or the toolbar badge.
5. **Requesting `<all_urls>` without a clear justification** — our justification is strong: NetFree can block on any site. Make sure that's written clearly.

---

## Version updates later

When you want to push a new version:

1. Edit the extension files.
2. Bump `"version"` in `manifest.json` (e.g. 1.1.0 → 1.1.1 or 1.2.0).
3. Re-run the ZIP build:
   ```
   cd chrome-extension
   zip -r ../chrome-extension-store/netfree-inspector-v1.1.1.zip . -x "create-icons.js" "README.md"
   ```
4. In the developer console, click the item → **Package** tab → **Upload new package** → drag in the new ZIP.
5. Submit for review again.

Updating screenshots, description, or privacy policy **does not** require code re-review, just submission.

---

## Quick checklist before submitting

- [ ] `netfree-inspector-v1.1.0.zip` exists in this folder
- [ ] `promo-tile.png` (exactly 440×280, PNG) exported from the SVG
- [ ] At least 1 screenshot (1280×800 PNG)
- [ ] Privacy policy is live at a public URL
- [ ] Chrome Web Store developer account created + $5 paid
- [ ] Hebrew store listing text ready to paste
- [ ] English store listing text ready to paste (optional but recommended)
- [ ] Justifications for each permission written out
- [ ] Data use certifications checked

Once all 8 items are checked → submit. Good luck!
