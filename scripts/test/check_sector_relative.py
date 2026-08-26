"""CLAUDE.md 작업 규칙 9: 실제 API를 호출하지 않고 기존 app/data/stocks.json을
입력 픽스처로 써서 검증한다.

update_data.py의 실제 함수(compute_percentile_rank/sector_major_category와
SECTOR_MAP)를 그대로 import해서, TASK 2(섹터 상대 위치) 계산 블록을
stocks.json의 실제 종목들로 재현한다. main()은 호출하지 않으므로 네트워크
요청이 전혀 발생하지 않는다.
"""

import json
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

os.environ.setdefault("OPENDART_API_KEY", "dummy-for-offline-fixture-test")
os.environ.setdefault("KRX_API_KEY", "dummy-for-offline-fixture-test")

import update_data as ud  # noqa: E402

STOCKS_PATH = ROOT / "app" / "data" / "stocks.json"


def build_sector_relative(stocks):
    """update_data.py의 "섹터 상대 위치" 블록을 그대로 재현한다."""
    sector_per_buckets = {}
    sector_pbr_buckets = {}
    sector_roe_buckets = {}
    major_per_buckets = {}
    major_pbr_buckets = {}
    major_roe_buckets = {}

    for s in stocks:
        m = s.get("metrics", {})
        code = s.get("code")
        sector_code = s.get("sectorCode")
        major_code = ud.sector_major_category(code)

        per_value = m.get("per")
        if per_value and per_value > 0:
            if sector_code:
                sector_per_buckets.setdefault(sector_code, []).append(per_value)
            if major_code:
                major_per_buckets.setdefault(major_code, []).append(per_value)

        pbr_value = m.get("pbr")
        if pbr_value and pbr_value > 0:
            if sector_code:
                sector_pbr_buckets.setdefault(sector_code, []).append(pbr_value)
            if major_code:
                major_pbr_buckets.setdefault(major_code, []).append(pbr_value)

        roe_value = m.get("roe")
        if roe_value is not None:
            if sector_code:
                sector_roe_buckets.setdefault(sector_code, []).append(roe_value)
            if major_code:
                major_roe_buckets.setdefault(major_code, []).append(roe_value)

    def rank_with_major_fallback(sector_bucket_map, major_bucket_map, sector_code, major_code, value):
        rank = ud.compute_percentile_rank(sector_bucket_map.get(sector_code, []) if sector_code else [], value)
        if rank is not None:
            rank["usedMajorFallback"] = False
            return rank
        if major_code:
            rank = ud.compute_percentile_rank(major_bucket_map.get(major_code, []), value)
            if rank is not None:
                rank["usedMajorFallback"] = True
                return rank
        return None

    results = {}
    for s in stocks:
        m = s.get("metrics", {})
        code = s.get("code")
        sector_code = s.get("sectorCode")
        major_code = ud.sector_major_category(code)

        results[code] = {
            "per": rank_with_major_fallback(sector_per_buckets, major_per_buckets, sector_code, major_code, m.get("per")),
            "pbr": rank_with_major_fallback(sector_pbr_buckets, major_pbr_buckets, sector_code, major_code, m.get("pbr")),
            "roe": rank_with_major_fallback(sector_roe_buckets, major_roe_buckets, sector_code, major_code, m.get("roe")),
        }
    return results


def main():
    stocks = json.loads(STOCKS_PATH.read_text(encoding="utf-8"))
    results = build_sector_relative(stocks)

    total = len(stocks)
    per_have = sum(1 for r in results.values() if r["per"])
    pbr_have = sum(1 for r in results.values() if r["pbr"])
    roe_have = sum(1 for r in results.values() if r["roe"])
    per_major_fallback = sum(1 for r in results.values() if r["per"] and r["per"]["usedMajorFallback"])

    print(f"전체 종목 {total}건")
    print(f"PER 백분위 산출됨: {per_have}건 ({per_have/total*100:.1f}%), 이 중 대분류 폴백: {per_major_fallback}건")
    print(f"PBR 백분위 산출됨: {pbr_have}건 ({pbr_have/total*100:.1f}%)")
    print(f"ROE 백분위 산출됨: {roe_have}건 ({roe_have/total*100:.1f}%)")

    # rank 1은 percentile 0.0(최저가/최저값)이어야 하고, peerCount+1 종목 중
    # own_value가 가장 낮으면 rank=1이 나오는지 직접 하나 검증한다.
    sample_code, sample = next((c, r) for c, r in results.items() if r["per"])
    print(f"\n샘플({sample_code}) PER 백분위: {sample['per']}")

    # 방향성 검증: 같은 섹터에서 PER이 가장 낮은 종목의 rank가 1이어야 한다.
    by_sector = {}
    for s in stocks:
        code = s["code"]
        sc = s.get("sectorCode")
        per = s.get("metrics", {}).get("per")
        if sc and per and per > 0:
            by_sector.setdefault(sc, []).append((code, per))

    checked = 0
    mismatches = []
    for sc, items in by_sector.items():
        if len(items) < ud.MIN_SECTOR_PERCENTILE_SAMPLE + 1:
            continue
        items_sorted = sorted(items, key=lambda x: x[1])
        cheapest_code = items_sorted[0][0]
        rank_info = results[cheapest_code]["per"]
        checked += 1
        if not rank_info or rank_info["rank"] != 1:
            mismatches.append((sc, cheapest_code, rank_info))

    print(f"\n섹터별 'PER 최저 종목의 rank==1' 검증: {checked}개 섹터 확인, 불일치 {len(mismatches)}건")
    if mismatches:
        print("불일치 샘플:", mismatches[:5])


if __name__ == "__main__":
    main()
