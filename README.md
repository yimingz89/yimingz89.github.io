# Yiming's Mathematics Notes

A collection of concise mathematics notes published at
[https://yimingz89.github.io](https://yimingz89.github.io).

The site uses GitHub Pages and Jekyll. Notes are Markdown documents with LaTeX
math rendered by MathJax.

## Add a note

1. Create a Markdown file in `_notes/<topic>/<note-name>.md`.
2. Add this front matter:

   ```yaml
   ---
   title: "Your note title"
   topic: "Your topic"
   summary: "One sentence describing the note."
   order: 1
   ---
   ```

3. Write prose with Markdown and formulas with LaTeX delimiters:

   ```markdown
   Inline math looks like $e^{i\pi}+1=0$.

   $$
   \sum_{k=1}^{n} k = \frac{n(n+1)}{2}.
   $$
   ```

4. Commit the file to `main`. GitHub Pages will rebuild the site and add the
   note to the correct sidebar group automatically.

MathJax supports LaTeX math mode, not complete `.tex` documents. Use Markdown
for headings, paragraphs, and lists.

## Site structure

- `_notes/` — note source files
- `_layouts/` — page templates
- `_includes/sidebar.html` — generated topic navigation
- `_config.yml` — Jekyll collection and site settings
- `.github/workflows/jekyll.yml` — GitHub Pages build and deployment
- `styles.css` — all site styling
- `flashcards/` — standalone Hanzi Study app and its character dataset
- `reader/` — browser-only Chinese Reader and bundled CC-CEDICT dictionary

## Chinese Reader

[Chinese Reader](https://yimingz89.github.io/reader/) is a separate study tool linked from the site sidebar. Paste simplified Chinese (up to 30,000 characters), then start reading. Tap a word to reveal just its pinyin; choose **Show meaning** for English dictionary definitions. Select a phrase and use **Look up selection** for exact phrase entries or an explicitly labeled word-by-word breakdown. There is no automatic sentence translation or contextual AI.

**Pin pinyin** keeps the pronunciation above that occurrence. **Hide hints** hides all hints without deleting pins. The pinned list lets you revisit or remove them. Ambiguous dictionary readings can be selected manually, and individual-character lookup is available. The layout adapts to phones, where lookup opens in a bottom sheet.

The last started reading, pinned hints, and text-size setting are stored in this browser's local storage. Normal reloads and hard refreshes preserve them; clearing site data, private browsing, or browser storage eviction can remove them. They do **not** sync across browsers/devices. Starting a different text clears that reading's pins. **Forget saved reading** removes only the reader's saved data; the flashcard app and its Firebase sync are independent and unchanged.

No login, Firebase, AI model, paid API, analytics, external fonts, or secret API key is used by the reader. Pasted text is rendered as plain text and is never uploaded. The browser downloads a bundled dictionary (~10 MB before compression); dictionary lookups happen locally after loading. Loading/reloading the page still requires a connection unless the browser happens to have its assets cached.

To preview from the repository root, run `python3 -m http.server 4174 --bind 127.0.0.1` and open `http://127.0.0.1:4174/reader/`. No build or npm install is needed to use the app. For development tests, use Node 24.15+ (24.x), run `npm ci` inside `tests/`, then `npm test`. This runs reader and flashcard regressions without contacting Firebase.

The dictionary is [CC-CEDICT / MDBG](https://www.mdbg.net/chinese/dictionary?page=cc-cedict), distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Attribution and conversion details are in `reader/data/NOTICE.txt` and the app's **Dictionary & credits** section. To update it, download the official CC-CEDICT v1 gzip and run `node reader/build-dictionary.mjs /path/to/cedict.txt.gz`; update the release date in the notice and run tests. The reader keeps dictionary alternatives but does not infer contextual pronunciations, tone sandhi, or translations; segmentation and name/slang coverage are imperfect.

## Hanzi flashcards

[Hanzi Study](https://yimingz89.github.io/flashcards/) is linked from the site sidebar, including on mobile. It is a standalone static app: Jekyll copies `flashcards/` into the Pages build without changing the existing notes or requiring a backend.

The app supports Core 2,000 and HSK supplement cards, answer reveal, card-number jumps, Keep fresh and Learning stars, category filters, and starred-only shuffle. Assets and the deck use relative paths so the app works under `/flashcards/`.

Signed-out progress stays in the browser. **Sign in with Google** enables private Firestore sync of Keep fresh, Learning, learned, and review marks. Use the same authorized account on every device. Deck filters, shuffle order, and current card remain device-local. The header reports connection and save status; wait for **Synced to cloud** before switching devices.

Changes are merged per card and field; if two devices edit the same field, the last write received by Firestore wins. Changes made offline during a connected session stay queued in browser storage and upload on reconnection. A fresh page load must connect before cloud editing is enabled. Sign-out returns to local-only editing; export any such edits before signing back in, since existing cloud state takes precedence.

### One-time Firebase setup

1. Register a Firebase web app and put its public client configuration in `flashcards/firebase-config.js`. Never include service-account credentials.
2. Enable Google in Authentication and add the deployed hostname to Authorized domains. Add localhost separately only if you need local sign-in.
3. Create a Standard Firestore database in production mode. Copy `firebase/firestore.rules.example`, replace `OWNER_GOOGLE_EMAIL` with the one permitted Google account email, and publish in Firestore → Rules. The rules require that verified Google identity and matching user ID; all other access is denied. Keep the customized rules private if you do not want your email in the public repository.
4. Open the hosted app and sign in. An empty cloud is seeded from this browser on first connection. If cloud data already exists, it replaces the local display; a pre-sync browser backup is retained, with a **Merge pre-sync backup** button for explicit recovery.

The footer’s **Move or back up your progress** controls export a JSON backup or import it. Import is a confirmed merge: imported marks win for matching marked cards; other existing cards are kept. When signed in, imported marks also sync to Firestore. Local-app users should export from the exact address previously used (for example `http://127.0.0.1:4173/`, not `localhost`), then import into the hosted app after sign-in. Keep an exported backup before clearing browser storage, as unsynced offline changes depend on that storage.

To update the app, edit the static files in `flashcards/` and commit to `main`; the existing GitHub Pages workflow publishes them with the rest of the site. No npm build is needed. To preview only the app locally:

```sh
python3 -m http.server 4174 --bind 127.0.0.1
```

Open `http://127.0.0.1:4174/flashcards/`. Run dependency-free app and sync regression tests with `node --test tests/flashcards.test.cjs tests/sync-state.test.mjs tests/cloud-controller.test.mjs`. For database security and two-client listener tests, run `npm ci` followed by `npm run test:rules` inside `tests/`. These developer-only emulator tests require Java 21+ and never access the live database. Users need no installations to use the hosted app.

The supplied dataset is redistributed unchanged. Its metadata credits CC-CEDICT / MDBG (CC BY-SA 4.0), hanziDB / Jun Da, Unihan, wordfreq (Robyn Speer), and complete-hsk-vocabulary (drkameleon). The app’s **Data & credits** footer preserves attribution and links to the license and source dataset.
