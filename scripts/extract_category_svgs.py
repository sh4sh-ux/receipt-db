#!/usr/bin/env python3
"""Extract the user's exact Illustrator artboard vectors into transparent SVGs."""

from __future__ import annotations

import copy
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)

ASSETS = {
    "외식": "dining.svg",
    "카페": "cafe-line.svg",
    "술집": "bar-line.svg",
    "노래": "karaoke.svg",
    "쇼핑": "shopping.svg",
    "문화": "culture.svg",
    "교통": "transport.svg",
    "여행": "travel.svg",
    "숙박": "lodging.svg",
    "골프": "golf-line.svg",
    "스파": "spa-line.svg",
    "운동": "fitness.svg",
    "기념": "celebration.svg",
    "경조": "occasion.svg",
    "의료": "medical.svg",
    "기타": "other-line.svg",
}


def number(element: ET.Element, key: str, default: float = 0) -> float:
    value = element.get(key)
    return float(value) if value not in (None, "") else default


def source_files() -> dict[str, Path]:
    found: dict[str, Path] = {}
    wanted = set(ASSETS)
    for path in DOWNLOADS.glob("*.svg"):
        name = unicodedata.normalize("NFC", path.stem)
        if name in wanted:
            found[name] = path
    missing = sorted(wanted - set(found))
    if missing:
        raise FileNotFoundError("원본 SVG를 찾지 못했습니다: " + ", ".join(missing))
    return found


def artboard_group(root: ET.Element) -> tuple[ET.Element, ET.Element]:
    candidates: list[tuple[ET.Element, ET.Element]] = []
    for group in root.findall(f"{{{SVG_NS}}}g"):
        for child in list(group):
            if child.tag != f"{{{SVG_NS}}}rect":
                continue
            x, y = number(child, "x"), number(child, "y")
            width, height = number(child, "width"), number(child, "height")
            if x <= 50 <= x + width and y <= 50 <= y + height:
                candidates.append((group, child))
    if len(candidates) != 1:
        raise ValueError(f"현재 아트보드를 하나로 판별하지 못했습니다: {len(candidates)}개")
    return candidates[0]


def extract(source: Path, destination: Path) -> int:
    original = ET.parse(source).getroot()
    group, background = artboard_group(original)
    clean_group = copy.deepcopy(group)
    children = list(group)
    clean_group.remove(list(clean_group)[children.index(background)])

    clean = ET.Element(
        f"{{{SVG_NS}}}svg",
        {
            "viewBox": "0 0 100 100",
            "fill": "black",
            "stroke": "black",
            "aria-hidden": "true",
        },
    )
    defs = original.find(f"{{{SVG_NS}}}defs")
    if defs is not None:
        clean.append(copy.deepcopy(defs))
    clean.append(clean_group)
    ET.indent(clean, space="  ")
    destination.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(clean).write(destination, encoding="utf-8", xml_declaration=True)
    return sum(1 for _ in clean_group.iter()) - 1


def main() -> int:
    sources = source_files()
    output_dir = ROOT / "icons/categories"
    for korean_name, filename in ASSETS.items():
        count = extract(sources[korean_name], output_dir / filename)
        print(f"{korean_name}: 원본 벡터 요소 {count}개 → {filename}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise
