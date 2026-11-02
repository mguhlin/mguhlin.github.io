"""Local attachment previews; never launches attachment code or macros."""
import io
import re
import struct
import zipfile
from pathlib import Path
from xml.etree import ElementTree

MEDIA = {
    '.pdf': ('pdf', 'application/pdf'),
    '.jpg': ('image', 'image/jpeg'), '.jpeg': ('image', 'image/jpeg'),
    '.png': ('image', 'image/png'), '.webp': ('image', 'image/webp'),
    '.gif': ('image', 'image/gif'), '.bmp': ('image', 'image/bmp'),
    '.avif': ('image', 'image/avif'), '.ico': ('image', 'image/x-icon'),
    '.webm': ('video', 'video/webm'), '.mp4': ('video', 'video/mp4'),
    '.ogv': ('video', 'video/ogg'), '.mov': ('video', 'video/quicktime'),
    '.mp3': ('audio', 'audio/mpeg'), '.wav': ('audio', 'audio/wav'),
    '.ogg': ('audio', 'audio/ogg'), '.m4a': ('audio', 'audio/mp4'),
    '.flac': ('audio', 'audio/flac'),
}
TEXT = {'.txt', '.csv', '.md', '.log', '.json', '.xml', '.html', '.htm', '.css', '.js', '.py', '.yaml', '.yml'}


def preview_kind(item):
    ext = Path(item['name']).suffix.lower()
    if ext in MEDIA:
        return MEDIA[ext][0]
    if ext in TEXT or ext in ('.docx', '.doc'):
        return 'text'
    return None


def legacy_doc_text(data):
    import olefile
    with olefile.OleFileIO(io.BytesIO(data)) as doc:
        word = doc.openstream('WordDocument').read()
        u16 = lambda offset: struct.unpack_from('<H', word, offset)[0]
        flags = u16(10)
        if flags & 0x8100:
            raise ValueError('Encrypted Word documents cannot be previewed.')
        # Locate the variable-length FIB field groups, then fcClx/lcbClx.
        pos = 34 + 2 * u16(32)
        pos += 2 + 4 * u16(pos)
        if u16(pos) <= 33:
            raise ValueError('This older Word version is not supported.')
        clx_offset, clx_size = struct.unpack_from('<II', word, pos + 2 + 33 * 8)
        table = doc.openstream('1Table' if flags & 0x200 else '0Table').read()
        clx = table[clx_offset:clx_offset + clx_size]
        pos = 0
        while pos < len(clx) and clx[pos] == 1:
            pos += 3 + struct.unpack_from('<H', clx, pos + 1)[0]
        if pos >= len(clx) or clx[pos] != 2:
            raise ValueError('This Word document has no supported text piece table.')
        size = struct.unpack_from('<I', clx, pos + 1)[0]
        pieces = clx[pos + 5:pos + 5 + size]
        if size < 4 or len(pieces) != size or (size - 4) % 12:
            raise ValueError('Invalid Word text table.')
        count = (size - 4) // 12
        chunks = []
        for i in range(count):
            start, end = struct.unpack_from('<II', pieces, i * 4)
            fc = struct.unpack_from('<I', pieces, (count + 1) * 4 + i * 8 + 2)[0]
            compressed = bool(fc & 0x40000000)
            offset = fc & 0x3fffffff
            if compressed:
                offset //= 2
            length = (end - start) * (1 if compressed else 2)
            if end < start or offset + length > len(word):
                raise ValueError('Invalid Word text range.')
            chunks.append(word[offset:offset + length].decode('cp1252' if compressed else 'utf-16-le', errors='replace'))
        text = ''.join(chunks).replace('\r', '\n').replace('\x07', '\t')
        return re.sub(r'[\x00-\x08\x0b-\x1f]', '', text)


def text_preview(item):
    data = item['data']
    ext = Path(item['name']).suffix.lower()
    if ext == '.docx':
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            info = archive.getinfo('word/document.xml')
            if info.file_size > 20 * 1024 * 1024:
                raise ValueError('Document is too large for text preview.')
            xml = archive.read(info)
            if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():
                raise ValueError('Unsupported XML declarations.')
            root = ElementTree.fromstring(xml)
        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        lines = []
        for paragraph in root.iter(ns + 'p'):
            parts = []
            for node in paragraph.iter():
                if node.tag == ns + 't':
                    parts.append(node.text or '')
                elif node.tag in (ns + 'br', ns + 'cr'):
                    parts.append('\n')
                elif node.tag == ns + 'tab':
                    parts.append('\t')
            lines.append(''.join(parts))
        return 'DOCX text preview — layout and embedded objects are omitted.\n\n' + '\n'.join(lines)
    if ext == '.doc':
        return 'Word 97–2003 text preview — layout and embedded objects are omitted.\n\n' + legacy_doc_text(data)
    if len(data) > 5 * 1024 * 1024:
        raise ValueError('Text preview is limited to 5 MB. Download to read the full file.')
    if data.startswith((b'\xff\xfe', b'\xfe\xff')):
        return data.decode('utf-16', errors='replace')
    return data.decode('utf-8-sig', errors='replace')
