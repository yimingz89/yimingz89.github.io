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

## Hanzi flashcards

[Hanzi Study](https://yimingz89.github.io/flashcards/) is linked from the site sidebar, including on mobile. It is a standalone static app: Jekyll copies `flashcards/` into the Pages build without changing the existing notes or requiring a backend.

The app supports Core 2,000 and HSK supplement cards, answer reveal, card-number jumps, Keep fresh and Learning stars, category filters, and starred-only shuffle. Assets and the deck use relative paths so the app works under `/flashcards/`.

Progress is stored only in the visitor’s browser, separately for each origin and device. The footer’s **Move or back up your progress** controls export a JSON backup and import it into another browser or the hosted app. Import is a confirmed merge: imported marks win for matching marked cards; other existing cards are kept. Nothing is uploaded or synchronized automatically. Local-app users should export from the exact address they previously used (for example `http://127.0.0.1:4173/`, not `localhost`).

To update the app, edit the static files in `flashcards/` and commit to `main`; the existing GitHub Pages workflow publishes them with the rest of the site. No npm build is needed. To preview only the app locally:

```sh
python3 -m http.server 4174 --bind 127.0.0.1
```

Open `http://127.0.0.1:4174/flashcards/`. Run the dependency-free regression tests with `node --test tests/flashcards.test.cjs`.

The supplied dataset is redistributed unchanged. Its metadata credits CC-CEDICT / MDBG (CC BY-SA 4.0), hanziDB / Jun Da, Unihan, wordfreq (Robyn Speer), and complete-hsk-vocabulary (drkameleon). The app’s **Data & credits** footer preserves attribution and links to the license and source dataset.
