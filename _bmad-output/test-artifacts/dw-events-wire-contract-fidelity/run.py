#!/usr/bin/env python3
"""Stage this artifact pack in the existing runner and remove unchanged copies."""

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path


API_SPEC = 'tests/api/events-wire-contract-fidelity.spec.ts'
E2E_SPEC = 'tests/e2e/settings/events-wire-fidelity.spec.ts'
MUTATIONS = {
    'loose-schema': (
        'const EventRowSchema = z.strictObject({',
        'const EventRowSchema = z.object({',
        'DE.5-API-004',
    ),
    'missing-owner': (
        ".select('id')\n        .eq('user_id', userId)\n        .eq('label', attemptLabel)",
        ".select('id')\n        .eq('label', attemptLabel)",
        'DE.5-API-007',
    ),
    'fixed-label': (
        'const attemptLabel = `${ANON_ATTEMPT_LABEL} ${randomUUID()}`;',
        'const attemptLabel = ANON_ATTEMPT_LABEL;',
        'DE.5-API-007',
    ),
}


def main():
    bundle = Path(__file__).resolve().parent
    project = bundle.parents[2]
    arguments = sys.argv[1:]
    mutation = None
    if arguments[:1] == ['--mutation']:
        if len(arguments) < 2 or arguments[1] not in MUTATIONS:
            raise ValueError(f'Choose one mutation: {", ".join(MUTATIONS)}')
        mutation = arguments[1]
        arguments = arguments[2:]

    manifest = json.loads((bundle / 'source-manifest.json').read_text())
    copies = []
    for entry in manifest['files']:
        relative = Path(entry['artifact_path'])
        if relative.is_absolute() or '..' in relative.parts or relative.parts[0] != 'tests':
            raise ValueError(f'Invalid staging path: {relative}')
        content = (bundle / relative).read_bytes()
        if hashlib.sha256(content).hexdigest() != entry['sha256']:
            raise RuntimeError(f'Artifact changed; regenerate its manifest: {relative}')
        if 'source_path' in entry:
            source = project / entry['source_path']
            if hashlib.sha256(source.read_bytes()).hexdigest() != entry['source_sha256']:
                raise RuntimeError(f'Active source changed; regenerate the API snapshot: {source}')
        if mutation and str(relative) == API_SPEC:
            old, new, _ = MUTATIONS[mutation]
            original = content.decode()
            if original.count(old) != 1:
                raise RuntimeError(f'Mutation target is no longer unique: {mutation}')
            content = original.replace(old, new).encode()
        target = project / relative
        if target.exists() or target.is_symlink():
            raise RuntimeError(f'Refusing to overwrite existing file: {target}')
        copies.append((target, content))

    activated = []
    try:
        for target, content in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as destination:
                activated.append((target, content))
                destination.write(content)

        default = [
            'npx', 'playwright', 'test', API_SPEC, E2E_SPEC,
            '--project=api', '--project=chromium', '--workers=2',
        ]
        if mutation:
            default = [
                'npx', 'playwright', 'test', API_SPEC, '--project=api',
                '--workers=2', '--grep', MUTATIONS[mutation][2],
            ]
        env = {**os.environ, 'TZ': 'America/New_York', 'PLAYWRIGHT_HTML_OPEN': 'never'}
        return subprocess.run(arguments or default, cwd=project, env=env, check=False).returncode
    finally:
        for target, content in reversed(activated):
            if target.is_file() and not target.is_symlink() and target.read_bytes() == content:
                target.unlink()
            elif target.exists() or target.is_symlink():
                print(f'Preserved concurrently modified file: {target}', file=sys.stderr)


if __name__ == '__main__':
    sys.exit(main())
