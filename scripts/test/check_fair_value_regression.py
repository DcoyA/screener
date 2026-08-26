"""CLAUDE.md 작업 규칙 9: 파이프라인 로직 변경 시 실제 API를 호출하지 않고
기존 app/data/stocks.json을 입력 픽스처로 써서 검증한다.

update_data.py의 실제 함수(percentile_stats/leave_one_out_stats와 상수)를
그대로 import해서, 기존 stocks.json에 있는 실제 종목들의 per/sectorCode/
closePrice 값으로 목표가 계산 로직만 다시 돌려본다. update_data.py의
main()은 호출하지 않으므로 네트워크 요청이 전혀 발생하지 않는다.

검증 항목:
1. 재계산한 targetPrice가 closePrice와 정확히 같은 종목이 0건인가
   (leave-one-out 수정 전에는 006730/041510/383220 등 41건이 있었다)
2. fairValueStatus 분포를 출력한다
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


def recompute_target_prices(stocks):
    """update_data.py의 FAIR VALUE V2 루프를 그대로 재현한다(main() 미호출)."""
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
        per_value = metrics.get("per")
        close_price = metrics.get("closePrice") or 0
        sector_code = s.get("sectorCode")

        if not per_value or per_value <= 0 or not close_price:
            results.append({"code": s["code"], "status": "negative_earnings", "targetPrice": None})
            continue
        if per_value > ud.MAX_PLAUSIBLE_PER:
            results.append({"code": s["code"], "status": "outlier_rejected", "targetPrice": None})
            continue

        fair_value_status = None if sector_code else "sector_unmapped"
        sector_bucket = sector_per_buckets.get(sector_code, []) if sector_code else []
        loo_sector_stats = ud.leave_one_out_stats(sector_bucket, per_value) if sector_code else None
        loo_market_stats = ud.leave_one_out_stats(market_per_values, per_value)

        if loo_sector_stats and loo_sector_stats["n"] >= ud.MIN_SECTOR_SAMPLE:
            stats, lam = loo_sector_stats, ud.REGRESSION_LAMBDA_FULL
        elif loo_sector_stats and loo_sector_stats["n"] >= ud.MIN_LOO_SECTOR_SAMPLE:
            stats, lam = loo_sector_stats, ud.REGRESSION_LAMBDA_LOW
        elif loo_market_stats and loo_market_stats["n"] >= ud.MIN_LOO_MARKET_SAMPLE:
            stats, lam = loo_market_stats, ud.REGRESSION_LAMBDA_LOW
        else:
            results.append({"code": s["code"], "status": "insufficient_data", "targetPrice": None})
            continue

        target_per_mid = per_value + lam * (stats["p50"] - per_value)
        target_price_mid = int(close_price * (target_per_mid / per_value))

        if s.get("holdingDiscount"):
            target_price_mid = int(target_price_mid * (1 - ud.HOLDING_DISCOUNT_RATE))

        results.append({
            "code": s["code"],
            "status": fair_value_status,
            "targetPrice": target_price_mid,
            "closePrice": close_price,
        })

    return results


def main():
    stocks = json.loads(STOCKS_PATH.read_text(encoding="utf-8"))
    results = recompute_target_prices(stocks)

    fallback_matches = [
        r for r in results
        if r["targetPrice"] is not None and r["targetPrice"] == r.get("closePrice")
    ]

    status_counts = {}
    for r in results:
        key = r["status"] or "ok"
        status_counts[key] = status_counts.get(key, 0) + 1

    print(f"[검증] 전체 {len(results)}종목")
    print(f"[검증] fairValueStatus 분포: {status_counts}")

    if fallback_matches:
        print(f"[검증] targetPrice == closePrice 종목 {len(fallback_matches)}건 발견:")
        for r in fallback_matches[:10]:
            print(f"  - {r['code']}: targetPrice={r['targetPrice']}")
        sys.exit(1)

    print("[검증] targetPrice == closePrice 종목 0건 - 통과")


if __name__ == "__main__":
    main()
