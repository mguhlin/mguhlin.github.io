#!/usr/bin/env python3
"""Compare the reviewed directory against public GitHub Pages repository status."""
import json
from pathlib import Path
import urllib.request
import sys

ROOT = Path(__file__).resolve().parents[1]
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
# Keep the owner's directory exclusion without changing the published dev site.
excluded = {'mguhlin.github.io', 'dev'}
active = {r['name'] for r in repos if r['has_pages'] and not r['archived'] and r['name'] not in excluded}
projects = json.loads((ROOT / 'data/projects.json').read_text())
curated = {p['repo'] for p in projects if p['repo'] != 'mguhlin.github.io'}
# Games published inside the root site have no separate repository to discover.
local_games = {
    'https://mguhlin.github.io/' + path.parent.relative_to(ROOT).as_posix() + '/'
    for path in (ROOT / 'games').rglob('index.html')
}
missing_games = local_games - {p['url'] for p in projects}
print('New published repositories:', ', '.join(sorted(active - curated)) or 'none')
print('Entries needing review:', ', '.join(sorted(curated - active)) or 'none')
print('Unlisted local games:', ', '.join(sorted(missing_games)) or 'none')
print(f'{len(curated)} indexed / {len(active)} active published repositories')
sys.exit(active != curated or bool(missing_games))
