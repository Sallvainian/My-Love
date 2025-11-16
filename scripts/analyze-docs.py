#!/usr/bin/env python3
"""
Documentation Analysis Tool
Categorizes markdown files into: deletable, updateable, current
"""

import json
import sys
from pathlib import Path
from datetime import datetime

def load_audit_report(path: str) -> dict:
    """Load the JSON audit report."""
    with open(path, 'r') as f:
        return json.load(f)

def categorize_file(file_info: dict) -> str:
    """
    Categorize a file based on multiple signals.

    Categories:
    - DELETE_CANDIDATE: Safe to delete (one-off, outdated, duplicate)
    - UPDATE_REQUIRED: Important but needs refresh
    - CURRENT: No action needed
    - REVIEW_NEEDED: Manual inspection required
    """
    path = file_info['path']
    days_old = file_info['days_old']
    git_commits = file_info['git_commits']
    has_outdated = file_info['has_outdated_markers']
    word_count = file_info['word_count']

    # PRESERVE HISTORICAL FILES - These are project evolution records
    # Archive files and story files are valuable historical documentation
    if '.archive/' in path or 'docs/stories/' in path or 'sprint-artifacts/' in path:
        return 'CURRENT'  # Preserve as historical documentation

    # Pattern-based deletion candidates (only ephemeral files)
    delete_patterns = [
        '.context.xml',  # XML context files are ephemeral
        'project-scan-report',  # Scan reports are snapshots (not historical docs)
    ]

    for pattern in delete_patterns:
        if pattern in path:
            return 'DELETE_CANDIDATE'

    # Untracked files over 30 days - likely abandoned
    # But NOT if they're in claudedocs/ or other important dirs
    if git_commits == 0 and days_old > 30:
        if 'claudedocs/' not in path:
            return 'DELETE_CANDIDATE'

    # Files with outdated markers
    if has_outdated:
        return 'UPDATE_REQUIRED'

    # Old files with no recent updates
    if days_old > 60 and git_commits < 3:
        return 'UPDATE_REQUIRED'

    # Duplicate content indicators (be very conservative)
    if 'copy' in path.lower() or 'backup' in path.lower():
        if '.archive/' not in path:  # Archives are intentional
            return 'REVIEW_NEEDED'  # Changed from DELETE to REVIEW

    # Very small files might be stubs
    if word_count < 50 and days_old > 30:
        return 'REVIEW_NEEDED'

    # Recent and actively maintained
    if days_old < 14 and git_commits > 0:
        return 'CURRENT'

    # Default to review needed
    return 'REVIEW_NEEDED'

def analyze_duplicates(files: list) -> dict:
    """Identify potential duplicate documentation."""
    duplicates = {}

    # Group by similar names
    name_groups = {}
    for f in files:
        base_name = Path(f['path']).stem.lower()
        # Remove common suffixes
        for suffix in ['-v2', '-old', '-new', '-copy', '-backup']:
            base_name = base_name.replace(suffix, '')

        if base_name not in name_groups:
            name_groups[base_name] = []
        name_groups[base_name].append(f['path'])

    # Flag groups with multiple files
    for name, paths in name_groups.items():
        if len(paths) > 1:
            duplicates[name] = paths

    return duplicates

def generate_report(audit_path: str, output_path: str):
    """Generate the final categorization report."""
    data = load_audit_report(audit_path)

    categories = {
        'DELETE_CANDIDATE': [],
        'UPDATE_REQUIRED': [],
        'CURRENT': [],
        'REVIEW_NEEDED': []
    }

    for file_info in data['files']:
        category = categorize_file(file_info)
        categories[category].append({
            'path': file_info['path'],
            'reason': get_reason(file_info, category),
            'days_old': file_info['days_old'],
            'word_count': file_info['word_count']
        })

    # Sort by days old (oldest first for deletions, newest first for updates)
    categories['DELETE_CANDIDATE'].sort(key=lambda x: -x['days_old'])
    categories['UPDATE_REQUIRED'].sort(key=lambda x: -x['days_old'])

    duplicates = analyze_duplicates(data['files'])

    report = {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_files': len(data['files']),
            'delete_candidates': len(categories['DELETE_CANDIDATE']),
            'update_required': len(categories['UPDATE_REQUIRED']),
            'current': len(categories['CURRENT']),
            'review_needed': len(categories['REVIEW_NEEDED']),
            'potential_duplicates': len(duplicates)
        },
        'categories': categories,
        'duplicates': duplicates
    }

    with open(output_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"Report generated: {output_path}")
    print(f"\nSummary:")
    print(f"  Total files analyzed: {report['summary']['total_files']}")
    print(f"  Delete candidates: {report['summary']['delete_candidates']}")
    print(f"  Need updates: {report['summary']['update_required']}")
    print(f"  Current/OK: {report['summary']['current']}")
    print(f"  Need manual review: {report['summary']['review_needed']}")
    print(f"  Potential duplicates: {report['summary']['potential_duplicates']}")

def get_reason(file_info: dict, category: str) -> str:
    """Generate human-readable reason for categorization."""
    if category == 'DELETE_CANDIDATE':
        if '.context.xml' in file_info['path']:
            return "XML context file (ephemeral)"
        if file_info['git_commits'] == 0 and file_info['days_old'] > 30:
            return f"Untracked for {file_info['days_old']} days"
        if '.archive/' in file_info['path']:
            return "In archive directory"
        return "Matches deletion pattern"

    if category == 'UPDATE_REQUIRED':
        if file_info['has_outdated_markers']:
            return "Contains outdated markers"
        return f"No updates in {file_info['days_old']} days"

    if category == 'CURRENT':
        return "Recently maintained"

    return "Needs manual inspection"

if __name__ == '__main__':
    audit_path = 'docs/audit-report.json'
    output_path = 'docs/documentation-cleanup-report.json'

    if len(sys.argv) > 1:
        audit_path = sys.argv[1]
    if len(sys.argv) > 2:
        output_path = sys.argv[2]

    generate_report(audit_path, output_path)
