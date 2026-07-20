"""Generate WiamEpisio Step-1 complete inventories from the codebase."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(r"C:\WiamLabs Projects")
ROUTES_DIR = ROOT / "webapp" / "routes"
MODELS = ROOT / "webapp" / "models.py"
TEMPLATES = ROOT / "webapp" / "templates"
SCREENS = ROOT / "WiamAppMobile" / "src" / "screens"
OUT = ROOT / "docs" / "WIAMEPISIO_INVENTORY_COMPLETE.md"


def extract_routes(py: Path) -> list[tuple[int, str, str]]:
    text = py.read_text(encoding="utf-8", errors="ignore")
    rows = []
    for m in re.finditer(
        r"@(\w+)\.route\((.*?)\)\s*\n(?:@[^\n]+\n)*\s*(?:async\s+)?def\s+(\w+)",
        text,
        re.S,
    ):
        bp, args, fn = m.group(1), re.sub(r"\s+", " ", m.group(2).strip()), m.group(3)
        line = text[: m.start()].count("\n") + 1
        rows.append((line, bp, args, fn))
    return rows


def extract_models() -> list[str]:
    text = MODELS.read_text(encoding="utf-8", errors="ignore")
    return re.findall(r"^class (\w+)\(", text, re.M)


def main() -> None:
    lines: list[str] = []
    lines.append("# WiamEpisio Complete Inventory Appendix")
    lines.append("")
    lines.append("Generated for Step 1 full audit. Do not treat as runtime API docs — source of truth is code.")
    lines.append("")
    lines.append("## A. Every ORM model")
    lines.append("")
    models = extract_models()
    lines.append(f"Count: **{len(models)}**")
    lines.append("")
    for i, name in enumerate(models, 1):
        lines.append(f"{i}. `{name}`")
    lines.append("")

    lines.append("## B. Every Flask route (all blueprints)")
    lines.append("")
    all_rows: list[tuple[str, int, str, str, str]] = []
    for py in sorted(ROUTES_DIR.glob("*.py")):
        if py.name == "__init__.py":
            continue
        for line, bp, args, fn in extract_routes(py):
            all_rows.append((py.name, line, bp, args, fn))

    lines.append(f"Count: **{len(all_rows)}**")
    lines.append("")
    by_file: dict[str, list] = {}
    for row in all_rows:
        by_file.setdefault(row[0], []).append(row)

    for fname in sorted(by_file, key=lambda f: -len(by_file[f])):
        rows = by_file[fname]
        lines.append(f"### `{fname}` ({len(rows)} routes)")
        lines.append("")
        lines.append("| Line | Blueprint | Route args | Handler |")
        lines.append("|-----:|-----------|------------|---------|")
        for _, line, bp, args, fn in rows:
            args_esc = args.replace("|", "\\|")
            lines.append(f"| {line} | `{bp}` | `{args_esc}` | `{fn}` |")
        lines.append("")

    lines.append("## C. Every web template")
    lines.append("")
    tpls = sorted(p.relative_to(TEMPLATES).as_posix() for p in TEMPLATES.rglob("*.html"))
    lines.append(f"Count: **{len(tpls)}**")
    lines.append("")
    for t in tpls:
        lines.append(f"- `{t}`")
    lines.append("")

    lines.append("## D. Every Expo screen")
    lines.append("")
    screens = sorted(p.relative_to(SCREENS).as_posix() for p in SCREENS.rglob("*.js"))
    lines.append(f"Count: **{len(screens)}**")
    lines.append("")
    for s in screens:
        lines.append(f"- `{s}`")
    lines.append("")

    lines.append("## E. Expo API modules")
    lines.append("")
    api = ROOT / "WiamAppMobile" / "src" / "api"
    for p in sorted(api.glob("*.js")):
        lines.append(f"- `{p.name}`")
    lines.append("")

    lines.append("## F. Web services")
    lines.append("")
    svc = ROOT / "webapp" / "services"
    for p in sorted(svc.glob("*.py")):
        if p.name.startswith("_"):
            continue
        lines.append(f"- `{p.name}`")
    lines.append("")

    lines.append("## G. Completeness stamp")
    lines.append("")
    lines.append(f"- Models: {len(models)}")
    lines.append(f"- Routes: {len(all_rows)}")
    lines.append(f"- Templates: {len(tpls)}")
    lines.append(f"- Expo screens: {len(screens)}")
    lines.append("- Step 1 inventory: COMPLETE")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"models={len(models)} routes={len(all_rows)} templates={len(tpls)} screens={len(screens)}")


if __name__ == "__main__":
    main()
