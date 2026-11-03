# Postbox — portable offline email viewer

**[Download Postbox for Windows or Linux](https://mguhlin.github.io/postbox/)**

Created by **Miguel Guhlin** · [SplatWorks.org](https://splatworks.org/) · [Buy Me a Coffee](https://buymeacoffee.com/drawsplat)

Postbox opens exported `.eml`, `.msg`, `.pst`, `.mbox`, and `.mbx` email files locally. Both portable packages include Python: extract the entire download and launch it. No Python installation, pip packages, accounts, or internet connection is needed after download. A modern web browser is required.

## Downloads

| Platform | Download | Launch |
| --- | --- | --- |
| Windows 10+ on Intel/AMD 64-bit | [Windows ZIP](downloads/Postbox-windows-x64.zip) | Extract, then double-click **Start Postbox.bat** |
| Linux on Intel/AMD 64-bit, glibc 2.17+ | [Linux TAR.GZ](downloads/Postbox-linux-x64.tar.gz) | Extract, then run `./"Start Postbox.sh"` |
| Source code | [Source ZIP](downloads/Postbox-source.zip) | Run `python3 app.py` or `py app.py` with Python 3.9+ |

[SHA-256 checksums](downloads/SHA256SUMS.txt) · [Full application guide](app/README.md) · [Browse source](app/)

Keep the extracted folder intact. The launcher opens a localhost address in your browser. Keep its terminal open while using Postbox; press Ctrl+C there to stop it. On Linux, use `chmod +x "Start Postbox.sh"` if needed. USB mounts must permit executable files. ARM devices and Alpine/musl Linux need a different runtime.

## Features

- Open individual EML messages, whole MBOX archives, or folders, including subfolders.
- HTML opens automatically when available; scripts, remote images, and navigation are blocked. Plain text remains available.
- Search `from:`, `to:`, `cc:`, `subject:`, `body:` / `content:`, `attachment:`, `has:attachment`, and `has:noattachment`. Combine filters and quote phrases.
- Group by year/month, filter inclusive date ranges, select matching results, and Shift-click for a range.
- Preview PDFs, JPG/PNG/WebP and other images, browser-supported audio/video, text files, DOCX, and supported Word 97–2003 DOC text.
- Select messages or individual attachments across messages for bulk export or deletion.
- Export attachments into year/month/email folders, preserving existing files, or download a ZIP in other browsers.
- Green **Next** and red **Delete this email** controls sit together in the reader. Successful deletion advances to the next remaining message in the filtered list.

Example: `from:ada subject:"meeting notes" has:attachment`.

## Managing originals

Use Chrome or Edge and **Open managed folder** for original-file access. If files were imported as copies, deletion offers to reconnect their original folder and checks the file contents before writing. Other browsers support session-only deletion and ZIP export.

Original-file deletion permanently removes EML files or rewrites MBOX archives. Removing an attachment rewrites its source email. Confirmation is required; separately exported files are unaffected. Session-only deletion preserves files on disk. Deletion cannot be undone in Postbox. Errors appear beside the reader controls, and cancelled/failed deletion keeps the email open.

## Limits and validation

PST imports stream up to 2 GB through a temporary local file; other files are limited to 100 MB. Extracted messages and attachments are held in memory. MBOX/PST parsing briefly uses a local temporary file, which is removed afterwards. Search indexes email body text and attachment filenames, not attached-file contents. DOC/DOCX previews show text rather than original layout. PDF and media formats depend on browser support. PST originals stay read-only and MSG attachment edits cannot be written back to MSG; export selected emails to EML ZIP/MBOX for editing. Contacts and calendar records are excluded; encrypted messages are not decrypted and signatures are not verified.

The bundled Linux runtime and MIME/MBOX/organizer have automated checks. DOM regression checks cover navigation, reconnecting original files, deletion, auto-advance, and export with simulated file handles. Windows package contents are checked; packaged-runtime checks run on Windows and Linux in [GitHub Actions](https://github.com/mguhlin/mguhlin.github.io/actions/workflows/postbox-checks.yml).

Run the source checks from `app/`:

```sh
python3 -m unittest -v test_viewer.py test_previews.py test_organizer.py test_outlook.py test_print_export.py
node test_search.cjs
```

## Repository and publishing

This folder lives in `mguhlin/mguhlin.github.io`, published by GitHub Pages at `/postbox/`. The public page and downloads are static; the Python viewer runs only on the user's computer.

- `index.html`, `assets/`: download page and original hero artwork.
- `downloads/`: complete portable packages, source archive, and checksums.
- `app/`: application source, build helper, tests, and the full user guide.

To rebuild portable packages, follow `app/README.md`, then update the downloads and their checksums together. Python runtime licenses are included in each package. The bundled DOC reader's license is in `app/OLEFILE-LICENSE.txt`.

## Outlook and developer update

PST and MSG can be imported directly, with their mail headers, bodies, and extracted attachments. **Export emails as EML ZIP** and **Export emails as MBOX** convert selected emails into portable exports. The original PST is never rewritten. Source builds need a compatible `pypff` reader for PST; native wheels for the bundled CPython 3.13 runtimes are in `app/vendor/`, with licenses and corresponding source in `app/licenses/`. Run `test_outlook.py` with the other Python checks.

The SplatWorks purple theme preserves green Next and red Delete actions. [About Developer](https://mguhlin.github.io/postbox/about.html) credits Miguel Guhlin and includes [Buy Me a Coffee](https://buymeacoffee.com/drawsplat).

## Blog introduction

[Postbox: A free way to read your Proton Mail and MBOX exports](https://mguhlin.org/blog/2026-11-01-postbox-a-free-way-to-read-your-proton-mail-and-mbox-exports/).

## Planned macOS version

Portable Apple Silicon and Intel Mac downloads are planned for **November 8, 2026**. Python will be included. [Saved scope, estimates, compatibility findings, and remaining work](docs/macos-portable-plan.md).


## Printing emails and exporting PDFs

Open a message and choose **Export this email as PDF**, or check messages and choose **Export selected emails as PDF**. Selection includes checked emails outside the current filters. Selected messages appear newest first, with each email starting on a new page in one document; long emails continue across pages.

Leave **Clean layout: fit content to the page** checked to remove email styling, wrap long text, fit tables to the printable width, and resize images. Uncheck it to retain inline email formatting; unusually wide layouts may then need browser scaling or the clean option. Choose Letter or A4, then **Open print preview**. In the new tab, select **Print / Save as PDF** and choose your browser’s **Save as PDF** destination or a printer. Match the paper size to the preview; turn off browser headers and footers for a cleaner result. Allow Postbox pop-ups if the preview is blocked. Cancelling the print dialog keeps the preview available.

PDFs include subject, sender, recipients, date, folder when available, message body, and attachment filenames. Attachment contents are not printed; export or print them separately. Remote images and active content remain blocked, and email data stays on your computer. PDF export uses the browser’s local print engine and works offline without an additional dependency. Download and restart the updated portable package to use these controls.
