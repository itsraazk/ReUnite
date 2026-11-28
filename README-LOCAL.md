# ReUnite — Local Testing v1.1

This version avoids `better-sqlite3`, so it does **not** require Visual Studio C++ Build Tools and is suitable for Node.js 24.

## Run on Windows

Open PowerShell in the ReUnite folder:

```powershell
npm install
npm start
```

Then open:

`http://localhost:3000`

## Local database

Test data is stored on your computer in:

`data/reunite-db.json`

This is a local JSON database for development/testing. Do not use this storage design for production yet.

## Current backend

- Signup + password creation
- Login/session
- Local user storage
- Add pet
- Unique permanent QR ID
- Pet storage
- Lost/found API
- Public pet lookup by QR ID
- Logout

Actual QR generation/scanning and complete frontend API wiring are still the next development step.

## Test QR on a phone over the same Wi-Fi

1. Connect the PC and phone to the same Wi-Fi network.
2. Run `npm start` on the PC.
3. The terminal will print `Phone/Wi-Fi access: http://YOUR-PC-IP:3000`.
4. Open that address on the phone to confirm it loads.
5. Generate a **new QR** from the Pet Details page. The QR will now point to the PC's LAN IP instead of `localhost`.
6. Scan that QR with the phone camera.

If the phone cannot open the URL, allow Node.js through Windows Firewall on the **Private networks** option, then restart `npm start`.

Note: the phone and PC must remain on the same Wi-Fi for this local test. This is only for development; public QR codes will later use the ReUnite HTTPS domain.


## ReUnite AI Assistant (V17)
The site now includes a floating AI assistant for dog-care guidance, lost-dog help, and ReUnite app help. The browser talks only to `/api/ai-chat`; the API key stays on the server.

### Enable live AI locally
PowerShell:
```powershell
$env:OPENAI_API_KEY="YOUR_API_KEY"
$env:OPENAI_MODEL="gpt-6-luna"
npm start
```
Do not put the API key inside `app.js` or any HTML file. AI API usage can incur charges, so set spending/rate limits in your API account before public launch.

Without `OPENAI_API_KEY`, the chatbot UI still opens but shows a setup message instead of making an AI request.

## ReUnite AI Knowledge Base (V18)
- `dog-knowledge.json` contains curated general dog-care topics and emergency red-flag guidance.
- `reunite-help.json` contains ReUnite-specific help for pets, QR, scanner, Lost/Found, chat, accounts, local data, and phone/Wi-Fi testing.
- The server checks this local knowledge first, so common questions do not require an AI API call.
- If no local match is found and `OPENAI_API_KEY` is configured, the server can use the live AI fallback.
- Medical information is educational only; emergency symptoms should be referred to a qualified veterinarian.


## Guided AI Assistant (V19)
- The ReUnite AI Assistant now uses an option-first flow instead of relying on users to know the right keywords.
- Main categories: Dog Health, Lost / Found Dog, ReUnite App Help, and General Help.
- Each category opens focused topic buttons and then returns a response from the local knowledge base first.
- Emergency health topics are clearly highlighted.
- `Other` / custom question remains available for topics not listed.
- This guided UI works without an OpenAI API key for topics covered by the local knowledge files.


## V20: Pet Photos + Admin Dashboard
- Pet photos are resized in the browser and stored as files in `uploads/`; each pet stores only `photo_url` in `data/reunite-db.json`.
- Supported photo formats: JPG, PNG, WebP. Server accepts a saved image up to 2 MB after browser resizing.
- Admin dashboard: `admin.html`. Set `REUNITE_ADMIN_EMAIL` to the email of the account that should have admin access.
- Windows PowerShell for the current terminal session: `$env:REUNITE_ADMIN_EMAIL="your-email@example.com"` then `npm start`.
- Windows CMD: `set REUNITE_ADMIN_EMAIL=your-email@example.com` then `npm start`.
- The admin dashboard shows user/pet/lost/safe/message counts, user list, pet list, and local status controls.
- For public hosting, move pet photos to proper object storage and replace the JSON database with PostgreSQL before launch.


## V21 Referral / Suggested By
- After login (and after completing signup), users see an optional **Suggested by** step.
- The user can enter the name of the person who suggested ReUnite or choose **Skip for now**.
- The value is stored on the user record as `suggested_by`.
- The main admin can see the value in the Admin Dashboard Users table.
- Existing users without this field continue to work; the app treats it as blank.


## Pet types and Community Pets
- The Add Pet form supports Dog, Cat, Horse, Cow, Bird, Fish, Turtle, Goat, and Others (with a custom type field).
- The Pet section includes Community Pets for neighbourhood animals without a known owner. Any logged-in user can register a local name, animal type, usual public landmark, and optional photo.
- Community Pet QR profiles show only the local name, pet type, usual location, and optional photo. They do not expose the registering user's contact information and do not support Lost/Found status or chat.
- Set `REUNITE_PUBLIC_URL` to the full public base URL (for example `https://your-app.example.com`) when you want generated QR codes to point at a specific deployed host. In production, HTTPS is used by default.


Cinematic landing-page styling has been added to the Welcome page using the existing ReUnite video background. Signup, login, password and suggested-by flows are retained.


## State-wise Pet IDs (updated)
- Signup now requires an Indian state or union territory.
- New owned and community pet QR identities use `REUNITE-<STATE_CODE>-<6 digits>` (for example `REUNITE-UP-583104`).
- IDs are generated on the server and checked against existing pet QR IDs before saving. Existing pet IDs are preserved; the new format applies to newly created pets.


## Global Social Community

The Global page is a public community feed: visitors can browse posts without signing in. A registered, signed-in member is required to create posts, like, comment, follow members, edit their own posts/comments, report content, or block another member.

Included social features:
- Public member directory and member profile pages with public bio, pet gallery, and recent posts.
- Text/photo posts with categories; edit/delete controls for the post owner.
- Like/unlike and comment add/edit/delete.
- Follow/unfollow and a following-feed view.
- Notifications for new followers, post likes, and post comments.
- Report posts, comments, or members; administrator-only report review and content removal through the Admin page.
- Block/unblock members; blocked members' posts are hidden from each other's feed.
- Community bio editing (up to 300 characters).

Start locally with `npm install` followed by `npm start`, then open `http://localhost:3000/global.html`. Admin moderation APIs require an administrator account (`role: "admin"`) or the email configured in `REUNITE_ADMIN_EMAIL`.


## ReUnite 1.2 upgrade notes

This upgrade adds: city capture at signup and city display on scanned pet profiles; forgot/change password routes; pet year-acquired tracking; medical and temperament fields; multiple pet photos; QR SVG download and configurable-size print page; QR replacement; lost-pet filters; adoption listings and private adoption enquiries; multi-photo pet galleries; nearby vet/shelter map search; community vaccination / anti-rabies / sterilization logs; Hindi helper guidance on public QR cards; and removal of the Reports item from the main navigation.

### Start locally

1. Install Node.js 18 or newer.
2. Open a terminal in this project folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

### Important setup before public deployment

- Password reset is secure and single-use, but this local build prints the reset link to the server terminal. Connect an email delivery provider and send the link by email before deploying publicly. Do not expose server logs.
- Set a strong random `SESSION_SECRET` and update the session configuration before production. The existing local session secret is for development only. Use HTTPS and secure cookies in production.
- For local Wi-Fi testing, generated pet QR codes use the server LAN address printed in the terminal (not `localhost`). Open that address from the second device first. Allow Node.js / TCP port 3000 through the computer firewall if the phone cannot connect. For public deployment, set `REUNITE_PUBLIC_URL` to the public HTTPS origin before generating/printing QR codes.
- The emergency button opens a nearby veterinary-clinic map search. It is not an emergency dispatch service; call local veterinary services directly.
- Public QR cards intentionally show medical and temperament details requested by the owner-facing workflow. Owners should avoid entering highly sensitive information.
- The Hindi toggle currently translates the safety guidance text; the full public-card interface is not yet translated into every regional language.

Existing user records created before this update may not have a city or year-acquired value. Edit the account to add a city; edit each pet to add its year acquired and medical details.

### Recent local updates

- Owned-pet registration accepts up to 9 photos; photos are resized in the browser and saved as a gallery.
- Pet profiles show all saved photos. Each uploaded image is validated by the server.
- Pet details now store and display **Year Acquired** instead of date of birth.
- Login, create-password, reset-password, and change-password forms have a show/hide password control.
- The printable lost-pet flyer page and its pet-details link have been removed.
- Newly generated QR codes point to the server's LAN IP during local Wi-Fi use. Old QR printouts that encode `localhost` must be downloaded/printed again.


## ReUnite 1.3 fixes

- **Add Pet photos:** `add-pet.html` was missing its `app.js` script, so photo upload and "Other" never worked. Fixed. Photos now appear as tiles with a **+** tile for adding more (up to 9), × to remove, first photo = Main. Edit Pet can keep/remove saved photos and add new ones.
- **Signup / Edit account:** choose State first; the **City / District** list next to it shows that state's districts (`india-districts.json`). If a district is missing, pick "Other — not listed" and type it.
- **Pet types:** Dog, Cat, Horse, Goat, Cow, Other (Other shows a box to type the animal name).
- **QR on Wi-Fi:** the QR address was missing the port (`:3000`), so phones could not connect. QR codes now encode `http://<PC-Wi-Fi-IP>:3000/p/<PET-ID>`; the Pet Details page shows the exact address. **Re-open the pet page and re-download/print any older QR.** If the wrong IP is picked, set `REUNITE_LAN_IP=192.168.x.x` in a `.env` file. Windows: allow Node.js on *Private networks* in the firewall.
- **Security:** `data/reunite-db.json`, `server.js`, `.env` etc. are no longer downloadable by other devices; session secret is generated per install; a damaged database is backed up instead of overwritten.
- Scanner: validates that a scanned code is a ReUnite QR and can read QR from live video with jsQR. Optional offline copy: put `jsQR.min.js` in a `vendor/` folder.
