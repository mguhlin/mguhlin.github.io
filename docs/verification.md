<a id="verification-september-29-2026"></a><a id="verification--september-29-2026"></a>

# Verification

- All 13 curated launch destinations returned HTTP 200.
- Public repository inventory matched all 13 entries; archived repositories excluded.
- Static build completed with unique repository IDs and existing image files.
- Browser suite: 17 passed across Chromium, Firefox, and iPhone-emulated WebKit;
  one desktop keyboard test intentionally skipped in the phone project.
- Verified search/category combinations, empty states, reset, reload persistence,
  alphabetical ordering, query handling, source/launch URLs, no-JavaScript access,
  and no external requests or page errors from the directory itself.
- Responsive checks at 320, 390, 768, and 1440 pixels passed in all three engines.
- Desktop and phone visuals reviewed; all images decoded successfully. All site
  imagery totals approximately 1.1 MB, with project cards lazy-loaded.
- `git diff --check` passed. npm dependency audit reported no vulnerabilities.

The link check verifies destination availability, not every feature of each
independent application. Phone tests emulate devices; they are not physical-device
tests. This directory does not change any of the indexed projects.
