# ITSKHAY Backlink Agent (free starter)

A free GitHub Pages dashboard + Google Apps Script backend for the Google Sheet you provided.

## What it does
- Reads the existing spreadsheet and preserves its current columns.
- Skips prospect domains already recorded in the sheet.
- Filters/ranks prospects using available DA, PA, Spam Score (SS), traffic and conversion-fit fields.
- Lets you choose a requested opportunity count (5, 10, 20, 30 or 50) and select backlink categories such as directories, guest posts, local citations, resource pages, business profiles, communities, competitor research and broken-link building. The current free discovery version creates category-specific search links, not a guaranteed list of that many verified sites.\n- Lets you add prospects manually.
- Audits saved **Backlink URL** pages for a link to your **Target URL**.
- Keeps rows marked `Live` in the main sheet; moves non-live/broken rows into a `Broken Links` tab.
- Uses a password login checked by Apps Script. Password hash and settings live in Script Properties, not in the website source.

## Important limits
- This is a free workflow, but free SEO metrics are not universally available. DA/PA are Moz metrics and SS is a Moz metric; traffic estimates from third-party tools may be unavailable. The agent uses values already in your sheet and does not fabricate them.
- Search discovery is provided as links to free search queries. Fully automated Google search scraping is unreliable and can violate provider terms. Add verified prospects manually or import them into the sheet.
- An audit can only verify a backlink if you provide the actual page containing the backlink in `Backlink URL` and the URL that should be linked in `Target URL`. The existing `Homepage URL (register/submit here)` column is a directory/registration URL, not necessarily a backlink placement page.
- HTTP blocks, JavaScript-rendered pages, login-gated pages, or bot protection can cause `Could not verify` results. Those are sent to Broken Links for manual review by this starter; consider changing the status to `Review` if you prefer not to classify unverifiable links as broken.
- Do not store directory account passwords in the sheet. Use password managers; the agent does not log into third-party directories or submit listings automatically.

## 1. Connect your Google Sheet
Spreadsheet ID already configured in `Code.gs`:
`1nPYEHaBUGVpbMyGM2smVCSf4Mje6UM5J9lnadGQ35Qw`

Open the sheet and ensure your account has edit access. The first worksheet is used as the main backlink sheet. Existing headers are retained; missing operational columns are appended:
- `Backlink URL`
- `Target URL`
- `Traffic`
- `Conversion Fit`
- `Last Audited`
- `Audit Note`

## 2. Install the Apps Script backend (free)
1. Open https://script.google.com/ and create a new project.
2. Replace the contents of `Code.gs` with this repository's `Code.gs`.
3. Run `setup()` once from the Apps Script editor and grant the requested spreadsheet permissions.
4. In **Project Settings → Script Properties**, add:
   - `ADMIN_USERNAME` = your chosen login ID (for example `itskhay-admin`)
   - `ADMIN_PASSWORD_HASH` = SHA-256 hash of your chosen password, lowercase hex
   - `APP_TOKEN_SECRET` = a long random secret (at least 32 characters)
5. Generate a password hash locally with Python:
   ```bash
   python -c "import hashlib,getpass; p=getpass.getpass('Choose admin password: '); print(hashlib.sha256(p.encode()).hexdigest())"
   ```
   Do not send your password to anyone or commit it to GitHub.
6. Deploy → New deployment → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (the app itself checks the login)
   - Deploy and copy the `/exec` URL.
7. In `app.js`, replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the deployed URL. Redeploy the GitHub Pages site after committing.

**Security note:** Apps Script web apps exposed to “Anyone” are publicly reachable, so keep the token secret strong, do not put secrets in the frontend, and do not commit Script Properties. For a higher-security setup, use Google sign-in / OAuth and a server with proper session controls. Never use your Google account password as the app password.

## 3. Host the dashboard on GitHub Pages
1. Create a **private** or public GitHub repository (the frontend code contains no secrets; private repo is fine).
2. Upload `index.html`, `styles.css`, and `app.js` to the repository root.
3. GitHub → Settings → Pages → Deploy from branch → `main` / root.
4. Open the published Pages URL.

## 4. Use it
- Log in with the username and password you configured in Script Properties.
- Enter a niche and target URL, then use the free search links to discover relevant prospects.
- Existing domains are skipped when you add prospects.
- Fill `Backlink URL` with the page where your link is published and `Target URL` with the URL it should point to.
- Click **Run backlink audit**. Rows with a confirmed link stay `Live`; pages where the link is missing or cannot be verified are moved to `Broken Links` for review.
- The backend will create `Broken Links` if it does not exist.

## Free hosting / cost
GitHub Pages and Google Apps Script are free within their usage limits. No paid APIs are used. Apps Script quotas and external site rate limits apply.
