#!/usr/bin/env python3
"""Temporarily activate this TEA bundle, run a command, and remove its copies."""

import subprocess
import sys
from pathlib import Path


def main():
    bundle = Path(__file__).resolve().parent
    project = bundle.parents[2]
    sources = sorted(path for path in (bundle / 'tests').rglob('*') if path.is_file())
    if not sources:
        raise RuntimeError('No generated test files found')
    copies = [(source, project / source.relative_to(bundle)) for source in sources]
    for _, target in copies:
        if target.exists() or target.is_symlink():
            raise RuntimeError(f'Refusing to overwrite existing file: {target}')

    activated = []
    try:
        for source, target in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            content = source.read_bytes()
            with target.open('xb') as destination:
                destination.write(content)
            activated.append((target, content))

        command = sys.argv[1:] or [
            'npx', 'playwright', 'test',
            'tests/e2e/photos/own-photo-badge-contrast.spec.ts',
            '--project=chromium', '--workers=1',
        ]
        return subprocess.run(command, cwd=project, check=False).returncode
    finally:
        for target, content in reversed(activated):
            if target.exists() and target.read_bytes() == content:
                target.unlink()
            elif target.exists():
                print(f'Preserved concurrently modified file: {target}', file=sys.stderr)


if __name__ == '__main__':
    sys.exit(main())
