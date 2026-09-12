#!/usr/bin/env python3
"""Stage this artifact bundle into the existing runner without replacing files."""

import json
import os
import subprocess
import sys
from pathlib import Path


def main():
    bundle = Path(__file__).resolve().parent
    project = bundle.parents[2]
    evidence = bundle / 'evidence'
    evidence.mkdir(exist_ok=True)
    sources = sorted(path for path in (bundle / 'tests').rglob('*') if path.is_file())
    if not sources:
        raise RuntimeError('No generated test files found')
    copies = [(source, project / source.relative_to(bundle)) for source in sources]
    for _, target in copies:
        if target.exists() or target.is_symlink():
            raise RuntimeError(f'Refusing to overwrite existing file: {target}')

    activated = []
    cleanup = []
    command = sys.argv[1:] or [
        'npx', 'playwright', 'test',
        'tests/api/event-helper-calendar-day-offsets.spec.ts',
        'tests/e2e/settings/event-helper-calendar-day-offsets.spec.ts',
        '--project=api', '--project=chromium', '--workers=2',
        '--reporter=line,json', f'--output={evidence / "playwright-output"}',
    ]
    try:
        for source, target in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            content = source.read_bytes()
            with target.open('xb') as destination:
                activated.append((target, content))
                destination.write(content)

        env = {
            **os.environ,
            'PLAYWRIGHT_HTML_OPEN': 'never',
            'PLAYWRIGHT_JSON_OUTPUT_FILE': str(evidence / 'playwright.json'),
        }
        return subprocess.run(command, cwd=project, env=env, check=False).returncode
    finally:
        for target, content in reversed(activated):
            if target.is_file() and not target.is_symlink() and target.read_bytes() == content:
                target.unlink()
                cleanup.append({'path': str(target.relative_to(project)), 'status': 'removed'})
            else:
                cleanup.append({'path': str(target.relative_to(project)), 'status': 'preserved'})
                print(f'Preserved missing or concurrently modified file: {target}', file=sys.stderr)
        (evidence / 'staging-cleanup.json').write_text(json.dumps(cleanup, indent=2) + '\n')


if __name__ == '__main__':
    sys.exit(main())
