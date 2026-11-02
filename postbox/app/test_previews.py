import io
import struct
import unittest
import zipfile
from unittest.mock import patch

from previews import legacy_doc_text, preview_kind, text_preview


class PreviewTest(unittest.TestCase):
    def test_docx_paragraphs_and_tables(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Budget &amp; forecast</w:t><w:tab/><w:t>2026</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
        text = text_preview(dict(name='budget.docx', data=buffer.getvalue()))
        self.assertIn('Budget & forecast\t2026\nTable cell', text)

    def test_legacy_doc_piece_table(self):
        # A Word FIB and piece table containing both compressed and UTF-16 text.
        word = bytearray(1100)
        struct.pack_into('<H', word, 32, 14)
        struct.pack_into('<H', word, 62, 22)
        struct.pack_into('<H', word, 152, 34)
        pieces = struct.pack('<III', 0, 6, 10)
        pieces += b'\0\0' + struct.pack('<I', 0x40000000 | (1000 * 2)) + b'\0\0'
        pieces += b'\0\0' + struct.pack('<I', 1020) + b'\0\0'
        table = b'\x02' + struct.pack('<I', len(pieces)) + pieces
        struct.pack_into('<II', word, 418, 0, len(table))
        word[1000:1006] = b'Hello '
        word[1020:1028] = 'café'.encode('utf-16-le')

        class FakeOle:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def openstream(self, name):
                return io.BytesIO(word if name == 'WordDocument' else table)

        with patch('olefile.OleFileIO', return_value=FakeOle()):
            self.assertEqual(legacy_doc_text(b'fake'), 'Hello café')

    def test_safe_types_and_text(self):
        for ext, kind in [('PDF', 'pdf'), ('jpg', 'image'), ('webp', 'image'), ('webm', 'video'), ('mp3', 'audio'), ('doc', 'text'), ('docx', 'text')]:
            self.assertEqual(preview_kind({'name': 'file.' + ext}), kind)
        self.assertIsNone(preview_kind({'name': 'run.exe'}))
        self.assertIsNone(preview_kind({'name': 'active.svg'}))
        self.assertEqual(text_preview(dict(name='file.html', data=b'<script>inert</script>')), '<script>inert</script>')
        with self.assertRaises(ValueError):
            text_preview(dict(name='large.txt', data=b'x' * (5 * 1024 * 1024 + 1)))


if __name__ == '__main__':
    unittest.main()
