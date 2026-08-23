"""
docs/fair-value-v2.md 1-1/1-2절 이익 정상화 방식을 배포하기 전, "임계치 하드
스위치(ratio>=1.5)의 절벽 문제"를 검증하기 위한 순수 비교/분석 스크립트다.
app/data/stocks.json을 읽기만 하고 아무것도 쓰지 않는다 — update_data.py나
다른 파이프라인 코드는 건드리지 않는다.

세 방식:
  (a) 현행 설계 — ratio>=1.5(또는 op<=0&ni>0)일 때만 net = op*0.78, 아니면 원본 그대로
  (b) 클립 — 전 종목에 net = min(net, op*0.78) 적용
  (c) 블렌드 — ratio 1.2~2.0 구간에서 원본↔op*0.78 사이 선형 보간

실행: python scripts/compare_normalization_methods.py
"""

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
STOCKS_PATH = ROOT / "app" / "data" / "stocks.json"

RATIO_THRESHOLD = 1.5   # (a)에서 쓰는 현행 하드 임계치
TAX_MULTIPLIER = 0.78   # docs/fair-value-v2.md 1-2절
BLEND_LOW = 1.2
BLEND_HIGH = 2.0
TARGET_PER = 12         # 현재 update_data.py의 고정 target_per (섹터 밴드 미적용 상태로 비교)


def load_stocks():
    with open(STOCKS_PATH, encoding="utf-8") as f:
        return json.load(f)


def ratio_of(op, ni):
    if op is None or op <= 0:
        return None
    return ni / op


def method_a(op, ni):
    """현행 설계(1-1/1-2절): op<=0&ni>0 이거나 ratio>=1.5면 op*0.78, 아니면 원본."""
    if op is not None and op <= 0 and ni is not None and ni > 0:
        return op * TAX_MULTIPLIER  # <=0 이 되어 이후 per 계산 불가로 자연 처리됨
    r = ratio_of(op, ni)
    if r is not None and r >= RATIO_THRESHOLD:
        return op * TAX_MULTIPLIER
    return ni


def method_b(op, ni):
    """클립: 전 종목에 net = min(net, op*0.78). op<=0이면 op*0.78<=0이라
    ni>0인 한 자동으로 min이 op*0.78(<=0)이 되어 (a)의 특수 케이스와 결과가 같아진다."""
    if op is None:
        return ni
    return min(ni, op * TAX_MULTIPLIER)


def method_c(op, ni):
    """블렌드: ratio<=1.2면 원본 그대로(w=0), ratio>=2.0이면 완전 정상화(w=1),
    그 사이는 선형 보간. op<=0인 케이스는 애초에 ratio를 정의할 수 없고
    가장 강한 의심 신호이므로 w=1(완전 정상화)로 취급한다."""
    if op is not None and op <= 0:
        return op * TAX_MULTIPLIER
    r = ratio_of(op, ni)
    if r is None:
        return ni
    if r <= BLEND_LOW:
        w = 0.0
    elif r >= BLEND_HIGH:
        w = 1.0
    else:
        w = (r - BLEND_LOW) / (BLEND_HIGH - BLEND_LOW)
    return ni * (1 - w) + (op * TAX_MULTIPLIER) * w


def per_and_upside(market_cap, close, normalized_ni):
    if normalized_ni is None or normalized_ni <= 0 or not market_cap or market_cap <= 0:
        return None, None
    per = market_cap / normalized_ni
    if per <= 0 or not close or close <= 0:
        return per, None
    target_price = close * (TARGET_PER / per)
    upside = (target_price - close) / close * 100
    return per, upside


def median(values):
    if not values:
        return None
    s = sorted(values)
    return s[round(0.5 * (len(s) - 1))]


def percentile(values, p):
    if not values:
        return None
    s = sorted(values)
    idx = min(len(s) - 1, max(0, round((p / 100) * (len(s) - 1))))
    return s[idx]


def build_rows(stocks):
    rows = []
    for s in stocks:
        m = s.get("metrics", {})
        op = m.get("operatingIncome")
        ni = m.get("netIncome")
        mc = m.get("marketCap")
        close = m.get("closePrice")
        per_orig = m.get("per")
        upside_orig = m.get("upside")
        rows.append(
            {
                "code": s.get("code"),
                "name": s.get("name"),
                "op": op,
                "ni": ni,
                "mc": mc,
                "close": close,
                "ratio": ratio_of(op, ni),
                "per_orig": per_orig,
                "upside_orig": upside_orig,
            }
        )
    return rows


def apply_method(rows, fn, label):
    changed = 0
    pers = []
    upsides_over_100 = 0
    per_under_5 = 0
    results = []
    for r in rows:
        ni_new = fn(r["op"], r["ni"])
        per_new, upside_new = per_and_upside(r["mc"], r["close"], ni_new)
        is_changed = r["ni"] is not None and ni_new is not None and abs(ni_new - r["ni"]) > 1e-6
        if is_changed:
            changed += 1
        if per_new is not None and per_new > 0:
            pers.append(per_new)
            if per_new < 5:
                per_under_5 += 1
        if upside_new is not None and upside_new > 100:
            upsides_over_100 += 1
        results.append(
            {
                **r,
                "ni_new": ni_new,
                "per_new": per_new,
                "upside_new": upside_new,
                "changed": is_changed,
            }
        )

    n_total = len(rows)
    print(f"\n=== ({label}) ===")
    print(f"값이 바뀐 종목: {changed}개 / {n_total}개 ({changed / n_total * 100:.1f}%)")
    print(
        f"정상화 후 PER 분포: 중앙값={median(pers):.2f}  하위10%(p10)={percentile(pers, 10):.2f}  "
        f"per<5 종목수={per_under_5}  (per>0 표본 {len(pers)}개)"
        if pers
        else "정상화 후 PER 분포: 표본 없음"
    )
    print(f"upside > 100% 종목 수: {upsides_over_100}개 ({upsides_over_100 / n_total * 100:.1f}%)")

    print(f"\n--- ({label}) 상위 15종목 (정상화 후 upside 기준) before/after ---")
    ranked = [r for r in results if r["upside_new"] is not None]
    ranked.sort(key=lambda r: r["upside_new"], reverse=True)
    for r in ranked[:15]:
        uo = f'{r["upside_orig"]:.1f}%' if r["upside_orig"] is not None else "N/A"
        po = f'{r["per_orig"]:.2f}' if r["per_orig"] else "N/A"
        pn = f'{r["per_new"]:.2f}' if r["per_new"] is not None else "N/A"
        un = f'{r["upside_new"]:.1f}%' if r["upside_new"] is not None else "N/A"
        ratio_s = f'{r["ratio"]:.2f}' if r["ratio"] is not None else "N/A"
        print(
            f'{r["code"]} {r["name"]:<18} ratio={ratio_s:>6} '
            f"per {po:>8} -> {pn:>8}   upside {uo:>9} -> {un:>9}"
        )

    return results


def cliff_zone_report(rows):
    zone = [r for r in rows if r["ratio"] is not None and 1.4 <= r["ratio"] <= 1.6]
    zone.sort(key=lambda r: r["ratio"])
    print(f"\n=== ratio 1.4~1.6 구간(절벽 영향권): {len(zone)}개 ===")
    for r in zone:
        side = "정상화 O(>=1.5)" if r["ratio"] >= RATIO_THRESHOLD else "정상화 X(<1.5)"
        print(f'{r["code"]} {r["name"]:<18} ratio={r["ratio"]:.3f}  (a)기준 {side}')
    return zone


def quantify_cliff(rows):
    """(a) 방식에서, 실제로는 하드 임계치를 걸었을 때 '경계선 바로 옆' 종목이
    반대편으로 넘어갔다면 결과가 얼마나 튀었을지를 정량화한다.
    ratio 1.3~1.7 구간의 각 종목에 대해 '정상화 적용 시'와 '미적용 시' 값을
    둘 다 계산해서 그 차이(=경계를 넘나들 때 실제로 발생하는 절벽 크기)를 보여준다."""
    zone = [r for r in rows if r["ratio"] is not None and 1.3 <= r["ratio"] <= 1.7]
    zone.sort(key=lambda r: r["ratio"])
    print(f"\n=== (a) 임계치 절벽 정량화: ratio 1.3~1.7 구간, {len(zone)}개 ===")
    print("(같은 종목을 '정상화 미적용'과 '정상화 적용' 두 값 모두로 계산 — 이 둘의 차이가")
    print(" 그 종목이 임계치를 살짝 넘거나 넘지 않았을 때 실제로 겪는 절벽의 크기다)")
    max_upside_jump = 0
    max_upside_jump_stock = None
    for r in zone:
        per_unflagged, upside_unflagged = per_and_upside(r["mc"], r["close"], r["ni"])
        ni_flagged = r["op"] * TAX_MULTIPLIER if r["op"] else None
        per_flagged, upside_flagged = per_and_upside(r["mc"], r["close"], ni_flagged)
        actual_side = "정상화됨" if r["ratio"] >= RATIO_THRESHOLD else "정상화안됨"
        pu = f"{per_unflagged:.2f}" if per_unflagged else "N/A"
        pf = f"{per_flagged:.2f}" if per_flagged else "N/A"
        uu = f"{upside_unflagged:.1f}%" if upside_unflagged is not None else "N/A"
        uf = f"{upside_flagged:.1f}%" if upside_flagged is not None else "N/A"
        jump = None
        if upside_unflagged is not None and upside_flagged is not None:
            jump = abs(upside_flagged - upside_unflagged)
            if jump > max_upside_jump:
                max_upside_jump = jump
                max_upside_jump_stock = r
        jump_s = f"{jump:.1f}%p" if jump is not None else "N/A"
        print(
            f'{r["code"]} {r["name"]:<18} ratio={r["ratio"]:.3f} [{actual_side}]  '
            f"미적용시 per={pu:>8} upside={uu:>9}  |  적용시 per={pf:>8} upside={uf:>9}  "
            f"|  절벽크기(upside 차이)={jump_s}"
        )
    if max_upside_jump_stock:
        print(
            f'\n최대 절벽: {max_upside_jump_stock["code"]} {max_upside_jump_stock["name"]} '
            f"— ratio가 임계치를 넘나드는 것만으로 upside가 {max_upside_jump:.1f}%p 만큼 불연속 점프"
        )


def main():
    stocks = load_stocks()
    rows = build_rows(stocks)

    apply_method(rows, method_a, "a) 현행 설계: ratio>=1.5 하드 스위치")
    apply_method(rows, method_b, "b) 클립: 전종목 min(net, op*0.78)")
    apply_method(rows, method_c, "c) 블렌드: ratio 1.2~2.0 선형보간")

    cliff_zone_report(rows)
    quantify_cliff(rows)


if __name__ == "__main__":
    main()
