#!/usr/bin/env python3
"""더치페이 index.html에서 '기록 보관함' 모양 CSS를 뽑아 dpcard.css의 DPX 구간을 다시 만든다.

사용: python3 scripts/extract_dpcard_css.py [더치페이 index.html 경로]   (기본: ../dutch-pay/index.html)

- 뽑는 규칙: 아래 TARGET 클래스만으로 이뤄진 선택자(다른 클래스·html·body·#id가 섞인 선택자는 제외).
- 모든 클래스 이름 앞에 `dpx-`를 붙여 영수증 앱의 기존 클래스와 겹치지 않게 한다.
- dpcard.css에서 `/* DPX:BEGIN */` ~ `/* DPX:END */` 사이만 바꾼다. 앞(머리 주석·변수)과 뒤(영수증 앱 조정)는 그대로.
- 더치페이 쪽 모양이 바뀌었을 때만 돌린다. 돌린 뒤 사람 탭을 1280·390에서 눈으로 확인할 것.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / 'dutch-pay' / 'index.html'
OUT = ROOT / 'dpcard.css'

TARGET = set('''hist-month-nav hmn-header hmn-arr hmn-label hmn-all hmn-stat hmn-stat-3 hmn-stat-col hmn-stat-col-div
hmn-stat-col-lbl hmn-stat-col-val hmn-stat-col-right hmn-col-badges hmn-stat-badges hmn-stat-settle treat hmn-pct
hmn-treat hmn-spend-lbl hmn-spend-val hmn-total-col hmn-bal-col pm-seg-row pm-seg on
record-list record-card rc-hd rc-meta rc-date rc-name rc-people rc-right rc-amt-line rc-chevron rc-body
rc-section-title rc-section-sep rc-item-row rc-3line rc-item-info rc-item-name-row rc-item-name rc-item-meta
rc-payer-pill treat-badge pay-ic rc-chev open rc-total rc-total-zero neg
rc-receipt-wrap rc-receipt-tbl rc-qty rc-unit rc-neg rc-foot-summary receipt-audit ok bad warn rc-foot-cell
rc-foot-link rc-foot-arrow rc-gift-badge audit-bad
rc-txns rc-txn-row rc-txn-people rc-txn-amt rc-treat-right rc-treat-badge
rc-item-amt rc-txn-left rc-foot rc-saved-at rc-foot-btns rc-load-btn rc-edit-btn rc-btn-ico rc-btn-lbl pm-last-row'''.split())


def split_rules(s):
    out, i, n = [], 0, len(s)
    while i < n:
        m = re.match(r'\s+', s[i:])
        if m:
            i += m.end()
            continue
        if s.startswith('/*', i):
            i = s.index('*/', i) + 2
            continue
        j = s.index('{', i)
        depth, k = 1, j + 1
        while depth and k < n:
            if s.startswith('/*', k):
                k = s.index('*/', k) + 2
                continue
            c = s[k]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            k += 1
        out.append((s[i:j].strip(), s[j + 1:k - 1]))
        i = k
    return out


def classes(sel):
    return re.findall(r'\.([A-Za-z_][\w-]*)', sel)


def keep_sel(sel):
    cs = classes(sel)
    bare = re.sub(r'\.([A-Za-z_][\w-]*)', '', sel)          # 클래스 이름을 뺀 나머지에서 html·body·#id 확인
    return bool(cs) and all(c in TARGET for c in cs) and not re.search(r'\b(html|body)\b|#', bare)


def process(rules):
    res = []
    for head, body in rules:
        if head.startswith('@media') or head.startswith('@supports'):
            inner = process(split_rules(body))
            if inner:
                res.append((head, inner))
        elif head.startswith('@'):
            continue
        else:
            ks = [x.strip() for x in head.split(',') if keep_sel(x.strip())]
            if ks:
                res.append((', '.join(ks), body.strip()))
    return res


def prefix(sel):
    return re.sub(r'\.([A-Za-z_][\w-]*)', lambda m: '.dpx-' + m.group(1), sel)


def emit(rs, ind=''):
    o = []
    for h, b in rs:
        if isinstance(b, list):
            o.append(f"{ind}{h}{{\n{emit(b, ind + '  ')}{ind}}}\n")
        else:
            o.append(f"{ind}{prefix(h)}{{{b}}}\n")
    return ''.join(o)


def main():
    src = SRC.read_text(encoding='utf8')
    css = re.search(r'<style[^>]*>(.*?)</style>', src, re.S).group(1)
    ver = re.search(r"APP_VERSION\s*=\s*'(v[\d.]+)'", src)
    text = emit(process(split_rules(css)))
    cur = OUT.read_text(encoding='utf8')
    a, b = cur.index('/* DPX:BEGIN */'), cur.index('/* DPX:END */')
    new = cur[:a] + '/* DPX:BEGIN */\n' + text + cur[b:]
    OUT.write_text(new, encoding='utf8')
    print(f"dpcard.css 갱신: {len(text)}바이트 (더치페이 {ver.group(1) if ver else '?'})")
    used = sorted(set(re.findall(r'var\((--[\w-]+)', text)))
    print('쓰는 변수:', ' '.join(used))


if __name__ == '__main__':
    main()
