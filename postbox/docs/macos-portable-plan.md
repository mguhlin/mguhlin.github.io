# Portable macOS release plan

Saved November 1, 2026 at Miguel Guhlin's request.

The website announcement targets **November 8, 2026**, one week after this note. This is a planned release, not an available download. No build, scheduled task, or automatic future publication has been started by saving these notes.

## Agreed first release

- Separate Apple Silicon (ARM64, M-series) and Intel (x86-64) downloads.
- A portable folder with Python included and a double-click `Start Postbox.command` launcher.
- Retain the current localhost/browser interface, purple SplatWorks theme, About Developer page, coffee link, and green Next/red Delete controls.
- Keep EML, MSG, MBOX/MBX, PST import, previews, search, grouping, selection, deletion, and export behavior consistent with Windows/Linux.
- Preserve the read-only original PST guard. PST import must work without Outlook or an additional Python installation.
- A signed/notarized `.app` or `.dmg` is a later packaging option, not part of the initial portable scope.

## Compatibility findings

Standalone Python distributions exist for `aarch64-apple-darwin` and `x86_64-apple-darwin`. The existing `libpff-python` 20260926 release has CPython 3.13 wheels for macOS ARM64 and x86-64. Select matching architecture/ABI/runtime versions and verify their published SHA-256 hashes before bundling.

The PST reader currently selects only `vendor/windows` or `vendor/linux`; add explicit Darwin/architecture selection. Extend `build_portable.py` beyond its two existing targets, preserve executable permissions, retain runtime/native-library licenses and corresponding sources, and provide launch instructions. Determine the minimum supported macOS version from the complete chosen runtime and native reader, then confirm it in testing.

References:

- [Standalone Python distributions](https://gregoryszorc.com/docs/python-build-standalone/main/running.html)
- [libpff-python release files](https://pypi.org/project/libpff-python/)
- [Apple signing and notarization documentation](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

## Work remaining

1. Fetch and verify matching Apple Silicon and Intel Python distributions and PST reader wheels.
2. Extend native-reader platform selection and the portable builder, including a relative-path `.command` launcher that opens the user's browser.
3. Add macOS packaged-runtime jobs to `.github/workflows/postbox-checks.yml`. Test each architecture on an appropriate runner; do not assume a single runner proves both.
4. Run the existing Python and JavaScript checks with the bundled runtime. Test real public PST/MSG samples, attachment integrity, and EML/MBOX round-trips.
5. Test on a real Mac: downloaded archive extraction, launcher executable permissions and macOS security prompts, browser startup, shutdown, preview formats, folder permissions, original-file deletion, and exports. Use Chrome/Edge for original-file access; Safari retains the existing session/ZIP fallback.
6. Package both downloads, produce checksums, update README and website links with accurate requirements, and verify public downloads after Pages deployment.
7. Replace the coming-soon notice when the release is actually available. If the target changes, update its explicit date rather than leaving an expired announcement.

## Effort estimate discussed

- About **1–2 hours** for portable packaging, download-page changes, and automated macOS checks, subject to compatibility findings and runner availability.
- Another **30–60 minutes** of hands-on real-Mac testing.
- A polished signed/notarized `.app` or `.dmg` was estimated at **another day or two**, assuming access to Apple Developer credentials; it remains outside the initial portable release.

The estimate is planning guidance, not completed work or a background job. Before distribution, determine what macOS security prompts remain for the unsigned portable package and document the normal launch process without requiring users to disable system-wide protections.
