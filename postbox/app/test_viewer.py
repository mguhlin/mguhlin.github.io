import json
import threading
import unittest
from email.message import EmailMessage
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


class ViewerTest(unittest.TestCase):
    def test_mime_decoding(self):
        message = EmailMessage()
        message['Subject'] = 'Résumé ☀'
        message.set_content('café')
        message.add_alternative('<h1>Hello</h1>', subtype='html')
        binary = bytes(range(256))
        message.add_attachment(binary, maintype='application', subtype='octet-stream', filename='résumé.bin')
        nested = EmailMessage()
        nested.set_content('Nested message')
        message.add_attachment(nested, filename='forward.eml')
        parsed = app.parse_message(message.as_bytes(), 'sample.eml')
        self.assertEqual(parsed['subject'], 'Résumé ☀')
        self.assertIn('café', parsed['plain'])
        self.assertIn('<h1>Hello</h1>', parsed['html'])
        self.assertEqual(parsed['attachments'][0]['data'], binary)
        self.assertEqual(parsed['attachments'][0]['name'], 'résumé.bin')
        self.assertIn(b'Nested message', parsed['attachments'][1]['data'])
        self.assertEqual(len(parsed['attachments']), 2)

    def test_html_body_search_text(self):
        message = EmailMessage()
        message.set_content('<html><head><style>hiddenstyle</style></head><body><p>Budget &amp; forecast</p><div>Approved <b>today</b></div><script>hiddenscript</script></body></html>', subtype='html')
        parsed = app.parse_message(message.as_bytes(), 'html.eml')
        self.assertEqual(parsed['plain'], '')
        self.assertIn('Budget & forecast', parsed['bodyText'])
        self.assertIn('Approved today', parsed['bodyText'])
        self.assertNotIn('hidden', parsed['bodyText'])

    def test_mbox_import(self):
        import mailbox
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'test.mbox'
            archive = mailbox.mbox(path)
            first = EmailMessage()
            first['Subject'] = 'First'
            first.set_content('From this line stays inside the message')
            first.add_attachment(b'payload', maintype='application', subtype='octet-stream', filename='report.bin')
            second = EmailMessage()
            second['Subject'] = 'Second'
            second.set_content('<p>HTML-only archive content</p>', subtype='html')
            archive.add(first)
            archive.add(second)
            archive.flush()
            archive.close()
            parsed = app.parse_export(path.read_bytes(), 'archive.MBOX')
        self.assertEqual([m['subject'] for m in parsed], ['First', 'Second'])
        self.assertEqual(parsed[0]['attachments'][0]['data'], b'payload')
        self.assertIn('HTML-only archive content', parsed[1]['bodyText'])
        self.assertEqual(parsed[1]['filename'], 'archive-2.eml')
        self.assertEqual(app.parse_export(b'', 'empty.mbox'), [])
        with self.assertRaises(ValueError):
            app.parse_export(b'not an archive', 'invalid.mbox')

    def test_import_and_download(self):
        message = EmailMessage()
        message['Subject'] = 'Résumé ☀'
        message['From'] = 'Ada <ada@example.com>'
        message.set_content('Searchable café')
        message.add_alternative('<h1>Hello</h1><script>alert(1)</script><img src="https://example.com/tracker">', subtype='html')
        binary = bytes(range(256))
        message.add_attachment(binary, maintype='application', subtype='octet-stream', filename='résumé.bin')
        nested = EmailMessage()
        nested.set_content('Nested message')
        message.add_attachment(nested, filename='forward.eml')
        try:
            server = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        except PermissionError:
            self.skipTest('Environment blocks listening sockets')
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            raw = message.as_bytes()
            req = Request(base+'/import', data=raw, headers={'X-Viewer-Token': app.TOKEN})
            with urlopen(req) as response:
                result = json.load(response)[0]
            self.assertEqual(result['subject'], 'Résumé ☀')
            self.assertIn('café', result['plain'])
            self.assertEqual(len(result['attachments']), 2)
            route = f'{base}/{app.TOKEN}/{result["id"]}'
            with urlopen(route+'/0') as response:
                self.assertEqual(response.read(), binary)
                self.assertIn('attachment;', response.headers['Content-Disposition'])
            with urlopen(route+'/1') as response:
                self.assertIn(b'Nested message', response.read())
            with urlopen(route+'/html') as response:
                self.assertIn("default-src 'none'", response.headers['Content-Security-Policy'])
                self.assertIn('sandbox;', response.headers['Content-Security-Policy'])
            with urlopen(route+'/original') as response:
                self.assertEqual(response.read(), raw)
            with self.assertRaises(HTTPError) as denied:
                urlopen(Request(base+'/clear', data=b''))
            self.assertEqual(denied.exception.code, 403)
            urlopen(Request(base+'/clear', data=b'', headers={'X-Viewer-Token': app.TOKEN})).close()
            self.assertFalse(app.MESSAGES)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
