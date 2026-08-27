"""CLAUDE.md 작업 규칙 9: 파이프라인 로직 변경 시 실제 API를 호출하지 않고
기존 app/data/stocks.json을 입력 픽스처로 써서 검증한다.

update_data.py의 실제 함수(compute_fair_value_band와 상수)를 그대로 import해서,
기존 stocks.json에 있는 실제 종목들의 per/sectorCode/closePrice 값으로 적정가
밴드 계산 로직만 다시 돌려본다. update_data.py의 main()은 호출하지 않으므로
네트워크 요청이 전혀 발생하지 않는다.

검증 항목:
1. status=='ok'인데 재계산한 targetPrice가 closePrice와 정확히 같은 종목이 0건인가
   (leave-one-out/이상치 컷 이전에는 006730/041510/383220 등이 여기 걸렸다)
2. fairValueStatus 분포를 출력한다
3. 샘플 종목(006730 서부티엔디 / 383220 F&F / 073240 금호타이어 / 030200 케이티)의
   status·targetPrice·closePrice·밴드를 출력해 현재가==적정가 케이스가 0건임을 증명한다
"""

import json
import os
import sys
from pathlib import Path

# Windows 콘솔 기본 코드페이지에서 한글 print가 깨지는 것을 방지한다.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

# update_data.py는 import 시점(모듈 최상단)에 OPENDART_API_KEY/KRX_API_KEY
# 존재 여부만 확인하고 바로 죽는다(실제 네트워크 요청은 안 함, main()도 여기서
# 호출 안 함). 이 검증 스크립트는 실제 API를 절대 호출하지 않으므로 더미
# 값으로 이 가드만 통과시킨다.
os.environ.setdefault("OPENDART_API_KEY", "dummy-for-offline-fixture-test")
os.environ.setdefault("KRX_API_KEY", "dummy-for-offline-fixture-test")

import update_data as ud  # noqa: E402  (환경변수 설정 이후에 import해야 함)

STOCKS_PATH = ROOT / "app" / "data" / "stocks.json"

SAMPLE_CODES = {
    "006730": "서부티엔디",
    "383220": "F&F",
    "073240": "금호타이어",
    "030200": "케이티",
}


def recompute(stocks):
    """update_data.py의 FAIR VALUE V2 루프를 그대로 재현한다(main() 미호출).

    population 통계(sector_per_buckets/market_per_values)만 여기서 만들고,
    종목별 계산은 프로덕션과 동일한 compute_fair_value_band()에 위임한다.
    """
    sector_per_buckets = {}
    market_per_values = []
    for s in stocks:
        per_value = s.get("metrics", {}).get("per")
        if per_value and per_value > 0:
            market_per_values.append(per_value)
            code = s.get("sectorCode")
            if code:
                sector_per_buckets.setdefault(code, []).append(per_value)

    results = []
    for s in stocks:
        metrics = s.get("metrics", {})
        fv = ud.compute_fair_value_band(
            metrics.get("per"),
            metrics.get("closePrice") or 0,
            s.get("sectorCode"),
            sector_per_buckets,
            market_per_values,
            bool(s.get("holdingDiscount")),
        )
        results.append(
            {
                "code": s["code"],
                "name": s.get("name", ""),
                "closePrice": metrics.get("closePrice") or 0,
                **fv,
            }
        )
    return results


def main():
    stocks = json.loads(STOCKS_PATH.read_text(encoding="utf-8"))
    results = recompute(stocks)
    by_code = {r["code"]: r for r in results}

    status_counts = {}
    for r in results:
        status_counts[r["status"]] = status_counts.get(r["status"], 0) + 1

    print(f"[검증] 전체 {len(results)}종목")
    print(f"[검증] fairValueStatus 분포: {status_counts}")

    # status가 ok인데 목표가(mid)가 현재가와 정확히 같으면 fallback 아티팩트.
    ok_fallback = [
        r
        for r in results
        if r["status"] == ud.FAIR_VALUE_STATUS_OK
        and r["targetPrice"] is not None
        and r["targetPrice"] == r["closePrice"]
    ]

    print("[검증] 샘플 종목 재계산 결과:")
    for code, label in SAMPLE_CODES.items():
        r = by_code.get(code)
        if not r:
            print(f"  - {code} {label}: stocks.json 상위 유니버스에 없음(스킵)")
            continue
        band = (
            f"{r['targetPriceConservative']}~{r['targetPriceOptimistic']}"
            if r["targetPrice"] is not None
            else "-"
        )
        eq = " (현재가==적정가!)" if r["targetPrice"] == r["closePrice"] and r["targetPrice"] is not None else ""
        print(
            f"  - {code} {label}: status={r['status']} "
            f"close={r['closePrice']} target={r['targetPrice']} band={band} "
            f"upside={r['upside']}{eq}"
        )

    sample_eq = [
        code
        for code in SAMPLE_CODES
        if by_code.get(code)
        and by_code[code]["targetPrice"] is not None
        and by_code[code]["targetPrice"] == by_code[code]["closePrice"]
    ]

    if ok_fallback or sample_eq:
        if ok_fallback:
            print(f"[검증] 실패: status=ok인데 targetPrice==closePrice인 종목 {len(ok_fallback)}건")
            for r in ok_fallback[:10]:
                print(f"  - {r['code']} {r['name']}: targetPrice={r['targetPrice']}")
        if sample_eq:
            print(f"[검증] 실패: 샘플 종목 중 현재가==적정가 {sample_eq}")
        sys.exit(1)

    print("[검증] 통과: 샘플 4종목 및 전체에서 현재가==적정가(status=ok) 케이스 0건")


if __name__ == "__main__":
    main()
