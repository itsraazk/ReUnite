# ReUnite — Beginner-Friendly Code Guide

Welcome! This project is a small Express website for helping people register pets, create QR identities, report lost pets, keep community-animal profiles, save memorial stories, and use the guided ReUnite assistant.

## 1. Where should I look?

- `index.html` — public landing page (before login).
- `login.html`, `signup.html`, `password.html` — account creation and sign-in screens.
- `home.html` — dashboard after login.
- `pet.html` — My Pets, Community Pets, and Memory Pets hub.
- `add-pet.html`, `edit-pet.html`, `pet-details.html` — personal pet forms and details.
- `add-community-pet.html`, `community-pet-details.html` — community-animal profile screens.
- `add-memorial.html`, `memorial-details.html` — memorial story screens.
- `lost-pet.html`, `reports.html`, `public-pet.html`, `scanner.html` — lost/found reporting and QR scanning.
- `messages.html` — finder/owner conversations.
- `account.html`, `edit-user.html`, `suggested-by.html` — account and referral screens.
- `admin.html` — admin dashboard.
- `css/style.css` — shared design, colors, layout, and mobile breakpoints for all pages.
- `app.js` — browser-side JavaScript: loads data from the server, updates forms, draws lists, runs scanner/chat/assistant behavior.
- `server.js` — Express backend: login/session handling, database helpers, QR generation, pet/report/memorial/message APIs, and admin routes.
- `dog-knowledge.json` — pet-care knowledge used by the guided assistant.
- `reunite-help.json` — ReUnite app-help topics used by the guided assistant.
- `data/reunite-db.json` — local JSON database created/used by the app at runtime (may appear after first run).
- `assets/` — images used by the site, including the landing collage and background poster.
- `.env.example` — example environment variables; copy to `.env` for local-only configuration if needed.

## 2. How the pieces connect

1. The browser opens an HTML page.
2. The page loads `css/style.css` for its look and `app.js` for interactive behavior.
3. `app.js` calls API routes such as `/api/me` or `/api/pets/...`.
4. `server.js` checks the request, reads or updates the JSON database, and returns the result.
5. The browser updates the page using that result.

## 3. Common edits

### Change colors
Open `css/style.css`. Search for `#FCF0DA` (cream), `#F2C46A` (gold), `#AEAC78` (olive), or `#4C4541` (warm brown). Existing styles contain older theme layers, so later rules can override earlier ones. To safely make a new adjustment, add a clearly labelled rule near the end of the file.

### Change a page's words or layout
Edit that page's `.html` file. Shared styling should normally go in `css/style.css`, not as repeated inline styles on every page.

### Change what a button does
Search for its `data-*` attribute or form `action` in the HTML, then find the related `init...` function in `app.js`. If it needs saved data, look for the matching route in `server.js`.

### Change pet data or QR behavior
Start in `server.js` and search for `app.get(...)` or `app.post(...)` with the related `/api/...` path. The HTML form action and browser code must continue to use the same route.

### Change assistant knowledge
Edit `dog-knowledge.json` for pet-care information or `reunite-help.json` for help about ReUnite. Keep both files valid JSON (double quotes around keys and strings; no comments or trailing commas).

## 4. Run locally

1. Install Node.js if it is not installed.
2. Open this folder in VS Code.
3. Open the terminal in this folder.
4. Run `npm install` once.
5. Run `npm start`.
6. Open `http://localhost:3000` in your browser.

Stop the server with `Ctrl + C` in the terminal.

## 5. Important safety notes

- Make a backup before editing the database or server routes.
- Do not publish `.env`, real passwords, private user data, or the live database.
- For a public deployment, configure a strong session secret using environment variables and use HTTPS.
- Keep owner contact details private on public reports. Follow the current app rule: reports are browse-only; finder contact/chat belongs in the QR-scanning flow.
- This cleanup adds explanations and navigation comments. It is not a security audit and does not intentionally change feature behavior.

## 6. Editing style used in this cleanup

- Each HTML page starts with a short comment explaining its purpose.
- `app.js` has a guide and comments before the main page setup functions.
- `server.js` has a guide and comments before important route groups.
- `css/style.css` has a guide explaining the cascade and warm palette.
- `package.json` is formatted consistently.
- Original filenames and paths are retained so page links and server routes keep working.


## Pet page: three add options
The top of `pet.html` contains three equal-layout action cards: **Add Your Pet**, **Add Street Animals**, and **Memory Pet**. Their shared styles are in the `Pet hub: three equal-sized actions` section at the end of `css/style.css`. On desktop they appear in three columns, on medium screens two columns, and on narrow mobile screens one column. The cards link to the existing forms, so the pet registration workflows are preserved.
