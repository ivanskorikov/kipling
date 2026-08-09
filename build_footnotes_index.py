#!/usr/bin/env python3
"""Build site/data/footnotes.json from Complete Verse OCR notes."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from import_complete_verse import load_footnotes  # noqa: E402

OUT = Path(__file__).resolve().parent / "data" / "footnotes.json"


def main() -> int:
    notes = load_footnotes()
    entries = [{"id": str(n), "text": notes[n]} for n in sorted(notes)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"footnotes": entries, "count": len(entries)}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(entries)} footnotes -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
