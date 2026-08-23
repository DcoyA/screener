"""
compare_normalization_methods.py에서 확정된 (c) 블렌드 방식을 실제로 채택하기
전, 엣지케이스(op<=0/ni<=0 조합, 정상화 방향성)와 밴드 경계(하단/상단)를
검증하기 위한 순수 분석 스크립트다. app/data/stocks.json을 읽기만 하고
아무것도 쓰지 않는다 — update_data.py는 건드리지 않는다.

실행: python scripts/analyze_normalization_edgecases.py
"""

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
STOCKS_PATH = ROOT / "app" / "data" / "stocks.json"

TAX_MULTIPLIER = 0.78
TARGET_PER = 12


def load_stocks():
    with open(STOCKS_PATH, encoding="utf-8") as f:
        return json.load(f)


def build_rows(stocks):
    rows = []
    for s in stocks:
        m = s.get("metrics", {})
        rows.append(
            {
                "code": s.get("code"),
                "name": s.get("name"),
                "op": m.get("operatingIncome"),
                "ni": m.get("netIncome"),
                "mc": m.get("marketCap"),
                "close": m.get("closePrice"),
            }
        )
    return rows


def ratio_of(op, ni):
    if op is None or op <= 0:
        return None
    return ni / op


def per_and_upside(market_cap, close, normalized_ni):
    if normalized_ni is None or normalized_ni <= 0 or not market_cap or market_cap <= 0:
        return None, None
    per = market_cap / normalized_ni
    if per <= 0 or not close or close <= 0:
        return per, None
    target_price = close * (TARGET_PER / per)
    return per, (target_price - close) / close * 100


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


# ---------------------------------------------------------------------------
# 1~3. 엣지케이스
# ---------------------------------------------------------------------------

def method_c_current(op, ni, low, high):
    """현재 compare_normalization_methods.py의 (c) 로직 그대로 (op<=0이면
    무조건 op*0.78로 스냅 — 이게 3번 질문에서 검증하려는 그 로직이다)."""
    if op is not None and op <= 0:
        return op * TAX_MULTIPLIER
    r = ratio_of(op, ni)
    if r is None:
        return ni
    if r <= low:
        w = 0.0
    elif r >= high:
        w = 1.0
    else:
        w = (r - low) / (high - low)
    return ni * (1 - w) + (op * TAX_MULTIPLIER) * w


def method_c_capped(op, ni, low, high):
    """3번 질문에 대한 제안: 항상 하향(min)으로만 작동하도록 최종 min() 안전장치를
    추가한 버전. op<=0 분기까지 포함해 무조건 min(결과, 원본)을 적용한다."""
    raw = method_c_current(op, ni, low, high)
    if raw is None or ni is None:
        return raw
    return min(raw, ni)


def edge_case_report(rows):
    print("\n" + "=" * 70)
    print("[1] op_income <= 0 종목")
    print("=" * 70)
    op_neg = [r for r in rows if r["op"] is not None and r["op"] <= 0]
    print(f"총 {len(op_neg)}개 (전체 {len(rows)}개 중 {len(op_neg)/len(rows)*100:.1f}%)")
    print("ratio_of(op,ni)는 op<=0이면 항상 None을 반환 — '음수/무한대'가 아니라")
    print("'정의불가(None)'로 처리되고 있고, 현재 (c) 로직은 이 None을 별도 분기로")
    print("가로채 op<=0이면 무조건 op*0.78로 스냅한다(ratio 값 자체를 아예 안 봄).")
    print()
    for r in sorted(op_neg, key=lambda x: x["op"]):
        ni_c = method_c_current(r["op"], r["ni"], 1.2, 2.0)
        per_c, up_c = per_and_upside(r["mc"], r["close"], ni_c)
        ni_disp = f'{r["ni"]/1e8:.1f}억' if r["ni"] is not None else "N/A"
        op_disp = f'{r["op"]/1e8:.1f}억' if r["op"] is not None else "N/A"
        nic_disp = f'{ni_c/1e8:.1f}억' if ni_c is not None else "N/A"
        per_disp = f"{per_c:.2f}" if per_c is not None else "N/A(음수/0)"
        up_disp = f"{up_c:.1f}%" if up_c is not None else "N/A(계산불가)"
        print(
            f'{r["code"]} {r["name"]:<16} op={op_disp:>10} ni={ni_disp:>10} '
            f"-> (c)정상화값={nic_disp:>10}  per={per_disp:>10}  upside={up_disp}"
        )

    print("\n" + "=" * 70)
    print("[2] op/ni 부호 조합별 종목 수와 처리")
    print("=" * 70)
    combo_op_neg_ni_pos = [r for r in rows if r["op"] is not None and r["op"] <= 0 and r["ni"] is not None and r["ni"] > 0]
    combo_op_neg_ni_neg = [r for r in rows if r["op"] is not None and r["op"] <= 0 and r["ni"] is not None and r["ni"] <= 0]
    combo_op_pos_ni_neg = [r for r in rows if r["op"] is not None and r["op"] > 0 and r["ni"] is not None and r["ni"] <= 0]
    print(f"op<=0 & ni>0  : {len(combo_op_neg_ni_pos)}개  (현재 1-1절 특수 케이스 — '가장 확정적인 정상화 신호')")
    for r in combo_op_neg_ni_pos:
        print(f'   - {r["code"]} {r["name"]}  op={r["op"]/1e8:.1f}억  ni={r["ni"]/1e8:.1f}억')
    print(f"\nop<=0 & ni<=0 : {len(combo_op_neg_ni_neg)}개  (둘 다 적자 — PER 자체가 애초에 계산 불가)")
    for r in combo_op_neg_ni_neg:
        ni_c = method_c_current(r["op"], r["ni"], 1.2, 2.0)
        direction = "하향(더 나빠짐)" if (ni_c is not None and r["ni"] is not None and ni_c <= r["ni"]) else "**상향(개선!) — 방향성 위반**"
        print(
            f'   - {r["code"]} {r["name"]}  op={r["op"]/1e8:.1f}억  ni={r["ni"]/1e8:.1f}억  '
            f'-> (c)정상화값={ni_c/1e8:.1f}억  [{direction}]'
        )
    print(f"\nop>0 & ni<=0  : {len(combo_op_pos_ni_neg)}개  (영업은 흑자, 순이익은 적자 — 정상화 대상 아님)")
    print("   ratio_of(op,ni) = ni/op <= 0 이 그대로 계산되어 blend 하단(1.2)보다")
    print("   항상 작으므로 w=0으로 원본 그대로 유지된다 — 별도 특수 처리 불필요함을 확인.")
    sample = combo_op_pos_ni_neg[:3]
    for r in sample:
        print(f'   예시: {r["code"]} {r["name"]}  ratio={ratio_of(r["op"], r["ni"]):.2f}')

    print("\n" + "=" * 70)
    print("[3] 정상화가 상향으로 작동하는 케이스가 있는가?")
    print("=" * 70)
    violations = []
    for r in rows:
        ni_c = method_c_current(r["op"], r["ni"], 1.2, 2.0)
        if ni_c is not None and r["ni"] is not None and ni_c > r["ni"] + 1e-6:
            violations.append((r, ni_c))
    print(f"현재 (c) 로직(op<=0이면 무조건 op*0.78) 기준 위반 사례: {len(violations)}건")
    for r, ni_c in violations:
        print(
            f'   - {r["code"]} {r["name"]}  op={r["op"]/1e8:.1f}억  ni={r["ni"]/1e8:.1f}억  '
            f'-> 정상화값={ni_c/1e8:.1f}억 (원본보다 {(ni_c-r["ni"])/1e8:.1f}억 더 큼)'
        )
    print("\n제안 상한 규칙: 어떤 분기를 타든 마지막에 반드시")
    print("    normalizedNetIncome = min(정상화_계산결과, netIncome)")
    print("을 한 번 더 씌운다. 이렇게 하면 op<=0 분기까지 포함해 '정상화는 항상")
    print("원본보다 작거나 같다'가 코드 구조와 무관하게 항상 보장된다.")

    # capped 버전 적용 시 동일 위반이 사라지는지 검증
    violations_capped = []
    for r in rows:
        ni_c = method_c_capped(r["op"], r["ni"], 1.2, 2.0)
        if ni_c is not None and r["ni"] is not None and ni_c > r["ni"] + 1e-6:
            violations_capped.append(r)
    print(f"\nmin() 상한을 추가한 버전으로 재검증한 위반 건수: {len(violations_capped)}건 (기대값 0)")


# ---------------------------------------------------------------------------
# 4~5. 밴드 경계 재측정
# ---------------------------------------------------------------------------

def band_sweep(rows, label, configs):
    print("\n" + "=" * 70)
    print(f"[{label}]")
    print("=" * 70)
    header = f'{"low":>5} {"high":>5} | {"변경종목":>10} {"비율":>7} | {"5%미만 미미변경":>14} | {"upside>100":>10}'
    print(header)
    print("-" * len(header))
    for low, high in configs:
        changed = 0
        trivial = 0
        over100 = 0
        for r in rows:
            ni_c = method_c_capped(r["op"], r["ni"], low, high)
            per_c, up_c = per_and_upside(r["mc"], r["close"], ni_c)
            if r["ni"] is not None and ni_c is not None and abs(ni_c - r["ni"]) > 1e-6:
                changed += 1
                rel = abs(ni_c - r["ni"]) / abs(r["ni"]) * 100 if r["ni"] != 0 else 0
                if rel < 5:
                    trivial += 1
            if up_c is not None and up_c > 100:
                over100 += 1
        n = len(rows)
        print(
            f"{low:>5} {high:>5} | {changed:>7}개 {changed/n*100:>6.1f}% | "
            f"{trivial:>10}개({trivial/max(changed,1)*100:>4.1f}% of 변경분) | {over100:>7}개({over100/n*100:.1f}%)"
        )


def main():
    stocks = load_stocks()
    rows = build_rows(stocks)

    edge_case_report(rows)

    band_sweep(
        rows,
        "4. 하단(low) 스윕: 1.2 / 1.3 / 1.4  (상단 2.0 고정, min() 상한 적용)",
        [(1.2, 2.0), (1.3, 2.0), (1.4, 2.0)],
    )
    band_sweep(
        rows,
        "5. 상단(high) 스윕: 2.0 / 2.5  (하단 1.2 고정, min() 상한 적용)",
        [(1.2, 2.0), (1.2, 2.5)],
    )


if __name__ == "__main__":
    main()
