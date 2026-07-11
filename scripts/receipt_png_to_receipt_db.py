#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
receipt_png_to_receipt_db.py — PNG/JPG 영수증 스크린샷 자동 등록

receipt_pdf_to_jpg.py 의 자매 스크립트. PDF 스캔 자동화는 기존 스크립트가
그대로 담당하고, 이 스크립트는 Dropbox 영수증 폴더에 들어온 PNG/JPG
(토스 전자영수증 스크린샷 등)만 처리한다:

  1. 감시 폴더(WATCH_DIR)에서 *.png / *.jpg / *.jpeg 파일을 찾고
  2. 파일명(또는 수정시각)에서 날짜를 추출해 이름을 바꾼 뒤
     `등록완료/YYYY-MM/` 하위 폴더로 이동(분류)하고
  3. receipt-db 앱의 수신함(receipt-db_inbox.json)에
     레코드 + 사진(base64)을 등록한다.

앱은 다음 Dropbox 동기화 때 inbox를 읽어 자동으로 머지한다.
매장명·품목·총액은 비워두므로, 앱 상세 화면의 '붙여넣기'(v1.60)로
GPT 결과를 채워 넣으면 된다.

사용법 (맥 터미널):
    python3 receipt_png_to_receipt_db.py            # 실제 실행
    python3 receipt_png_to_receipt_db.py --dry-run  # 뭘 할지 보기만

주의:
- inbox JSON은 receipt_pdf_to_jpg.py 도 쓰는 파일이므로 두 스크립트를
  동시에 실행하지 말 것 (순차 실행은 안전 — 기존 항목은 보존하며 추가만 함).
- Pillow(pip3 install Pillow)가 있으면 사진을 JPEG(최대 변 2000px, q85)로
  줄여서 inbox 용량을 아낀다. 없으면 원본 PNG를 그대로 base64로 넣는다.
- 레코드 ID는 rec_YYYYMMDD_p+해시6자리 — 앱(rec_YYYYMMDD_NNN)이나
  PDF 스크립트가 만드는 ID와 절대 충돌하지 않는 형식.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

# ───────────────────── 설정 (맥 환경에 맞게 확인/수정) ─────────────────────

# PNG/JPG를 떨어뜨리는 폴더 — PDF를 넣는 폴더와 같게 맞출 것
WATCH_DIR = Path.home() / "Library/CloudStorage/Dropbox/01_Personal/영수증"

# receipt-db 앱 데이터 폴더 (App folder 스코프의 라이브 로컬 미러 — CLAUDE.md 참고)
RECEIPT_DB_DIR = Path.home() / (
    "Library/CloudStorage/Dropbox/01_Personal/Apps/앱/Receipt_DB_v1"
    "/01_Personal/영수증/Receipt_DB"
)
INBOX_PATH = RECEIPT_DB_DIR / "receipt-db_inbox.json"

DONE_DIR_NAME = "등록완료"          # 처리 완료 파일이 이동되는 하위 폴더
EXTS = {".png", ".jpg", ".jpeg"}    # 처리 대상 확장자
MAX_SIDE = 2000                     # Pillow 사용 시 리사이즈 최대 변(px)
JPEG_QUALITY = 85

# ──────────────────────────────────────────────────────────────────────────

try:
    from PIL import Image  # type: ignore
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def parse_date_from_name(name):
    """파일명에서 YYYY-MM-DD 추출. 실패 시 None.
    지원 예: '2026-07-03 19.50.32.png', '사진 2026. 7. 3 19 50.png', 'IMG_20260703.png'"""
    m = re.search(r"(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})", name)
    if not m:
        m = re.search(r"(20\d{2})(\d{2})(\d{2})", name)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def file_date(path):
    """파일명 우선, 안 되면 파일 수정시각으로 날짜 결정."""
    d = parse_date_from_name(path.name)
    if d:
        return d
    return datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d")


def encode_image(path):
    """(base64문자열, mime) 반환. Pillow 있으면 JPEG로 축소, 없으면 원본 그대로."""
    raw = path.read_bytes()
    if HAS_PIL:
        try:
            img = Image.open(io.BytesIO(raw))
            img = img.convert("RGB")
            w, h = img.size
            if max(w, h) > MAX_SIDE:
                scale = MAX_SIDE / float(max(w, h))
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
            return base64.b64encode(buf.getvalue()).decode("ascii"), "image/jpeg"
        except Exception as e:
            print(f"  ! Pillow 변환 실패({e}) — 원본 그대로 등록")
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return base64.b64encode(raw).decode("ascii"), mime


def load_inbox():
    """inbox JSON 로드. 없거나 깨졌으면 새 구조 반환 (기존 키는 보존)."""
    if INBOX_PATH.exists():
        try:
            data = json.loads(INBOX_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("receipts"), list):
                data.setdefault("app", "receipt-db")
                data.setdefault("images", [])
                return data
        except Exception as e:
            backup = INBOX_PATH.with_suffix(".broken.json")
            INBOX_PATH.rename(backup)
            print(f"  ! inbox JSON 파싱 실패({e}) — {backup.name}으로 백업 후 새로 생성")
    return {"app": "receipt-db", "receipts": [], "images": []}


def save_inbox(data):
    """임시 파일에 쓴 뒤 원자적으로 교체 (동기화 중 반쪽 파일 방지)."""
    RECEIPT_DB_DIR.mkdir(parents=True, exist_ok=True)
    tmp = INBOX_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, INBOX_PATH)


def make_record(path, date_str):
    """앱 데이터 모델(Receipt)에 맞는 레코드 + 이미지 항목 생성."""
    digest = hashlib.sha1(path.read_bytes()).hexdigest()[:6]
    rec_id = f"rec_{date_str.replace('-', '')}_p{digest}"
    img_id = "img_" + rec_id[4:]  # 앱의 imageId 규칙: 'img_' + id의 'rec_' 뒷부분
    b64, mime = encode_image(path)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    receipt = {
        "id": rec_id,
        "date": date_str,
        "time": "",
        "store": "",
        "category": "",
        "paymentMethod": "",
        "paymentDetail": "",
        "total": 0,
        "items": [],
        "imageId": img_id,
        "notes": "스캔 자동등록 (PNG)",
        "tags": [],
        "createdAt": now,
        "updatedAt": now,
    }
    image = {"id": img_id, "mime": mime, "data": b64}
    return receipt, image


def dest_path(path, date_str):
    """등록완료/YYYY-MM/ 아래로 이동할 새 경로 (이름 충돌 시 -2, -3 …)."""
    done_dir = WATCH_DIR / DONE_DIR_NAME / date_str[:7]
    base = f"{date_str}_영수증"
    ext = path.suffix.lower()
    cand = done_dir / f"{base}{ext}"
    n = 2
    while cand.exists():
        cand = done_dir / f"{base}-{n}{ext}"
        n += 1
    return cand


def main():
    ap = argparse.ArgumentParser(description="PNG/JPG 영수증 → receipt-db inbox 등록")
    ap.add_argument("--dry-run", action="store_true", help="변경 없이 처리 대상만 출력")
    args = ap.parse_args()

    if not WATCH_DIR.exists():
        sys.exit(f"감시 폴더 없음: {WATCH_DIR}\n스크립트 상단 WATCH_DIR을 확인하세요.")

    # macOS는 한글 파일명이 NFD로 저장됨 — 확장자 비교만 하면 문제 없음
    targets = sorted(
        p for p in WATCH_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in EXTS
        and not p.name.startswith(".")
    )
    if not targets:
        print("처리할 PNG/JPG 없음.")
        return

    if not HAS_PIL:
        print("※ Pillow 미설치 — 원본 그대로 등록합니다 (용량 절약하려면: pip3 install Pillow)")

    inbox = load_inbox()
    existing_ids = {r.get("id") for r in inbox["receipts"]}
    added = 0

    for path in targets:
        name = unicodedata.normalize("NFC", path.name)
        date_str = file_date(path)
        dest = dest_path(path, date_str)
        print(f"• {name} → 일자 {date_str}, 이동 {dest.relative_to(WATCH_DIR)}")
        if args.dry_run:
            continue

        receipt, image = make_record(path, date_str)
        if receipt["id"] in existing_ids:
            print(f"  이미 inbox에 있음({receipt['id']}) — 파일만 이동")
        else:
            inbox["receipts"].append(receipt)
            inbox["images"].append(image)
            existing_ids.add(receipt["id"])
            added += 1
            print(f"  inbox 등록: {receipt['id']} (사진 {image['mime']})")

        dest.parent.mkdir(parents=True, exist_ok=True)
        path.rename(dest)

    if args.dry_run:
        print(f"\n[dry-run] {len(targets)}개 파일이 처리 대상입니다.")
        return

    if added:
        save_inbox(inbox)
        print(f"\n완료: {added}건 inbox 등록. 앱에서 Dropbox 동기화하면 나타납니다.")
    else:
        print("\n완료: 새로 등록된 건 없음.")


if __name__ == "__main__":
    main()
