#!/usr/bin/env python3
"""Sync Excel price list from Google Drive to public/data/items.json."""

from __future__ import annotations

import json
import os
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

import openpyxl

DEFAULT_PRICE_LIST_URL = (
    "https://drive.google.com/uc?export=download&id=164mM2xKuTeVHUUXqruMT5OFt_MXmVzAi"
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def clean_text(value: Any) -> str:
    """Convert cell value to string, remove non-breaking spaces, and trim whitespace."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).replace("\xa0", " ").strip()


def is_numeric_price(value: Any) -> bool:
    """Return True if the cell value represents a numeric price."""
    if value is None or isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    text = clean_text(value).replace(",", "")
    if not text:
        return False
    try:
        float(text)
        return True
    except ValueError:
        return False


def has_no_background_fill(cell: Any) -> bool:
    """Return True if the cell has no background fill or rgb is 00000000 / FFFFFFFF."""
    fill = getattr(cell, "fill", None)
    if fill is None or not fill.fill_type or fill.fill_type == "none":
        return True
    fg = getattr(fill, "fgColor", None)
    if fg is None:
        return True
    if fg.type == "rgb":
        rgb = (fg.rgb or "").upper()
        return rgb in ("", "00000000", "FFFFFFFF")
    if fg.type == "indexed":
        # 64 = System Foreground (automatic), 65 = System Background (white/none)
        return fg.indexed in (64, 65)
    return False


def merge_pipe_separated(existing: str, incoming: str) -> str:
    """Append incoming text separated by ' | ' if it is not already present."""
    incoming = incoming.strip()
    if not incoming:
        return existing
    if not existing:
        return incoming
    parts = [part.strip() for part in existing.split(" | ") if part.strip()]
    if incoming.lower() not in {part.lower() for part in parts}:
        parts.append(incoming)
    return " | ".join(parts)


def download_xlsx(url: str, dest_path: Path) -> None:
    """Download the Excel workbook and verify it starts with a valid PK zip header."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()

    if not data.startswith(b"PK"):
        raise RuntimeError(
            "Downloaded file is not a valid .xlsx workbook (missing 'PK' zip header). "
            "Check that PRICE_LIST_URL points to a publicly downloadable .xlsx file."
        )

    dest_path.write_bytes(data)


def parse_workbook(xlsx_path: Path) -> list[dict[str, str]]:
    """Parse all sheets ('new print' sheets first) and deduplicate/merge by itemCode."""
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    sheet_names = wb.sheetnames
    ordered_sheets = [
        name for name in sheet_names if "new print" in name.lower()
    ] + [
        name for name in sheet_names if "new print" not in name.lower()
    ]

    items_by_code: dict[str, dict[str, str]] = {}

    for sheet_name in ordered_sheets:
        ws = wb[sheet_name]
        cur_main = ""
        cur_sub = ""

        for row_idx in range(1, ws.max_row + 1):
            cell_c = ws.cell(row=row_idx, column=3)
            cell_d = ws.cell(row=row_idx, column=4)
            cell_e = ws.cell(row=row_idx, column=5)

            code = clean_text(cell_c.value)
            desc = clean_text(cell_d.value)

            if code.isdigit() and len(code) >= 5:
                if code not in items_by_code:
                    items_by_code[code] = {
                        "itemCode": code,
                        "itemName": desc,
                        "category": cur_main,
                        "subCategory": cur_sub,
                    }
                else:
                    existing = items_by_code[code]
                    if not existing["itemName"] and desc:
                        existing["itemName"] = desc
                    existing["category"] = merge_pipe_separated(
                        existing["category"], cur_main
                    )
                    existing["subCategory"] = merge_pipe_separated(
                        existing["subCategory"], cur_sub
                    )
            elif desc and desc.lower() != "description":
                if is_numeric_price(cell_e.value):
                    continue
                if "circuit driver" in desc.lower():
                    cur_sub = desc
                elif has_no_background_fill(cell_d):
                    cur_main = desc
                    cur_sub = ""
                else:
                    cur_sub = desc

    wb.close()
    return list(items_by_code.values())


def main() -> None:
    url = os.environ.get("PRICE_LIST_URL", "").strip() or DEFAULT_PRICE_LIST_URL
    repo_root = Path(__file__).resolve().parent.parent
    output_path = repo_root / "public" / "data" / "items.json"

    tmp_fd, tmp_name = tempfile.mkstemp(suffix=".xlsx")
    os.close(tmp_fd)
    tmp_path = Path(tmp_name)

    try:
        download_xlsx(url, tmp_path)
        items = parse_workbook(tmp_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, separators=(",", ":"))
        print(f"Synced {len(items)} items to {output_path}")
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


if __name__ == "__main__":
    main()
