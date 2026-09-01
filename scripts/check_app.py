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
