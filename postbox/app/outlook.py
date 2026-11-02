"""Offline Outlook import. PST is read-only; messages are converted to MIME."""
import io
import mimetypes
import struct
import sys
from datetime import datetime, timedelta, timezone
from email import policy
from email.message import EmailMessage
from email.parser import HeaderParser
from email.utils import format_datetime, formataddr
from pathlib import Path


def clean(value):
    return str(value or '').replace('\r', ' ').replace('\n', ' ').strip()


def decode(value, codepage=1252):
    if isinstance(value, str):
        return value.rstrip('\0')
    if not value:
        return ''
    for encoding in ['utf-8-sig', f'cp{codepage}', 'cp1252']:
        try:
            return bytes(value).decode(encoding).rstrip('\0')
        except (UnicodeError, LookupError):
            continue
    return bytes(value).decode('utf-8', errors='replace').rstrip('\0')


def build_email(headers='', subject='', sender='', recipients=None, date=None,
                plain='', html='', attachments=()):
    original = HeaderParser(policy=policy.default).parsestr(decode(headers))
    message = EmailMessage(policy=policy.SMTP)
    for name in ['Subject', 'From', 'To', 'Cc', 'Bcc', 'Date', 'Message-ID', 'Reply-To']:
        value = original.get(name)
        if value:
            message[name] = clean(value)
    for name, value in [('Subject', subject or '(No subject)'), ('From', sender),
                        *((recipients or {}).items())]:
        if name not in message and value:
            message[name] = clean(value)
    if 'Date' not in message and date:
        message['Date'] = format_datetime(date.replace(tzinfo=date.tzinfo or timezone.utc))
    message.set_content(plain or ('' if html else 'No plain-text or HTML body is available in this Outlook item.'))
    if html:
        message.add_alternative(html, subtype='html')
    for attachment in attachments:
        if isinstance(attachment['data'], EmailMessage):
            message.add_attachment(attachment['data'], filename=attachment['name'])
        else:
            mime = attachment.get('mime') or mimetypes.guess_type(attachment['name'])[0] or 'application/octet-stream'
            if '/' not in mime:
                mime = 'application/octet-stream'
            main, sub = mime.split('/', 1)
            message.add_attachment(attachment['data'], maintype=main, subtype=sub,
                                   filename=attachment['name'], cid=attachment.get('cid'))
    return message


def msg_email(ole, prefix=(), depth=0):
    if depth > 12:
        raise ValueError('Embedded Outlook messages exceed the nesting limit.')

    def stream(tag):
        path = [*prefix, '__substg1.0_' + tag]
        return ole.openstream(path).read() if ole.exists(path) else b''

    def value(tag):
        wide = stream(tag + '001F')
        return wide.decode('utf-16-le', errors='replace').rstrip('\0') if wide else decode(stream(tag + '001E'))

    def fixed(base, tag, default=0):
        path = [*base, '__properties_version1.0']
        if not ole.exists(path):
            return default
        data = ole.openstream(path).read()
        offset = 32 if not base else 24 if base[-1] == '__substg1.0_3701000D' else 8
        for pos in range(offset, len(data) - 15, 16):
            if struct.unpack_from('<I', data, pos)[0] == tag:
                return struct.unpack_from('<Q', data, pos + 8)[0]
        return default

    children = {path[len(prefix)] for path in ole.listdir(streams=True, storages=True)
                if len(path) > len(prefix) and tuple(path[:len(prefix)]) == tuple(prefix)}
    recipients = {'To': [], 'Cc': [], 'Bcc': []}
    attachments = []
    for child in sorted(children):
        if child.startswith('__recip_version1.0_'):
            base = (*prefix, child)
            def recipient_value(tag):
                path = [*base, '__substg1.0_' + tag + '001F']
                if ole.exists(path):
                    return ole.openstream(path).read().decode('utf-16-le', errors='replace').rstrip('\0')
                path[-1] = '__substg1.0_' + tag + '001E'
                return decode(ole.openstream(path).read()) if ole.exists(path) else ''
            name = recipient_value('3001')
            address = recipient_value('39FE') or recipient_value('3003')
            display = formataddr((clean(name), clean(address))) if '@' in address else clean(name or address)
            kind = {1: 'To', 2: 'Cc', 3: 'Bcc'}.get(fixed(base, 0x0C150003), 'To')
            if display:
                recipients[kind].append(display)
        elif child.startswith('__attach_version1.0_'):
            base = (*prefix, child)
            def attachment_value(tag):
                for suffix, encoding in [('001F', 'utf-16-le'), ('001E', 'cp1252')]:
                    path = [*base, '__substg1.0_' + tag + suffix]
                    if ole.exists(path):
                        return ole.openstream(path).read().decode(encoding, errors='replace').rstrip('\0')
                return ''
            name = attachment_value('3707') or attachment_value('3704') or 'attachment'
            embedded = [*base, '__substg1.0_3701000D']
            binary = [*base, '__substg1.0_37010102']
            if ole.exists(embedded):
                content = msg_email(ole, tuple(embedded), depth + 1)
                name = Path(name).stem + '.eml'
            elif ole.exists(binary):
                content = ole.openstream(binary).read()
            else:
                raise ValueError(f'Outlook attachment "{name}" is externally linked or unsupported; it was not silently omitted.')
            attachments.append(dict(name=name, data=content, mime=attachment_value('370E'), cid=attachment_value('3712') or None))
    date = None
    ticks = fixed(prefix, 0x00390040) or fixed(prefix, 0x0E060040)
    if ticks:
        try:
            date = datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=ticks // 10)
        except OverflowError:
            pass
    sender_name = value('0C1A') or value('0042')
    sender_address = value('5D01') or value('0C1F') or value('0065')
    sender = formataddr((clean(sender_name), clean(sender_address))) if '@' in sender_address else clean(sender_name or sender_address)
    return build_email(headers=value('007D'), subject=value('0037'), sender=sender,
                       recipients={k: ', '.join(v) for k, v in recipients.items() if v}, date=date,
                       plain=value('1000'), html=decode(stream('10130102')) or value('1013'), attachments=attachments)


def import_msg(raw):
    import olefile
    with olefile.OleFileIO(io.BytesIO(raw)) as ole:
        if not any(path[0].startswith(('__substg1.0_', '__properties_version1.0')) for path in ole.listdir()):
            raise ValueError('This file is not an Outlook MSG message.')
        return msg_email(ole).as_bytes()


def pst_reader():
    vendor = Path(__file__).parent / 'vendor' / ('windows' if sys.platform == 'win32' else 'linux')
    sys.path.insert(0, str(vendor))
    try:
        import pypff
    except ImportError as error:
        raise ValueError('PST support needs the bundled Postbox runtime. Launch the new portable package, not a different Python installation.') from error
    return pypff


def pst_property(item, tag, default=None, record=None):
    if item is None and record is None:
        return default
    records = [record] if record is not None else [item.get_record_set(i) for i in range(item.number_of_record_sets)]
    for row in records:
        entry = row.get_entry_by_type(tag)
        if entry is None:
            continue
        kind = entry.value_type
        if kind in (0x001E, 0x001F):
            return entry.get_data_as_string()
        if kind in (0x0002, 0x0003, 0x0014):
            return entry.get_data_as_integer()
        if kind == 0x0040:
            return entry.get_data_as_datetime()
        return entry.get_data()
    return default


def pst_email(item):
    codepage = pst_property(item, 0x3FDE, 1252) or 1252
    name = item.sender_name or ''
    address = pst_property(item, 0x5D01) or pst_property(item, 0x0C1F, '')
    sender = formataddr((clean(name), clean(address))) if '@' in address else clean(name or address)
    recipients = {'To': [], 'Cc': [], 'Bcc': []}
    if item.recipients:
        for row in item.recipients.record_sets:
            display = pst_property(None, 0x3001, '', row)
            address = pst_property(None, 0x39FE, '', row) or pst_property(None, 0x3003, '', row)
            value = formataddr((clean(display), clean(address))) if '@' in address else clean(display or address)
            kind = {1: 'To', 2: 'Cc', 3: 'Bcc'}.get(pst_property(None, 0x0C15, 1, row), 'To')
            if value:
                recipients[kind].append(value)
    attachments = []
    for index in range(item.number_of_attachments):
        attachment = item.get_attachment(index)
        name = attachment.long_filename or pst_property(attachment, 0x3704) or f'attachment-{index + 1}'
        try:
            size = attachment.size or 0
            data = attachment.read_buffer(size)
        except OSError as error:
            raise ValueError(f'Cannot read PST attachment "{name}"; import was stopped to avoid silently losing it.') from error
        attachments.append(dict(name=name, data=data, mime=pst_property(attachment, 0x370E), cid=pst_property(attachment, 0x3712)))
    return build_email(headers=item.transport_headers, subject=item.subject, sender=sender,
                       recipients={k: ', '.join(v) for k, v in recipients.items() if v},
                       date=item.client_submit_time or item.delivery_time,
                       plain=decode(item.plain_text_body, codepage), html=decode(item.html_body, codepage),
                       attachments=attachments)


def import_pst(path, parse_message, filename):
    with Path(path).open('rb') as source:
        if source.read(4) != b'!BDN':
            raise ValueError('This file does not have an Outlook PST signature.')
    reader = pst_reader().file()
    seen = set()
    result = []
    opened = False
    try:
        reader.open(str(path))
        opened = True
        def walk(folder, parents=()):
            if len(parents) > 64:
                raise ValueError('PST folder nesting exceeds the supported limit.')
            parts = (*parents, folder.name) if folder.name else parents
            for index in range(folder.number_of_sub_messages):
                item = folder.get_sub_message(index)
                if not hasattr(item, 'plain_text_body'):
                    continue
                kind = pst_property(item, 0x001A, '') or ''
                if kind and not kind.lower().startswith(('ipm.note', 'report.', 'ipm.schedule')):
                    continue
                if item.identifier in seen:
                    continue
                seen.add(item.identifier)
                raw = pst_email(item).as_bytes()
                message = parse_message(raw, f'{Path(filename).stem}-{len(result) + 1}.eml')
                message.update(outlookFolder='/'.join(parts), sourceFormat='pst')
                result.append(message)
            for index in range(folder.number_of_sub_folders):
                walk(folder.get_sub_folder(index), parts)
        walk(reader.get_root_folder())
        return result
    except OSError as error:
        raise ValueError('This PST could not be read. It may be damaged, encrypted, or an unsupported Outlook variant. Export it to EML/MBOX using Outlook first.') from error
    finally:
        if opened:
            reader.close()
