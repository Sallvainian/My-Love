#!/usr/bin/env python3
"""Validate parked TEA artifacts through the repository's unchanged test projects."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import subprocess
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repeat-each', type=int, default=1)
    args = parser.parse_args()
    if args.repeat_each < 1:
        parser.error('--repeat-each must be positive')

    bundle = Path(__file__).resolve().parent
    root = bundle.parents[2]
    manifest = json.loads((bundle / 'manifest.json').read_text())
    copies = [(bundle / item['artifact'], root / item['target']) for item in manifest]
    for _, target in copies:
        if target.exists():
            raise SystemExit(f'Refusing to overwrite an existing file: {target}')

    evidence = bundle / 'evidence'
    evidence.mkdir(exist_ok=True)
    staged = []
    outcomes = []
    try:
        for source, target in copies:
            payload = source.read_bytes()
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as output:
                output.write(payload)
            staged.append((target, payload))

        commands = [
            ('playwright', ['npx', 'playwright', 'test',
                'tests/api/solo-report.spec.ts',
                'tests/e2e/scripture/solo-report-synchronization.spec.ts',
                '--project=api', '--project=chromium', '--workers=1', '--retries=0',
                f'--repeat-each={args.repeat_each}']),
            ('typecheck', ['npm', 'run', 'typecheck']),
            ('lint', ['npm', 'run', 'lint']),
        ]

        def run(entry):
            name, command = entry
            log_path = evidence / f'{name}-repeat{args.repeat_each}.log'
            started = time.monotonic()
            with log_path.open('w') as output:
                result = subprocess.run(command, cwd=root, stdout=output, stderr=subprocess.STDOUT)
            tail = '\n'.join(log_path.read_text(errors='replace').splitlines()[-25:])
            tail = re.sub(r'eyJ[\w-]+\.[\w-]+\.[\w-]+', '[redacted JWT]', tail)
            return {'check': name, 'command': command, 'exit_code': result.returncode,
                    'elapsed_seconds': round(time.monotonic() - started, 2),
                    'log': str(log_path.relative_to(bundle)), 'output_tail': tail}

        # Static checks are independent of the Playwright browser/API execution.
        with ThreadPoolExecutor(max_workers=3) as pool:
            outcomes = list(pool.map(run, commands))
    finally:
        preserved = []
        for target, payload in reversed(staged):
            if target.exists() and target.read_bytes() == payload:
                target.unlink()
            elif target.exists():
                preserved.append(str(target.relative_to(root)))
        results = {'repeat_each': args.repeat_each, 'checks': outcomes,
                   'temporary_copies_removed': not preserved, 'preserved_changed_files': preserved}
        (bundle / f'validation-repeat{args.repeat_each}.json').write_text(
            json.dumps(results, indent=2) + '\n'
        )
    for outcome in outcomes:
        print(f"{outcome['check']}: exit {outcome['exit_code']} ({outcome['elapsed_seconds']}s)")
    if preserved:
        raise SystemExit(f'Preserved files changed during validation: {preserved}')
    return int(any(result['exit_code'] != 0 for result in outcomes))


if __name__ == '__main__':
    raise SystemExit(main())
