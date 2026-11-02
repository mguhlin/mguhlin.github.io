import io
import json
import mailbox
import tempfile
import unittest
import zipfile
from email.message import EmailMessage
from pathlib import Path

import app
from organizer import remove_attachments, safe_filename


class OrganizerTest(unittest.TestCase):
    def setUp(self):
        app.MESSAGES.clear()
        app.SOURCES.clear()
        app.PLANS.clear()

    def tearDown(self):
        self.setUp()

    def email(self, subject='One', date='Tue, 12 Mar 2024 12:00:00 -0500'):
        m = EmailMessage()
        m['Subject'] = subject
        m['Date'] = date
        m.set_content('Keep this text')
        m.add_alternative('<p>Keep this HTML</p>', subtype='html')
        m.add_attachment(b'first', maintype='application', subtype='octet-stream', filename='one.bin')
        m.add_attachment(b'second', maintype='application', subtype='octet-stream', filename='two.bin')
        return m

    def register(self, raw, filename):
        parsed = app.parse_export(raw, filename)
        sid = 'source-' + str(len(app.SOURCES))
        for index, message in enumerate(parsed):
            message.update(sourceId=sid, sourceIndex=index)
            app.MESSAGES[message['id']] = message
        app.SOURCES[sid] = dict(raw=raw, filename=filename, messageIds=[m['id'] for m in parsed])
        return sid, parsed

    def test_remove_attachments_preserves_bodies_and_other_attachment(self):
        raw = self.email().as_bytes()
        result = app.parse_message(remove_attachments(raw, {0}), 'file.eml')
        self.assertIn('Keep this text', result['plain'])
        self.assertIn('Keep this HTML', result['html'])
        self.assertEqual([a['name'] for a in result['attachments']], ['two.bin'])
        self.assertEqual(result['attachments'][0]['data'], b'second')
        self.assertEqual(result['dateKey'], '2024-03-12')
        with self.assertRaises(ValueError):
            remove_attachments(raw, {5})

    def test_delete_eml_plan_does_not_mutate_before_commit(self):
        sid, records = self.register(self.email().as_bytes(), 'original.eml')
        plan = app.create_plan(dict(action='messages', messageIds=[records[0]['id']]))
        self.assertTrue(plan['changes'][0]['delete'])
        self.assertIn(sid, app.SOURCES)
        self.assertIn(records[0]['id'], app.MESSAGES)
        result = app.commit_plan(dict(planId=plan['planId'], sourceId=sid))
        self.assertFalse(app.MESSAGES)
        self.assertFalse(app.SOURCES)
        self.assertEqual(result['messages'], [])

    def test_mbox_bulk_delete_and_attachment_edit(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'archive.mbox'
            archive = mailbox.mbox(path)
            for subject in ['One', 'Two', 'Three']:
                archive.add(self.email(subject))
            archive.flush()
            archive.close()
            sid, records = self.register(path.read_bytes(), 'archive.mbox')
            plan = app.create_plan(dict(action='messages', messageIds=[records[0]['id'], records[2]['id']]))
            app.commit_plan(dict(planId=plan['planId'], sourceId=sid))
            remaining = app.parse_export(app.SOURCES[sid]['raw'], 'archive.mbox')
            self.assertEqual([m['subject'] for m in remaining], ['Two'])
            mid = records[1]['id']
            self.assertEqual(app.MESSAGES[mid]['sourceIndex'], 0)
            plan = app.create_plan(dict(action='attachments', attachments={mid: [0, 1]}))
            app.commit_plan(dict(planId=plan['planId'], sourceId=sid))
            remaining = app.parse_export(app.SOURCES[sid]['raw'], 'archive.mbox')
            self.assertEqual(remaining[0]['attachments'], [])
            self.assertIn('Keep this HTML', remaining[0]['html'])
            plan = app.create_plan(dict(action='messages', messageIds=[mid]))
            app.commit_plan(dict(planId=plan['planId'], sourceId=sid))
            self.assertEqual(app.SOURCES[sid]['raw'], b'')

    def test_changed_source_rejected(self):
        sid, records = self.register(self.email().as_bytes(), 'original.eml')
        plan = app.create_plan(dict(action='messages', messageIds=[records[0]['id']]))
        app.SOURCES[sid]['raw'] += b'changed'
        with self.assertRaises(ValueError):
            app.commit_plan(dict(planId=plan['planId'], sourceId=sid))
        self.assertIn(records[0]['id'], app.MESSAGES)

    def test_safe_export_names(self):
        for name in ['../../escape.txt', '..\\escape.txt']:
            self.assertEqual(safe_filename(name), 'escape.txt')
        self.assertEqual(safe_filename('CON.txt'), '_CON.txt')
        self.assertEqual(safe_filename(''), 'attachment')

    def test_autoload_html_has_no_navigation_or_active_content(self):
        content = '<meta http-equiv="refresh" content="0;url=https://example.com"><base href="https://example.com"><a href="https://example.com">Readable link</a><img src="https://example.com/pixel" onerror="alert(1)"><script>alert(1)</script><p style="color:red">Keep formatting &amp; text</p>'
        cleaned = app.safe_html(content)
        self.assertNotIn('example.com', cleaned)
        self.assertNotIn('alert', cleaned)
        self.assertNotIn('<meta', cleaned)
        self.assertIn('Readable link', cleaned)
        self.assertIn('<p style="color:red">Keep formatting &amp; text</p>', cleaned)

    def test_api_export_and_source_registration_without_sockets(self):
        class Connection:
            def __init__(self, raw):
                self.input = io.BytesIO(raw)
                self.output = bytearray()
            def makefile(self, *args): return self.input
            def sendall(self, data): self.output.extend(data)

        def request(path, body, token=True):
            headers = f'Content-Length: {len(body)}\r\n'
            if token:
                headers += f'X-Viewer-Token: {app.TOKEN}\r\n'
            connection = Connection((f'POST {path} HTTP/1.0\r\n' + headers + '\r\n').encode() + body)
            app.Handler(connection, ('127.0.0.1', 1234), None)
            return bytes(connection.output).split(b'\r\n\r\n', 1)

        headers, data = request('/import', self.email().as_bytes())
        self.assertIn(b'200 OK', headers)
        message = json.loads(data)[0]
        self.assertIn(message['sourceId'], app.SOURCES)
        headers, data = request('/export', json.dumps({'attachments': {message['id']: [0, 1]}}).encode())
        self.assertIn(b'application/zip', headers)
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            self.assertEqual([archive.read(name) for name in archive.namelist()], [b'first', b'second'])
            self.assertTrue(all(name.startswith('2024-03-12_') for name in archive.namelist()))
        headers, data = request('/plan', b'{}', token=False)
        self.assertIn(b'403', headers)


if __name__ == '__main__':
    unittest.main()
