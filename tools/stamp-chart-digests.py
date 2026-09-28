#!/usr/bin/env python3
"""Write published image digests into the chart so a packaged chart deploys without extra values.

Usage: stamp-chart-digests.py RELEASE_DIR [VALUES_FILE]
RELEASE_DIR holds the buildx metadata files web.json, api.json and worker.json.
"""
import json
import pathlib
import re
import sys

ROLES = ('web', 'api', 'worker')
DIGEST = re.compile(r'^sha256:[a-f0-9]{64}$')

release = pathlib.Path(sys.argv[1])
values = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'charts/canfactory/values.yaml')
lines = values.read_text().splitlines(keepends=True)

role = None
stamped = set()
for index, line in enumerate(lines):
    header = re.match(r'^  (\w+):\s*$', line)
    if header:
        role = header.group(1)
        continue
    if not line.startswith('  '):
        role = None
        continue
    if role in ROLES and re.match(r'^    digest: ""\s*$', line):
        digest = json.loads((release / f'{role}.json').read_text())['containerimage.digest']
        if not DIGEST.match(digest):
            sys.exit(f'{role}: unexpected digest {digest!r}')
        lines[index] = f'    digest: "{digest}"\n'
        stamped.add(role)

if stamped != set(ROLES):
    sys.exit(f'Expected empty digests for {", ".join(ROLES)}; stamped only {sorted(stamped)}')
values.write_text(''.join(lines))
print('Stamped chart digests:', ', '.join(ROLES))
