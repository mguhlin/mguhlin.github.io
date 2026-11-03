"""Bundle downloaded Linux standalone and Windows embeddable Python runtimes."""
import argparse
import shutil
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def build(linux_archive, windows_archive, output):
    output.mkdir(parents=True, exist_ok=True)
    for platform in ('linux-x64', 'windows-x64'):
        folder = output / ('Postbox-' + platform)
        folder.mkdir(exist_ok=True)
        for name in ('app.py', 'print_export.py', 'test_print_export.py', 'test_pdf_browser.cjs', 'index.html', 'test_viewer.py', 'README.md', 'previews.py', 'olefile.py', 'OLEFILE-LICENSE.txt', 'hero.png', 'hero-purple.png', 'test_previews.py', 'app.js', 'organizer.py', 'test_organizer.py', 'test_search.cjs', 'outlook.py', 'test_outlook.py', 'about.html', 'theme.css'):
            shutil.copy2(ROOT / name, folder / name)
        shutil.copytree(ROOT / 'vendor' / ('linux' if platform == 'linux-x64' else 'windows'),
                        folder / 'vendor' / ('linux' if platform == 'linux-x64' else 'windows'), dirs_exist_ok=True)
        shutil.copytree(ROOT / 'licenses', folder / 'licenses', dirs_exist_ok=True)
        runtime = folder / 'runtime'
        runtime.mkdir(exist_ok=True)
        if platform == 'linux-x64':
            with tarfile.open(linux_archive) as archive:
                archive.extractall(runtime, filter='data')
            launcher = folder / 'Start Postbox.sh'
            launcher.write_text('#!/bin/sh\nAPP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$APP_DIR/runtime/python/bin/python3" -I "$APP_DIR/app.py" "$@"\n')
            launcher.chmod(0o755)
            instruction = 'Run ./"Start Postbox.sh" in a terminal. If needed, run chmod +x "Start Postbox.sh" first.\n'
        else:
            with zipfile.ZipFile(windows_archive) as archive:
                archive.extractall(runtime)
            for path_file in runtime.glob('python*._pth'):
                content = path_file.read_text()
                if '..' not in content.splitlines():
                    path_file.write_text(content + '\n..\n')
            (folder / 'Start Postbox.bat').write_bytes(b'@echo off\r\n"%~dp0runtime\\python.exe" -I "%~dp0app.py" %*\r\nif errorlevel 1 pause\r\n')
            instruction = 'Double-click Start Postbox.bat.\n'
        (folder / 'START HERE.txt').write_text(
            'POSTBOX — OFFLINE EMAIL VIEWER\n\n' + instruction +
            '\nPython is bundled. No installation or internet connection is needed.\n'
            'Extract the entire archive before launching; keep runtime and app files together.\n'
            'A browser opens automatically. Keep the terminal open; press Ctrl+C to stop.\n'
            'If necessary, open the local address printed in the terminal.\n\n'
            'Open .eml, .msg, .pst, .mbox or .mbx files or folders. PST originals remain read-only.\n'
            'PST imports: up to 2 GB, with memory use depending on extracted emails/attachments. Other files: up to 100 MB.\n'
            'Export selected Outlook emails as EML ZIP or MBOX for editing.\n'
            'Search: from:ada to:grace subject:"meeting notes" body:budget has:attachment.\n'
            'Use has:noattachment for messages without attachments. See README.md.\n'
            'Messages stay local. Delete from originals explicitly changes source files.\n'
            'Use Open managed folder in Chrome/Edge for original-file editing.\n'
            'Select a date range, select results, then export their attachments to a folder.\n'
            'MBOX imports use a temporary local file deleted after parsing.\n'
            'HTML scripts and remote content are blocked. Inline images are downloadable attachments.\n'
            'Requires a modern browser and a 64-bit Intel/AMD operating system.\n'
            + ('Windows 10 or later.\n' if platform == 'windows-x64' else
               'Linux with glibc 2.17 or later; not Alpine/musl. USB mounts must allow execution.\n') +
            '\nPython runtime licenses are included in the runtime directory.\n', encoding='utf-8')
        if platform == 'linux-x64':
            with tarfile.open(output / (folder.name + '.tar.gz'), 'w:gz', compresslevel=1) as archive:
                archive.add(folder, arcname=folder.name)
        else:
            with zipfile.ZipFile(output / (folder.name + '.zip'), 'w', zipfile.ZIP_DEFLATED) as archive:
                for file in folder.rglob('*'):
                    if file.is_file():
                        archive.write(file, file.relative_to(output))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--linux-runtime', type=Path, required=True)
    parser.add_argument('--windows-runtime', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    build(args.linux_runtime, args.windows_runtime, args.output)
