"""VERIFY-2026-08 F-1 회귀 검사.

compute_fair_value_band()가 target_price_mid == close_price 인 종목에 대해
status='ok' + targetPrice=현재가 를 내보내지 않는지(= insufficient_data + None) 확인한다.

실제 API 호출 없이 기존 app/data/stocks.json 을 입력 픽스처로 쓴다
(CLAUDE.md 작업 규칙 9). 섹터/시장 PER 버킷을 stocks.json 에서 재구성해
compute_fair_value_band 를 전 종목에 다시 돌린다.

사용: python scripts/test/check_fair_value_equal_close.py
"""
import json
import os
import sys
from pathlib import Path

# update_data.py 는 import 시점에 API 키 존재를 검사한다. 이 검사 스크립트는
# 순수 함수(compute_fair_value_band)만 쓰고 네트워크를 타지 않으므로 더미로 채운다.
os.environ.setdefault("OPENDART_API_KEY", "dummy-for-fixture-test")
os.environ.setdefault("KRX_API_KEY", "dummy-for-fixture-test")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from update_data import (  # noqa: E402
    compute_fair_value_band,
    FAIR_VALUE_STATUS_OK,
)

stocks = json.loads((ROOT / "app" / "data" / "stocks.json").read_text(encoding="utf-8"))

# update_data.main() 이 만드는 것과 동일한 버킷.
market_per_values = []
sector_per_buckets = {}
for s in stocks:
    per = s.get("metrics", {}).get("per")
    if per and per > 0:
        market_per_values.append(per)
        code = s.get("sectorCode")
        if code:
            sector_per_buckets.setdefault(code, []).append(per)

violations = []
recomputed_null_from_equal = 0
for s in stocks:
    m = s.get("metrics", {})
    close_price = int(m.get("closePrice") or 0)
    fv = compute_fair_value_band(
        m.get("per"),
        close_price,
        s.get("sectorCode"),
        sector_per_buckets,
        market_per_values,
        bool(s.get("holdingDiscount")),
    )
    tp = fv["targetPrice"]
    if fv["status"] == FAIR_VALUE_STATUS_OK and tp is not None and close_price and tp == close_price:
        violations.append((s.get("code"), s.get("name"), close_price, tp))
    # 예전 산출물에서 현재가==적정가였던 종목이 이제 결측(None)으로 바뀌는지 참고 집계
    old_tp = m.get("targetPrice")
    if old_tp is not None and close_price and old_tp == close_price and tp is None:
        recomputed_null_from_equal += 1

print(f"[F-1] 재계산 결과 status=ok 인데 targetPrice==closePrice: {len(violations)}건")
print(f"[F-1] 기존 현재가==적정가였다가 재계산 시 결측(None)으로 전환: {recomputed_null_from_equal}건")

if violations:
    for v in violations[:20]:
        print(f"  ✗ {v[0]} {v[1]} close={v[2]} target={v[3]}")
    print(f"\nF-1 회귀: status=ok 인데 현재가==적정가인 종목이 {len(violations)}건 있습니다.")
    sys.exit(1)

print("\nF-1 통과: 현재가==적정가는 전부 결측 처리됨 (status != ok)")
