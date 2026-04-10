# Privacy Policy — NetFree Inspector

**Last updated:** 2026-04-10

---

## English

### Summary (TL;DR)

**NetFree Inspector collects no personal data. Nothing ever leaves your browser. Everything is processed locally on your own computer. There are no analytics, no tracking, no user accounts, and no external servers involved in the extension's operation (aside from loading a single public logo image from netfree.link).**

---

### 1. What the extension does

NetFree Inspector is a developer tool that detects HTTP 418 responses in your browser's network traffic. The HTTP 418 status code is the signal used by the NetFree content filter ([https://netfree.link](https://netfree.link)) to indicate that a URL has been blocked. When the extension detects such a response, it records the URL, HTTP response details, and shows them to the user in the extension popup.

### 2. What data the extension accesses

To do its job, the extension requires the following Chrome permissions:

- **`webRequest`** — to observe HTTP responses in your browser.
- **`tabs`** — to associate blocked requests with the correct browser tab.
- **`storage`** — to temporarily hold block data between the background script and the popup.
- **`webNavigation`** — to detect page navigation and clear stale data.
- **`<all_urls>` host permission** — because blocks can happen on any website, the extension must be able to observe responses from all URLs.

### 3. What data the extension collects

**The extension does not collect any personal data.**

The following information is observed **locally in your browser** and used only to render the popup:

- URLs that returned HTTP 418 (blocked by NetFree)
- The resource type of blocked requests (document, script, image, xhr, etc.)
- The HTTP status code of each request
- The domain of the current tab (to display in the popup header)

**None of this information is transmitted anywhere.** It is stored only in the browser's transient session storage (`chrome.storage.session`), which Chrome clears automatically when the browser is closed.

### 4. What data the extension transmits

**The extension does not transmit any data to any server.**

The only outgoing network activity from the extension is:

1. **Loading the NetFree logo image** — the popup displays the NetFree logo, which is loaded from `https://netfree.link/img/logo/netfree_logo.svg`. This is a standard HTTP image request, identical to any other image load on the web, and contains no user data.

2. **Opening external links on user action** — when the user clicks "Open NetFree Request", a new browser tab is opened to `https://netfree.link/app/#/tickets/new?...` with the blocked URL as a query parameter. This happens only when the user explicitly clicks the button.

### 5. Data storage and retention

All data collected by the extension is stored only in `chrome.storage.session`, which is:
- **In-memory only** — nothing is written to disk
- **Automatically cleared** when the browser is closed
- **Not synced** across devices or accounts
- **Isolated** to the extension (not accessible by websites)

Block data for a given tab is also cleared automatically whenever you navigate to a new page in that tab.

Language preference (Hebrew or English) is stored in `chrome.storage.local`, which persists across browser restarts but is never transmitted.

### 6. Third parties

The extension does not use any third-party analytics, tracking, or advertising libraries. It has no dependencies on external services beyond:
- **Chrome Extension APIs** (provided by the browser)
- **NetFree's public logo** (loaded for visual display only)

### 7. Children's privacy

The extension does not knowingly collect any information from anyone, including children under 13.

### 8. Changes to this policy

If this privacy policy changes, the updated version will be published in the extension's GitHub repository. The "Last updated" date at the top of this document will reflect the most recent revision.

### 9. Contact

For questions about this policy or the extension, please open an issue on the GitHub repository:
**https://github.com/mfvirtualmail-bot/beit-midrash-finance**

---

## עברית

### תקציר

**NetFree Inspector לא אוסף שום מידע אישי. שום דבר לא יוצא מהדפדפן שלך. הכל מעובד מקומית במחשב שלך. אין אנליטיקס, אין מעקב, אין חשבונות משתמש, ואין שרתים חיצוניים המעורבים בפעולת ההרחבה (מלבד טעינת תמונת לוגו פומבית אחת מ-netfree.link).**

### 1. מה ההרחבה עושה

NetFree Inspector היא כלי פיתוח המזהה תגובות HTTP 418 בתעבורת הרשת של הדפדפן. קוד הסטטוס HTTP 418 הוא האות שנט פרי משתמש בו כדי לציין שכתובת נחסמה. כשההרחבה מזהה תגובה כזו, היא רושמת את הכתובת ומציגה אותה בפופאפ.

### 2. אילו הרשאות ההרחבה דורשת

- **`webRequest`** — כדי לצפות בתגובות HTTP בדפדפן
- **`tabs`** — כדי לשייך בקשות חסומות לטאב הנכון
- **`storage`** — כדי לשמור נתונים באופן זמני בין רכיבי ההרחבה
- **`webNavigation`** — כדי לזהות ניווט ולנקות נתונים ישנים
- **`<all_urls>`** — כי חסימות יכולות לקרות בכל אתר

### 3. איזה מידע ההרחבה אוספת

**ההרחבה לא אוספת שום מידע אישי.**

המידע הבא נצפה **מקומית בדפדפן שלך** בלבד:
- כתובות שהחזירו HTTP 418 (חסום על ידי נט פרי)
- סוג המשאב של הבקשות החסומות
- קוד הסטטוס HTTP
- הדומיין של הטאב הנוכחי

**שום מידע מזה לא נשלח לשום מקום.** המידע נשמר רק בזיכרון הזמני של הדפדפן ונמחק אוטומטית כשהדפדפן נסגר.

### 4. איזה מידע ההרחבה שולחת

**ההרחבה לא שולחת שום מידע לשום שרת.**

פעולות הרשת היחידות מההרחבה הן:
1. **טעינת הלוגו של נט פרי** מ-`https://netfree.link/img/logo/netfree_logo.svg` לצורכי תצוגה בלבד
2. **פתיחת קישורים חיצוניים בפעולת המשתמש** — כשהמשתמש לוחץ "פתח בקשה", נפתח טאב חדש לאתר נט פרי

### 5. שמירת נתונים

כל הנתונים שההרחבה שומרת נמצאים ב-`chrome.storage.session`:
- **בזיכרון בלבד** — שום דבר לא נכתב לדיסק
- **נמחק אוטומטית** עם סגירת הדפדפן
- **לא מסונכרן** בין מכשירים או חשבונות

### 6. צד שלישי

ההרחבה לא משתמשת בשום ספריות אנליטיקס, מעקב או פרסום של צד שלישי.

### 7. פרטיות ילדים

ההרחבה לא אוספת מידע מאף משתמש, כולל ילדים מתחת לגיל 13.

### 8. שינויים במדיניות

אם המדיניות הזו תשתנה, הגרסה המעודכנת תפורסם במאגר ה-GitHub של ההרחבה.

### 9. יצירת קשר

לשאלות, פתחו Issue במאגר ה-GitHub:
**https://github.com/mfvirtualmail-bot/beit-midrash-finance**
