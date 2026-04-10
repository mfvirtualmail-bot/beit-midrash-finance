# Screenshots Guide — NetFree Inspector

The Chrome Web Store requires **1 to 5 screenshots** of the extension.

## Required specs

| Property | Value |
|---|---|
| **Size** | 1280×800 px (recommended) or 640×400 px |
| **Format** | PNG or JPEG (24-bit, no alpha) |
| **Count** | 1 minimum, **5 maximum** |
| **Ratio** | 16:10 (strict — don't crop) |

> Tip: 1280×800 looks sharper on high-DPI screens. Use that unless you have a reason not to.

---

## The 5 screenshots to take

These are the 5 screenshots I recommend — in this order. Each one shows a different selling point.

### 1. Hero shot — popup with many blocks (the "wow" moment)
- **What to show:** NetFree Inspector popup open on a page with 5–15 blocked URLs, at least 2 different block types visible (e.g. "Blacklisted" + "Not Whitelisted").
- **How to capture it:**
  1. Open a problematic page — a site that loads Google Fonts, Google Analytics, Facebook pixel, etc. (e.g. any news site).
  2. Click the NetFree Inspector icon in the toolbar.
  3. Take a screenshot of the full popup + a bit of the page behind it.
- **Caption idea (he):** "ראה בבת אחת את כל החסימות בדף"
- **Caption idea (en):** "See every block on the page at a glance"

### 2. Block types close-up
- **What to show:** Popup zoomed in on the list, with 3–4 different badge colors visible:
  - 🔴 Red "חסום ברשימה השחורה" (Blacklisted)
  - 🟡 Amber "לא ברשימה הלבנה" (Not Whitelisted)
  - 🟣 Purple "הגדרות אישיות" (Personal Settings)
  - ⚪ Gray "חסום" (Unknown / third-party)
- **How to capture it:** Same as shot #1 but crop tighter on the list items. Or, if you don't have a real page with all 4 types, mock it up.
- **Caption idea (he):** "ארבעה סוגי חסימות, זיהוי אוטומטי"
- **Caption idea (en):** "Four block types, detected automatically"

### 3. "Open Request" action — the productivity win
- **What to show:** The popup with the cursor hovering on the "פתח בקשה" / "Open Request" button, or a split view showing the popup + the NetFree ticket page it generates.
- **How to capture it:**
  1. Open popup with at least 1 blocked URL.
  2. Hover the "Open Request" button.
  3. Screenshot. Optional: in a second pane, show the pre-filled ticket form on netfree.link.
- **Caption idea (he):** "פתיחת בקשת וייטליסט בלחיצה אחת"
- **Caption idea (en):** "Open a whitelist request with one click"

### 4. Red badge on the toolbar icon
- **What to show:** The Chrome toolbar with the NetFree Inspector icon showing a red badge like "7" or "12", indicating block count.
- **How to capture it:**
  1. Visit a site with many blocks.
  2. Zoom into the Chrome toolbar area with the icon + badge clearly visible.
  3. Screenshot — include some tab context (address bar + site name) so users understand what they're looking at.
- **Caption idea (he):** "Badge אדום מציג את מספר החסימות בדף"
- **Caption idea (en):** "Red badge shows how many blocks are on the page"

### 5. Bilingual — Hebrew + English toggle
- **What to show:** Either two popups side by side (Hebrew on the right, English on the left), or one popup mid-language-switch. Highlights the RTL Hebrew design.
- **How to capture it:**
  1. Take two screenshots of the same popup — once in Hebrew (default), once in English (click the language toggle).
  2. Paste both into an image editor, side by side.
- **Caption idea (he):** "ממשק דו-לשוני מלא — עברית + אנגלית"
- **Caption idea (en):** "Fully bilingual — Hebrew and English"

---

## Quick capture tips

### On Windows
- **Full screen:** `Win + PrintScreen` → saved to `Pictures/Screenshots/`
- **Rectangle selection:** `Win + Shift + S` → opens Snipping Tool
- For pixel-perfect sizing, use the free tool **ShareX** (https://getsharex.com/) — supports fixed-size region capture.

### Resize to exactly 1280×800
If your screenshot isn't the right size:
1. Open in **Paint** → Resize → set to 1280×800 (uncheck "Maintain aspect ratio" if needed).
2. Or use **Photopea** (https://www.photopea.com) — free in-browser Photoshop.
3. Or **GIMP** / **Paint.NET**.

### Polish suggestions
- **Drop a subtle shadow** behind the popup so it "floats" above the page background.
- **Blur sensitive content** in the page behind the popup (account names, private URLs).
- **Add a text overlay** with the caption in bold Hebrew/English so the value prop is clear even in the tiny store thumbnail.

---

## Where to upload

When you go to the Chrome Web Store Developer Dashboard → your extension → **Store listing** tab:

1. Scroll to the **Screenshots** section.
2. Click **Upload**.
3. Drag in your PNG files (order matters — first one is the hero).
4. You can reorder by dragging.
5. Click **Save draft**.

---

## If you want to skip this step

Chrome Web Store **requires at least 1 screenshot** to submit. If you want to publish fast, at minimum take **screenshot #1** (the hero shot) and upload just that one. You can always add more later — updating screenshots doesn't require re-review.
