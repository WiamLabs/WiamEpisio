"""WiamApp wire-audit (Push 11).

Static scan of every TouchableOpacity / Pressable / Button in the
mobile app and reports any that look unwired:
    - ``onPress={() => {}}`` (no-op arrow function).
    - ``onPress={null}`` / ``onPress={undefined}`` / missing onPress.
    - ``onPress={() => null}`` (deliberate no-op but still flagged).

Run from the repo root::

    python scripts/qa/wire_audit.py
    python scripts/qa/wire_audit.py --json
    python scripts/qa/wire_audit.py --strict      # exit 1 if any issues

The script is intentionally conservative: when in doubt it shows the
finding for human review rather than auto-failing CI. With ``--strict``
it returns a non-zero exit code if any explicit no-ops are found
(``onPress={() => {}}`` etc).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List

# Components we treat as "interactive". Add more here as the app grows.
INTERACTIVE_COMPONENTS = (
    'TouchableOpacity',
    'TouchableHighlight',
    'TouchableWithoutFeedback',
    'Pressable',
    'Button',
)

# Patterns that look like a real handler (we'll consider these "wired").
# Anything else is treated as suspicious.
WIRED_HINT = re.compile(
    r'onPress\s*=\s*\{[^}]{0,300}\}',
    re.IGNORECASE,
)
NOOP_PATTERNS = (
    re.compile(r'onPress\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}'),
    re.compile(r'onPress\s*=\s*\{\s*\(\s*\)\s*=>\s*null\s*\}'),
    re.compile(r'onPress\s*=\s*\{\s*null\s*\}'),
    re.compile(r'onPress\s*=\s*\{\s*undefined\s*\}'),
    re.compile(r'onPress\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*/\*\s*TODO[^*]*\*/\s*\}\s*\}'),
)
HAS_ON_PRESS = re.compile(r'onPress\s*=')


def find_target_files(root: Path) -> List[Path]:
    out: List[Path] = []
    src_root = root / 'WiamAppMobile' / 'src'
    if not src_root.exists():
        return out
    for p in src_root.rglob('*.js'):
        if 'node_modules' in p.parts:
            continue
        out.append(p)
    for p in src_root.rglob('*.jsx'):
        if 'node_modules' in p.parts:
            continue
        out.append(p)
    return out


def scan_file(path: Path) -> Dict:
    text = path.read_text(encoding='utf-8', errors='replace')

    interactive_count = 0
    missing_handlers: List[Dict] = []
    noop_handlers: List[Dict] = []

    # Naive but effective: walk each opening tag for an interactive component
    for comp in INTERACTIVE_COMPONENTS:
        for match in re.finditer(rf'<{comp}\b([^>]*?)(/?)>', text, flags=re.DOTALL):
            attrs = match.group(1) or ''
            interactive_count += 1
            line_no = text.count('\n', 0, match.start()) + 1
            snippet = match.group(0).replace('\n', ' ')[:160]

            if not HAS_ON_PRESS.search(attrs):
                # Some components legitimately don't need onPress (e.g. used as
                # layout wrappers). We'll only flag when the component looks
                # actionable (has an icon prop, hitSlop, or activeOpacity).
                actionable_hint = (
                    'activeOpacity' in attrs or 'hitSlop' in attrs or 'accessibilityRole' in attrs
                )
                if actionable_hint:
                    missing_handlers.append({
                        'component': comp,
                        'line': line_no,
                        'snippet': snippet,
                    })
                continue

            for noop_re in NOOP_PATTERNS:
                if noop_re.search(attrs):
                    noop_handlers.append({
                        'component': comp,
                        'line': line_no,
                        'snippet': snippet,
                    })
                    break

    return {
        'path': str(path),
        'interactive_count': interactive_count,
        'missing_handlers': missing_handlers,
        'noop_handlers': noop_handlers,
    }


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description='WiamApp mobile wire audit')
    ap.add_argument('--json', action='store_true', help='Emit JSON summary instead of text')
    ap.add_argument('--strict', action='store_true', help='Exit 1 if any no-op handlers found')
    ap.add_argument('--root', default='.', help='Repo root (default: cwd)')
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    files = find_target_files(root)
    if not files:
        print(f'wire_audit: no mobile source files found under {root}', file=sys.stderr)
        return 1

    report = []
    total_interactive = 0
    total_missing = 0
    total_noop = 0

    for f in files:
        try:
            r = scan_file(f)
        except Exception as e:  # pragma: no cover
            r = {
                'path': str(f),
                'interactive_count': 0,
                'missing_handlers': [],
                'noop_handlers': [],
                'error': str(e),
            }
        total_interactive += r['interactive_count']
        total_missing += len(r['missing_handlers'])
        total_noop += len(r['noop_handlers'])
        if r['interactive_count']:
            report.append(r)

    summary = {
        'files_scanned': len(files),
        'files_with_interactive': len(report),
        'total_interactive_components': total_interactive,
        'total_missing_handlers': total_missing,
        'total_noop_handlers': total_noop,
    }

    if args.json:
        print(json.dumps({'summary': summary, 'files': report}, indent=2))
    else:
        print('=' * 72)
        print('WiamApp mobile wire audit')
        print('=' * 72)
        print(f"Files scanned: {summary['files_scanned']}")
        print(f"Files with interactive components: {summary['files_with_interactive']}")
        print(f"Total interactive components: {summary['total_interactive_components']}")
        print(f"Total missing handlers (actionable, no onPress): {summary['total_missing_handlers']}")
        print(f"Total no-op handlers (onPress=()=>{{}} etc.): {summary['total_noop_handlers']}")
        print()
        if total_missing or total_noop:
            print('Findings:')
            for r in report:
                if not r['missing_handlers'] and not r['noop_handlers']:
                    continue
                rel = os.path.relpath(r['path'], root)
                print(f"  {rel}")
                for m in r['missing_handlers']:
                    print(f"    [missing] line {m['line']}: <{m['component']}>  -> {m['snippet']}")
                for m in r['noop_handlers']:
                    print(f"    [no-op]   line {m['line']}: <{m['component']}>  -> {m['snippet']}")
            print()
        else:
            print('No suspicious handlers found. Every interactive surface has a handler.')

    if args.strict and total_noop > 0:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
