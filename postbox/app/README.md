# Postbox — portable offline email viewer

Ready-to-run packages include Python. Extract the entire package, then launch:

- **Windows 10+ (Intel/AMD 64-bit):** `dist/Postbox-windows-x64.zip` → double-click `Start Postbox.bat`.
- **Linux (Intel/AMD 64-bit, glibc 2.17+):** `dist/Postbox-linux-x64.tar.gz` → run `./"Start Postbox.sh"`. If needed, first run `chmod +x "Start Postbox.sh"`. A USB drive must permit executable files; otherwise extract onto your computer.

Keep all extracted files together. Both packages work offline with a modern browser; no Python installation, pip packages, or accounts needed. ARM devices and Alpine/musl Linux need a different runtime.

The source version below requires Python 3.9+.

Run `python3 app.py` on Linux/macOS or `py app.py` on Windows. Your browser opens automatically. Keep the terminal open while using the viewer; press Ctrl+C to stop it. If the browser does not open, visit the local address printed in the terminal.

Open multiple `.eml` exports, select a folder (including subfolders), or drop files into the window. Search subject, sender, recipients, plain text, HTML body text, and attachment names. Import `.mbox` / `.mbx` archives alongside `.eml` messages. Select a message to read it. HTML opens automatically when available; Plain text is always available as a fallback. Save individual attachments or download the original message.

The app listens only on your computer's loopback address. Imported messages are held in memory. Original files change only when you explicitly select deletion from original files and confirm. MBOX imports briefly use a temporary local file, which is deleted immediately after parsing. Nothing is uploaded to an external service. Reloading the page resets the visible list; use Clear session or stop the app to discard imported data from server memory. Downloads are saved by your browser and remain after clearing a session.

HTML scripts, links, remote images, and external styles are blocked. CID inline images are offered as downloadable attachments rather than embedded in HTML. Encrypted messages are not decrypted, signatures are not verified, and Outlook `.msg` messages and `.pst` archives can now be imported directly. OST/OLM and other unsupported formats must first be exported to EML/MBOX. Very large archives consume RAM; PST files are limited to 2 GB and other files to 100 MB. Attached emails remain downloadable as original message files.

To choose a port: `python3 app.py --port 8767`. To launch without opening a browser: add `--no-open`.


## Rebuilding portable packages

Run `python3 build_portable.py --linux-runtime /path/to/python-linux.tar.gz --windows-runtime /path/to/python-windows.zip` using Python 3.12+.

The included packages use [Astral python-build-standalone](https://github.com/astral-sh/python-build-standalone/releases/tag/20261026) CPython 3.13.18 for Linux and the [official Python 3.13.9 Windows embeddable runtime](https://www.python.org/ftp/python/3.13.9/). Runtime licenses are retained. Linux was checked using the bundled interpreter; Windows and Linux packaged-runtime checks are configured in [GitHub Actions](https://github.com/mguhlin/mguhlin.github.io/actions/workflows/postbox-checks.yml).

## Search filters

Combine terms to require all of them to match. Searches ignore letter case and match substrings.

- `from:ada to:grace` — sender and recipient.
- `cc:team subject:"meeting notes"` — Cc and subject phrase.
- `body:"budget approved"` — message content, including HTML-only emails (`content:` also works).
- `has:attachment` or `has:noattachment` — messages with or without attachments.
- `attachment:report.pdf` — attachment filename.
- `from:ada has:attachment budget` — combine filters with a word anywhere in searchable fields.

Quotes keep phrases together. Plain words search all supported fields. Searches do not read inside attached files. MBOX archives have the same 100 MB per-file limit as EML files; split larger archives before importing. Some exports use a bare filename: rename these to `.mbox` before opening.

## Attachment previews and credits

Created by **Miguel Guhlin** · [SplatWorks.org](https://splatworks.org) · [Buy Me a Coffee](https://buymeacoffee.com/drawsplat).

The original hero artwork is included locally; no online assets are needed.

Use Preview beside an attachment to view:

- PDF using your browser's PDF viewer.
- JPG/JPEG, PNG, WebP, GIF, BMP, AVIF, and ICO images.
- WebM, MP4, OGV, MOV video and MP3, WAV, OGG, M4A, FLAC audio, when your browser supports their codecs.
- DOCX and supported Word 97–2003 DOC documents as text, without original page layout, embedded objects, or macros. Older, encrypted, and unsupported Word variants can be downloaded for another application.
- Text, CSV, Markdown, JSON, XML, HTML source, and common code files as inert text. Text previews are limited to 5 MB; DOCX document XML to 20 MB.

Every attachment remains downloadable. Attachment text is not indexed by email search. The `.doc` reader uses the bundled olefile library; its license is included in OLEFILE-LICENSE.txt.

## Organizing and selecting messages

The list groups messages by year and month using the date written in each email. Choose Year or No grouping if preferred. Missing or invalid dates go under Undated. Click a year or month heading to collapse it; use its checkbox to select that group. Search and From date / Through date filters narrow the list. Date endpoints are inclusive; undated messages are excluded when a date filter is active.

Select results selects all messages matching the current filters, even inside collapsed groups. Check individual messages or Shift-click another checkbox to select a contiguous range in the current date-sorted results. Selection persists across filter changes; the toolbar counts the entire selection. Clear selection clears both email and attachment selections.

## Exporting attachments to a folder

For a date range, set From date and Through date, choose Select results, then Export all attachments of selected emails. You can also check individual attachments in one or more emails and choose Export selected attachments. Select their attachments checks every attachment from the selected emails so you can adjust that selection.

In Chrome or Edge, choose a destination folder. Files are organized as `year/month/date_subject_message-id/attachment-name`. Existing exported files are preserved by adding numbered suffixes. Other browsers download a ZIP archive to extract into your desired folder. Exports copy attachments; they do not remove them from emails.

## Deleting emails and attachments

Use **Open managed folder** in a current Chrome or Edge browser to grant access to the local folder containing your `.eml` / `.mbox` files. Subfolders are included. **Open email files** also uses managed file access when supported; deleting individually opened `.eml` files may ask you to select their containing folder. The ordinary import-folder button and drag-and-drop import copies without original-file access. Other browsers support session-only deletion and ZIP export.

While reading a message, use the prominent red **Delete this email** button beside the viewing controls to delete only that message, regardless of other checkbox selections. The confirmation names its subject and uses the Delete from mode selected in the toolbar. Check multiple emails and choose Delete selected emails for a bulk deletion. For individual attachments, check them across one or more messages and choose Delete selected attachments. The Delete from selector offers:

- **Original files on disk:** permanently delete selected `.eml` files, remove selected messages from MBOX archives, or rewrite source emails/archives to remove selected embedded attachments. A confirmation explains the change before any disk write. Removing the last MBOX message leaves an empty archive. Unselected messages and attachments are retained. Files changed by another program since import are refused; reimport them before editing.
- **This session only:** change the imported in-memory copies while preserving files on disk. After a session edit, reimport a source through the managed-folder option before editing its original.

Deletion cannot be undone in Postbox. Attachment deletion removes the MIME attachment inside an email; it does not delete copies you previously exported elsewhere. Multi-file changes are processed one source at a time. If an I/O error interrupts a batch, the status reports how many source files completed. A failed file write should be retried only after checking/reimporting the source. Reloading or clearing the session does not undo disk changes.

## Checks

Run `python3 -m unittest -v test_viewer.py test_previews.py test_organizer.py` and `node test_search.cjs`. The organizer tests cover non-destructive planning, MIME attachment removal, MBOX rebuilding, modified-source rejection, and ZIP exports. Native file access was exercised with simulated browser handles in DOM tests; packaged-runtime results are available in GitHub Actions.

## Reader deletion and automatic advance

Delete this email removes only the displayed email and its embedded attachments. After success, Postbox opens the next remaining email in the current filtered, date-sorted list. At the end it opens the nearest previous email; with no matches left it clears the reader. Failed or cancelled deletions keep the current email open. Other checkbox selections remain intact.

If an original was imported as a copy, deletion now offers to reconnect its original folder instead of stopping with a distant status message. Choose the containing folder; Postbox checks filenames and SHA-256 content before modifying anything. Ambiguous or changed files are refused. Success and error messages appear immediately under the reader controls. Original-file edits still require Chrome/Edge local file access; other browsers can explicitly use This session only. An older running server that lacks the delete endpoint shows a restart instruction.

## Outlook PST and MSG imports

Open Outlook `.pst` archives and `.msg` saved messages directly with the standard file/folder controls. No Outlook installation is required. PST support uses the included CPython 3.13 `libpff-python` reader for the package's operating system; pure-Python source runs need a compatible installed reader. The package retains library licenses and the corresponding source archive in `licenses/`.

PST archives are read-only. Deletion from original PST files is blocked before any disk modification. Use **This session only** to remove imported messages/attachments, or select emails and choose **Export emails as EML ZIP** / **Export emails as MBOX**. Both exports preserve extracted attachments. Reimport the exported EML/MBOX to edit its originals. MSG originals can be deleted as whole files, but removing an attachment cannot rewrite MSG in place; use a session copy or an EML export instead. Save email as .eml creates a converted message rather than an original Outlook binary.

PST imports stream up to 2 GB through a temporary local file, deleted after parsing. Other files remain limited to 100 MB. Extracted messages and attachments stay in RAM; large archives can still consume substantial memory. Mail folders are recorded in message details. Contacts, distribution lists, tasks, and calendar objects are excluded. Embedded/linked, damaged, or unsupported attachment variants may stop an import with a visible error rather than silently discard attachment data. RTF-only bodies without a plain-text/HTML representation, encrypted mail, OST, and OLM may need conversion in Outlook first.

Validation used public examples from [pst-extractor](https://github.com/epfromer/pst-extractor) and [msg-extractor](https://github.com/TeamMsgExtractor/msg-extractor). The PST sample yielded 71 emails with attachment data. Native reader wheels and package contents are verified. See GitHub Actions for Windows and Linux packaged-runtime checks; file-picker interactions are tested with simulated handles.

## About Developer and theme

The top-right **About Developer** link opens an offline page in a separate tab, preserving the current viewer session. It credits Miguel Guhlin and includes SplatWorks, his blog, GitHub, and the Buy Me a Coffee link. The interface uses SplatWorks purple (`#7c3aed` / `#a855f7`), with green Next and red Delete actions retained.
