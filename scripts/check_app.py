#!/usr/bin/env python3
"""Dependency-free release checks for the Receipt DB static app."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    errors: list[str] = []
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    worker = (ROOT / "sw.js").read_text(encoding="utf-8")

    version_match = re.search(r"const APP_VERSION='(v[0-9.]+)'", index)
    version = version_match.group(1) if version_match else ""
    if not version:
        errors.append("APP_VERSION을 찾지 못했습니다")
    if version and f"· {version}" not in readme:
        errors.append("README 버전이 APP_VERSION과 다릅니다")
    if version and f"CACHE_NAME=CACHE_PREFIX+'{version}'" not in worker:
        errors.append("서비스 워커 캐시 버전이 APP_VERSION과 다릅니다")

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    for icon in manifest.get("icons", []):
        path = ROOT / str(icon.get("src", "")).removeprefix("./")
        if not path.is_file():
            errors.append(f"manifest 아이콘이 없습니다: {path.relative_to(ROOT)}")

    shell_match = re.search(r"const SHELL=\[(.*?)\];", worker, re.S)
    shell_paths = re.findall(r"'\./([^']*)'", shell_match.group(1) if shell_match else "")
    for relative in shell_paths:
        if relative and not (ROOT / relative).is_file():
            errors.append(f"오프라인 셸 파일이 없습니다: {relative}")

    category_assets = re.findall(r"'[^']+':'(icons/categories/[^']+\.svg)'", index)
    if len(set(category_assets)) != 16:
        errors.append(f"카테고리 SVG가 16종이 아닙니다: {len(set(category_assets))}종")
    for relative in set(category_assets):
        if not (ROOT / relative).is_file():
            errors.append(f"카테고리 SVG가 없습니다: {relative}")
    old_category_pngs = sorted((ROOT / "icons/categories").glob("*.png"))
    if old_category_pngs:
        errors.append("대체된 카테고리 PNG가 남아 있습니다: " + ", ".join(path.name for path in old_category_pngs))
    expected_order = "['외식','카페','술집','노래방','쇼핑','영화','교통','여행','숙박','골프','스파','운동','케이크','경조사','병원·약국','기타']"
    if f"const BASE_CATEGORIES={expected_order}" not in index:
        errors.append("카테고리 4×4 표시 순서가 디자인 순서와 다릅니다")
    expected_labels = "{'케이크':'기념','영화':'문화','병원·약국':'의료','경조사':'경조'}"
    if f"const CATEGORY_LABELS={expected_labels}" not in index:
        errors.append("카테고리 표시 이름이 디자인 명칭과 다릅니다")

    if index.count('<circle cx="12" cy="13" r="3.5"/>') != 3:
        errors.append("사진 없음 렌즈 아이콘 세 위치가 서로 다릅니다")
    if '<circle cx="12" cy="14" r="4"/>' in index:
        errors.append("이전 사진 없음 렌즈 좌표가 남아 있습니다")

    for stale in ("_dbxCollectSyncImages", "_reRenderDetailItems", "consolidateReceiptFolders", "importFromAppFolder"):
        if re.search(rf"\b{re.escape(stale)}\b", index):
            errors.append(f"정리 대상 함수가 남아 있습니다: {stale}")
    if (ROOT / "receipt-db").exists() and any((ROOT / "receipt-db").iterdir()):
        errors.append("오래된 receipt-db/ 중복 폴더가 남아 있습니다")
    if re.search(r'data-id="\$\{(?:r\.id|it\.receiptId)\}"', index):
        errors.append("이스케이프하지 않은 영수증 ID 속성이 남아 있습니다")

    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print(f"OK: Receipt DB {version} release checks passed ({len(shell_paths)} offline shell files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
