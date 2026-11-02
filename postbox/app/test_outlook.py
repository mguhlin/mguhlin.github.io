import io
import json
import mailbox
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import app
import outlook


class OutlookTest(unittest.TestCase):
    def setUp(self):
        app.MESSAGES.clear()
        app.SOURCES.clear()
        app.PLANS.clear()

    def tearDown(self):
        self.setUp()

    def test_msg_recipients_html_and_attachment(self):
        streams = {}
        def text(base, tag, value):
            streams[(*base, '__substg1.0_' + tag + '001F')] = (value + '\0').encode('utf-16-le')
        text((), '0037', 'Outlook résumé')
        text((), '1000', 'Plain body')
        text((), '0C1A', 'Ada')
        text((), '5D01', 'ada@example.com')
        streams[('__substg1.0_10130102',)] = b'<p>HTML body</p>'
        recipient = ('__recip_version1.0_#00000000',)
        text(recipient, '3001', 'Grace')
        text(recipient, '39FE', 'grace@example.com')
        attach = ('__attach_version1.0_#00000000',)
        text(attach, '3707', 'photo.png')
        streams[(*attach, '__substg1.0_37010102')] = b'\x89PNG\x00binary'

        class FakeOle:
            def exists(self, path): return tuple(path) in streams
            def openstream(self, path): return io.BytesIO(streams[tuple(path)])
            def listdir(self, **kwargs): return [list(path) for path in streams]

        message = app.parse_message(outlook.msg_email(FakeOle()).as_bytes(), 'converted.eml')
        self.assertEqual(message['subject'], 'Outlook résumé')
        self.assertIn('ada@example.com', message['sender'])
        self.assertIn('grace@example.com', message['to'])
        self.assertIn('HTML body', message['html'])
        self.assertEqual(message['attachments'][0]['data'], b'\x89PNG\x00binary')

    def test_pst_original_guard_and_session_edits(self):
        raw = outlook.build_email(subject='Imported', plain='Keep body', attachments=[dict(name='data.bin', data=b'preserve')]).as_bytes()
        message = app.parse_message(raw, 'archive-1.eml')
        message.update(sourceId='pst', sourceIndex=0, sourceFormat='pst', outlookFolder='Inbox')
        mid = message['id']
        app.MESSAGES[mid] = message
        app.SOURCES['pst'] = dict(filename='archive.pst', raw=b'', messageIds=[mid])
        plan = app.create_plan(dict(action='attachments', attachments={mid: [0]}))
        self.assertFalse(plan['changes'][0]['originalWritable'])
        self.assertIsNone(plan['changes'][0]['data'])
        result = app.commit_plan(dict(planId=plan['planId'], sourceId='pst'))
        self.assertEqual(result['messages'][0]['attachments'], [])
        self.assertEqual(result['messages'][0]['outlookFolder'], 'Inbox')
        self.assertEqual(result['messages'][0]['sourceFormat'], 'pst')
        plan = app.create_plan(dict(action='messages', messageIds=[mid]))
        self.assertFalse(plan['changes'][0]['originalWritable'])
        app.commit_plan(dict(planId=plan['planId'], sourceId='pst'))
        self.assertEqual(app.SOURCES['pst']['raw'], b'')

    def test_msg_attachment_edit_guard_but_whole_file_delete_allowed(self):
        raw = outlook.build_email(subject='MSG', plain='body').as_bytes()
        message = app.parse_message(raw, 'converted.eml')
        message.update(sourceId='msg', sourceIndex=0, sourceFormat='msg')
        app.MESSAGES[message['id']] = message
        app.SOURCES['msg'] = dict(filename='saved.msg', raw=b'original MSG', messageIds=[message['id']])
        plan = app.create_plan(dict(action='attachments', attachments={message['id']: []}))
        self.assertFalse(plan['changes'][0]['originalWritable'])
        plan = app.create_plan(dict(action='messages', messageIds=[message['id']]))
        self.assertTrue(plan['changes'][0]['originalWritable'])
        self.assertTrue(plan['changes'][0]['delete'])

    def test_streaming_pst_route_and_email_exports(self):
        raw = outlook.build_email(subject='Converted PST message', plain='content', attachments=[dict(name='proof.txt', data=b'attachment data')]).as_bytes()
        def importer(path, parser, filename):
            self.assertEqual(Path(path).read_bytes(), b'!BDNfixture')
            message = parser(raw, 'converted.eml')
            message.update(sourceFormat='pst', outlookFolder='Inbox')
            return [message]

        class Connection:
            def __init__(self, data): self.input = io.BytesIO(data); self.output = bytearray()
            def makefile(self, *args): return self.input
            def sendall(self, data): self.output.extend(data)
        def request(path, payload, filename=None):
            body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
            headers = f'Content-Length: {len(body)}\r\nX-Viewer-Token: {app.TOKEN}\r\n'
            if filename:
                headers += f'X-Filename: {filename}\r\n'
            connection = Connection((f'POST {path} HTTP/1.0\r\n' + headers + '\r\n').encode() + body)
            app.Handler(connection, ('127.0.0.1', 1234), None)
            return bytes(connection.output).split(b'\r\n\r\n', 1)

        with patch('app.import_pst', importer):
            header, body = request('/import', b'!BDNfixture', 'archive.pst')
        self.assertIn(b'200 OK', header)
        message = json.loads(body)[0]
        self.assertEqual(app.SOURCES[message['sourceId']]['raw'], b'')
        for fmt in ['eml', 'mbox']:
            header, body = request('/export-emails', {'messageIds': [message['id']], 'format': fmt})
            self.assertIn(b'200 OK', header)
            if fmt == 'eml':
                with zipfile.ZipFile(io.BytesIO(body)) as archive:
                    exported = archive.read(archive.namelist()[0])
            else:
                exported = app.parse_export(body, 'export.mbox')[0]['raw']
            parsed = app.parse_message(exported, 'export.eml')
            self.assertEqual(parsed['subject'], 'Converted PST message')
            self.assertEqual(parsed['attachments'][0]['data'], b'attachment data')

    def test_bundled_native_reader_loads(self):
        self.assertEqual(outlook.pst_reader().get_version(), '20260926')

    def test_invalid_pst_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'bad.pst'
            path.write_bytes(b'not a PST')
            with self.assertRaisesRegex(ValueError, 'PST signature'):
                outlook.import_pst(path, app.parse_message, 'bad.pst')


if __name__ == '__main__':
    unittest.main()
