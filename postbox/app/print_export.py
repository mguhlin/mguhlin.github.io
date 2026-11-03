"""Offline print documents for single-message and selected-message PDF export."""
from html import escape
from html.parser import HTMLParser


class PrintBody(HTMLParser):
    # Never carry mail stylesheets, IDs, classes, active content or document wrappers
    # into the print document. Inline formatting is optional and CSP blocks URLs.
    tags = set('div span p br hr a img table thead tbody tfoot tr td th caption b strong i em u s small blockquote pre code ul ol li dl dt dd h1 h2 h3 h4 h5 h6 sup sub address'.split())
    void = {'br', 'hr', 'img'}

    def __init__(self, clean):
        super().__init__(convert_charrefs=True)
        self.clean, self.output, self.hidden = clean, [], []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag in ('head', 'style', 'script', 'iframe', 'object', 'template'):
            self.hidden.append(tag)
        if self.hidden or tag not in self.tags:
            return
        safe = []
        for key, value in attrs:
            if value is None:
                continue
            if key in ('alt', 'title', 'colspan', 'rowspan', 'dir', 'lang') or (
                key == 'style' and not self.clean
            ) or (tag == 'img' and key == 'src' and value.lower().startswith(
                ('data:image/png;', 'data:image/jpeg;', 'data:image/gif;', 'data:image/webp;', 'data:image/avif;')
            )):
                safe.append(f' {key}="{escape(value, quote=True)}"')
        self.output.append('<' + tag + ''.join(safe) + '>')
        if tag not in self.void:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if self.hidden:
            if tag == self.hidden[-1]:
                self.hidden.pop()
            return
        if tag in self.stack:
            while self.stack:
                closed = self.stack.pop()
                self.output.append(f'</{closed}>')
                if closed == tag:
                    break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, value):
        if not self.hidden:
            self.output.append(escape(value))


CSS = '''
@page { size: PAPER portrait; margin: 16mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #202124; background: white; font: 11pt/1.5 Arial, sans-serif; }
.print-tools { background: #f1eafa; padding: 18px; margin-bottom: 24px; font: 14px/1.5 Arial,sans-serif; }
button { font: inherit; padding: 10px 18px; cursor: pointer; }
.email + .email { break-before: page; page-break-before: always; }
.email-header { border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px; }
h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 12px; overflow-wrap: anywhere; }
.email-meta { display: grid; grid-template-columns: 70px minmax(0,1fr); gap: 4px 10px; font-size: 10pt; }
dt { font-weight: bold; } dd { margin: 0; overflow-wrap: anywhere; }
.email-number { color: #666; font-size: 9pt; margin: 0 0 8px; }
.plain { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
.attachment-list { border-top: 1px solid #ccc; margin-top: 20px; padding-top: 10px; font-size: 9pt; overflow-wrap: anywhere; }
.clean .email-body, .clean .email-body * {
  max-width: 100% !important; min-width: 0 !important; width: auto !important;
  height: auto !important; max-height: none !important; position: static !important;
  float: none !important; overflow: visible !important; white-space: normal !important;
  overflow-wrap: anywhere !important; word-break: normal !important;
}
.clean .email-body pre, .clean .email-body code, .clean .email-body .plain { white-space: pre-wrap !important; }
.clean .email-body table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse; }
.clean .email-body td, .clean .email-body th { border: 1px solid #ddd; padding: 5px; vertical-align: top; }
.clean .email-body img { object-fit: contain; max-height: 210mm !important; }
.clean .email-body blockquote { margin: 10px 0 10px 12px; padding-left: 12px; border-left: 2px solid #ccc; }
p, li { orphans: 3; widows: 3; }
h1, h2, h3 { break-after: avoid; }
@media screen { body { max-width: PAGEWIDTH; margin: 24px auto; padding: 0 16px; } .email { padding: 24px; border: 1px solid #ddd; margin-bottom: 24px; } }
@media print { .print-tools { display: none; } }
'''


def print_document(messages, clean=True, paper='letter'):
    if paper not in ('letter', 'a4'):
        raise ValueError('Choose Letter or A4 paper.')
    if not messages:
        raise ValueError('Select existing emails to export.')
    title = messages[0]['subject'] if len(messages) == 1 else f'Postbox — {len(messages)} emails'
    parts = []
    for index, message in enumerate(messages, 1):
        metadata = ''.join(f'<dt>{label}</dt><dd>{escape(str(message.get(key) or ""))}</dd>'
                           for label, key in [('From', 'sender'), ('To', 'to'), ('Cc', 'cc'), ('Date', 'date'), ('Folder', 'outlookFolder')]
                           if message.get(key))
        if message.get('html'):
            parser = PrintBody(clean)
            parser.feed(message['html'])
            while parser.stack:
                parser.output.append(f'</{parser.stack.pop()}>')
            body = ''.join(parser.output)
        else:
            body = '<pre class="plain">' + escape(message.get('plain') or message.get('bodyText') or 'No readable message body.') + '</pre>'
        attachments = message.get('attachments', [])
        listing = ('<div class="attachment-list"><strong>Attachments (names only)</strong><ul>' +
                   ''.join('<li>' + escape(a['name']) + '</li>' for a in attachments) + '</ul></div>') if attachments else ''
        parts.append(f'<section class="email"><header class="email-header"><p class="email-number">Email {index} of {len(messages)}</p><h1>{escape(message["subject"])}</h1><dl class="email-meta">{metadata}</dl></header><div class="email-body">{body}</div>{listing}</section>')
    css = CSS.replace('PAPER', 'Letter' if paper == 'letter' else 'A4').replace('PAGEWIDTH', '184mm' if paper == 'letter' else '178mm')
    # A restrictive policy also applies when this document is written into a new tab.
    policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="{policy}"><title>{escape(title)}</title><style>{css}</style></head><body class="{'clean' if clean else 'formatted'}"><div class="print-tools"><button id="printNow">Print / Save as PDF</button><p>{len(messages)} email(s) · {'Clean layout' if clean else 'Email formatting'} · {paper.upper()}. Choose <strong>Save as PDF</strong> in the print dialog. Each email starts on a new page. Match your paper size to this preview; disable browser headers and footers for a cleaner result.</p><p>Attachments are listed by name; their contents are not printed. Remote images remain blocked.</p></div>{''.join(parts)}</body></html>'''
