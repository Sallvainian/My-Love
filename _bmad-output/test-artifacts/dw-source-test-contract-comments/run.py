#!/usr/bin/env python3
"""Verify reference snapshots, then run their canonical tests without staging files."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--list', action='store_true', help='Discover tests without running them')
    parser.add_argument('--verify', action='store_true', help='Only verify snapshot provenance')
    parser.add_argument('--priority', choices=['P0', 'P1', 'P2', 'P3'])
    args = parser.parse_args()
    bundle = Path(__file__).resolve().parent
    project = bundle.parents[2]
    manifest = json.loads((bundle / 'source-manifest.json').read_text())
    selection = json.loads((bundle / 'test-selection.json').read_text())
    for entry in manifest['files']:
        for path in [project / entry['source'], bundle / entry['artifact']]:
            if hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
                raise RuntimeError(f'Snapshot drift: {path}. Refresh the artifact evidence before running.')
    print(f"Verified {len(manifest['files'])} source/snapshot pairs.", flush=True)
    if args.verify:
        return 0

    specs = [spec for spec in selection['specs']
             if args.priority is None or spec['priority_coverage'][args.priority] > 0]
    if not specs:
        parser.error(f'No selected cases have priority {args.priority}')
    command = ['npx', 'playwright', 'test', *[spec['file'] for spec in specs],
               *[f'--project={project_name}' for project_name in sorted({spec['project'] for spec in specs})],
               '--workers=1', '--retries=0', '--reporter=list,json',
               '--output=test-results/dw-source-test-contract-comments']
    if args.list:
        command.append('--list')
    if args.priority:
        command.extend(['--grep', rf'\[{args.priority}\]'])
    report_name = 'discovery.json' if args.list else 'results.json'
    report = project / 'test-results/dw-source-test-contract-comments' / report_name
    report.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, 'PLAYWRIGHT_HTML_OPEN': 'never',
           'PLAYWRIGHT_JSON_OUTPUT_NAME': str(report)}
    print('Running: ' + ' '.join(command), flush=True)
    return subprocess.run(command, cwd=project, env=env, check=False).returncode


if __name__ == '__main__':
    sys.exit(main())
