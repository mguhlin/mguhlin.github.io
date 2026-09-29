#!/usr/bin/env python3
"""Check published launch destinations; never modify a site or repository."""
import concurrent.futures
import json
from pathlib import Path
import urllib.request
import sys

projects = json.loads((Path(__file__).resolve().parents[1] / 'data/projects.json').read_text())
def check(project):
    try:
        request = urllib.request.Request(project['url'], headers={'User-Agent': 'Creations-directory-link-check'})
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read(1024)
            return project['repo'], response.status, response.url
    except Exception as error:
        return project['repo'], 'ERROR', str(error)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(check, projects))
for name, status, detail in results:
    print(f'{status} {name}: {detail}')
sys.exit(any(status != 200 for _, status, _ in results))
