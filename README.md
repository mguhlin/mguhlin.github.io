# Creations by Miguel Guhlin

The root project directory at **https://mguhlin.github.io/**. A static, responsive
index of active published projects, with local search, category filters, alphabetical
sorting, original project artwork, and a generated editorial photograph.

## Edit and preview

1. Update `data/projects.json` (one card per non-archived published repository).
2. Add optimized WebP artwork to `assets/images/`.
3. Run `python3 scripts/build.py` to regenerate the committed `index.html`.
4. Run `python3 -m http.server 4180 --bind 127.0.0.1`.
5. Run `npm ci && npm test` for browser checks; `python3 scripts/check-links.py`
   checks launch destinations. `python3 scripts/check-inventory.py` compares the
   curated list with GitHub's public repository inventory without changing files.

Search/filter state is shareable in the URL. Cards and launch links work without
JavaScript. There are no runtime dependencies, third-party fonts, analytics, APIs,
cookies, or service workers. The generated page is deployed by GitHub Pages from
`main` at `/`; `.nojekyll` keeps it a plain static site.

See [inventory notes](docs/inventory.md) and [image provenance](docs/images.md).
Licenses for linked projects remain with those projects; this index does not
relicense their content or artwork.

## Postbox

[Download Postbox for Windows or Linux](https://mguhlin.github.io/postbox/) — Miguel Guhlin’s portable offline email viewer for EML and MBOX exports, with search, attachment previews, and bulk organization. [README and source](https://github.com/mguhlin/postbox). Postbox is maintained and published from its own repository; its public URL and download paths are unchanged.
