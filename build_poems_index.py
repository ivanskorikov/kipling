#!/usr/bin/env python3
"""Build site/data/poems.json from poems/ folder structure."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POEMS_DIR = ROOT / "poems"
OUT = Path(__file__).resolve().parent / "data" / "poems.json"


def parse_filename(name: str) -> dict | None:
    if not name.endswith(".txt"):
        return None
    stem = name[:-4]
    parts = stem.split(",", 3)
    if len(parts) != 4:
        return None
    lang, title, author, year_s = parts
    title = title.replace("@@@", ",")
    author = author.replace("@@@", ",")
    try:
        year = int(year_s)
    except ValueError:
        year = 0
    return {"lang": lang, "title": title, "author": author, "year": year, "file": name}


def main() -> int:
    poems: list[dict] = []
    for folder in sorted(POEMS_DIR.iterdir()):
        if not folder.is_dir():
            continue
        en = None
        translations: list[dict] = []
        for f in folder.iterdir():
            meta = parse_filename(f.name)
            if not meta:
                continue
            if meta["lang"] == "en":
                en = meta
            elif meta["lang"] == "ru":
                translations.append(
                    {
                        "title": meta["title"],
                        "translator": meta["author"],
                        "year": meta["year"],
                        "file": meta["file"],
                    }
                )
        if not en:
            continue
        translations.sort(key=lambda t: (t["translator"].lower(), t["title"].lower(), t["year"]))
        poems.append(
            {
                "id": folder.name,
                "title": en["title"],
                "year": en["year"],
                "author": en["author"],
                "enFile": en["file"],
                "translations": translations,
                "translationCount": len(translations),
            }
        )

    poems.sort(key=lambda p: (p["title"].lower(), p["year"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"poems": poems}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_tr = sum(1 for p in poems if p["translationCount"])
    print(f"Wrote {len(poems)} poems ({with_tr} with translations) -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
