"""MIME edits and MBOX rebuilds for explicitly selected source files."""
import hashlib
import mailbox
import re
import tempfile
from email import policy
from email.parser import BytesParser
from pathlib import Path


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def is_attachment(part):
    return bool(part.get_filename() or part.get_content_disposition() == 'attachment'
                or part.get_content_maintype() != 'text')


def remove_attachments(raw, selected):
    message = BytesParser(policy=policy.default).parsebytes(raw)
    index = 0

    def keep(part):
        nonlocal index
        if part.is_multipart() and part.get_content_type() != 'message/rfc822':
            part.set_payload([child for child in part.get_payload() if keep(child)])
            return True
        if is_attachment(part):
            current = index
            index += 1
            return current not in selected
        return True

    if not keep(message):
        raise ValueError('Cannot remove the entire root message as an attachment.')
    if any(not isinstance(i, int) or i < 0 or i >= index for i in selected):
        raise ValueError('An attachment selection is no longer valid.')
    return message.as_bytes(policy=policy.SMTP)


def rebuild_source(source, records):
    if not source['filename'].lower().endswith(('.mbox', '.mbx')):
        return records[0]['raw'] if records else None
    # Preserve original From_ envelope lines while mailbox handles escaping and
    # message boundaries. Non-selected message bodies remain unchanged.
    with tempfile.TemporaryDirectory(prefix='postbox-edit-') as folder:
        path = Path(folder) / 'original.mbox'
        path.write_bytes(source['raw'])
        original = mailbox.mbox(path, create=False)
        output_path = Path(folder) / 'updated.mbox'
        output = mailbox.mbox(output_path)
        try:
            for record in records:
                item = mailbox.mboxMessage(record['raw'])
                item.set_from(original.get_message(record['sourceIndex']).get_from())
                output.add(item)
            output.flush()
            return output_path.read_bytes()
        finally:
            output.close()
            original.close()


def safe_filename(name):
    name = name.replace('\\', '/').split('/')[-1]
    name = re.sub(r'[\x00-\x1f<>:"/\\|?*]', '_', name).strip(' .')[:160]
    if not name:
        name = 'attachment'
    if name.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL',
                                      *(f'COM{i}' for i in range(1, 10)),
                                      *(f'LPT{i}' for i in range(1, 10))}:
        name = '_' + name
    return name
