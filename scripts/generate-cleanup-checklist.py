#!/usr/bin/env python3
"""
Generate a markdown checklist from the documentation cleanup report.
"""

import json
from datetime import datetime

def generate_checklist(report_path: str, output_path: str):
    """Create human-readable cleanup checklist."""

    with open(report_path, 'r') as f:
        report = json.load(f)

    lines = [
        "# Documentation Cleanup Checklist",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Summary",
        f"- Total files: {report['summary']['total_files']}",
        f"- Delete candidates: {report['summary']['delete_candidates']}",
        f"- Need updates: {report['summary']['update_required']}",
        f"- Manual review: {report['summary']['review_needed']}",
        f"- Current/OK: {report['summary']['current']}",
        "",
        "---",
        "",
    ]

    # Delete candidates
    lines.append(f"## DELETE CANDIDATES ({report['summary']['delete_candidates']} files)")
    lines.append("")
    lines.append("Files safe to delete. Review before deletion.")
    lines.append("")

    for item in report['categories']['DELETE_CANDIDATE']:
        lines.append(f"- [ ] `{item['path']}`")
        lines.append(f"  - Reason: {item['reason']}")
        lines.append(f"  - Age: {item['days_old']} days, Words: {item['word_count']}")
        lines.append("")

    # Update required
    lines.append(f"## UPDATE REQUIRED ({report['summary']['update_required']} files)")
    lines.append("")
    lines.append("Important documents that are outdated and need refresh.")
    lines.append("")

    for item in report['categories']['UPDATE_REQUIRED']:
        lines.append(f"- [ ] `{item['path']}`")
        lines.append(f"  - Reason: {item['reason']}")
        lines.append(f"  - Age: {item['days_old']} days, Words: {item['word_count']}")
        lines.append("")

    # Manual review
    lines.append(f"## MANUAL REVIEW NEEDED ({report['summary']['review_needed']} files)")
    lines.append("")
    lines.append("Files that need human judgment to categorize.")
    lines.append("")

    for item in report['categories']['REVIEW_NEEDED']:
        lines.append(f"- [ ] `{item['path']}`")
        lines.append(f"  - Reason: {item['reason']}")
        lines.append(f"  - Age: {item['days_old']} days, Words: {item['word_count']}")
        lines.append("")

    # Duplicates
    if report['duplicates']:
        lines.append("## POTENTIAL DUPLICATES")
        lines.append("")
        lines.append("Files with similar names that may be duplicates.")
        lines.append("")

        for name, paths in report['duplicates'].items():
            lines.append(f"### {name}")
            for path in paths:
                lines.append(f"- [ ] `{path}`")
            lines.append("")

    # Current files (for reference)
    lines.append(f"## CURRENT FILES ({report['summary']['current']} files)")
    lines.append("")
    lines.append("These files are current and need no action.")
    lines.append("")

    for item in report['categories']['CURRENT'][:10]:  # Show first 10
        lines.append(f"- `{item['path']}`")

    if len(report['categories']['CURRENT']) > 10:
        remaining = len(report['categories']['CURRENT']) - 10
        lines.append(f"- ... and {remaining} more files")

    lines.append("")

    with open(output_path, 'w') as f:
        f.write('\n'.join(lines))

    print(f"Checklist generated: {output_path}")

if __name__ == '__main__':
    generate_checklist(
        'docs/documentation-cleanup-report.json',
        'docs/DOCUMENTATION_CLEANUP_CHECKLIST.md'
    )
