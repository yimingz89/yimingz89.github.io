# Yiming's Math Notes

A topic-organized collection of math notes published at
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
- `styles.css` — all site styling
