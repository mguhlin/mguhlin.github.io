import json
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import app
from print_export import print_document


class PrintExportTest(unittest.TestCase):
    def message(self, **changes):
        return dict(dict(subject='Résumé <budget>', sender='Ada <ada@example.com>', to='Grace', date='Tue, 3 Nov 2026', plain='Hello\nWorld', attachments=[]), **changes)

    def test_clean_and_formatted_layouts(self):
        html = '<style>body{display:none}</style><script>alert(1)</script><div class="print-tools" id="printNow" style="width:4000px" onclick="alert(2)"><table width="4000"><tr><td>Keep this</td></tr></table><img src="https://example.com/tracker"></div>'
        result = print_document([self.message(html=html)])
        self.assertIn('Keep this', result)
        for unsafe in ('display:none', 'alert(', 'width="4000"', 'width:4000px', 'https://example.com'):
            self.assertNotIn(unsafe, result)
        self.assertEqual(result.count('id="printNow"'), 1)
        self.assertIn('table-layout: fixed', result)
        self.assertIn("default-src 'none'", result)
        formatted = print_document([self.message(html='<p style="color:red">café</p>')], False, 'a4')
        self.assertIn('style="color:red"', formatted)
        self.assertIn('size: A4', formatted)

    def test_metadata_plain_text_and_batch(self):
        result = print_document([self.message(attachments=[{'name': '<report>.pdf'}]), self.message(subject='Second')])
        for text in ('Résumé &lt;budget&gt;', 'Ada &lt;ada@example.com&gt;', 'Hello\nWorld', '&lt;report&gt;.pdf', 'Email 2 of 2', 'break-before: page'):
            self.assertIn(text, result)
        self.assertEqual(result.count('<section class="email">'), 2)
        with self.assertRaises(ValueError):
            print_document([self.message()], paper='bad')

    def test_endpoint_selection_and_auth(self):
        server = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        mid = 'pdf-test-message'
        app.MESSAGES[mid] = self.message()
        base = f'http://127.0.0.1:{server.server_port}/export-pdf'
        def request(payload, token=app.TOKEN):
            return urlopen(Request(base, data=json.dumps(payload).encode(), headers={'X-Viewer-Token': token}))
        try:
            with request({'messageIds': [mid, mid]}) as response:
                self.assertIn('text/html', response.headers['Content-Type'])
                self.assertEqual(response.read().decode().count('<section class="email">'), 1)
            for payload in ({'messageIds': []}, {'messageIds': ['missing']}, {'messageIds': [mid], 'paper': 'bad'}, {'messageIds': [mid], 'clean': 'false'}):
                with self.assertRaises(HTTPError) as error:
                    request(payload)
                self.assertEqual(error.exception.code, 400)
            with self.assertRaises(HTTPError) as error:
                request({'messageIds': [mid]}, 'wrong-token')
            self.assertEqual(error.exception.code, 403)
        finally:
            app.MESSAGES.pop(mid, None)
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
