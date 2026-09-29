#!/usr/bin/env python3
"""Compare the reviewed directory against public GitHub Pages repository status."""
import json
from pathlib import Path
import urllib.request
import sys

repos = []
page = 1
while True:
    request = urllib.request.Request(f'https://api.github.com/users/mguhlin/repos?per_page=100&page={page}', headers={'User-Agent': 'Creations-directory-inventory'})
    with urllib.request.urlopen(request, timeout=30) as response:
        batch = json.load(response)
    repos.extend(batch)
    if len(batch) < 100:
        break
    page += 1
active = {r['name'] for r in repos if r['has_pages'] and not r['archived'] and r['name'] != 'mguhlin.github.io'}
curated = {p['repo'] for p in json.loads((Path(__file__).resolve().parents[1] / 'data/projects.json').read_text())}
print('New published repositories:', ', '.join(sorted(active - curated)) or 'none')
print('Entries needing review:', ', '.join(sorted(curated - active)) or 'none')
print(f'{len(curated)} indexed / {len(active)} active published repositories')
sys.exit(active != curated)
