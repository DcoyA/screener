"""
로컬에 OPENDART_API_KEY/KRX_API_KEY가 없어 scripts/update_data.py 전체를
처음부터(KRX/DART API 호출 포함) 다시 돌릴 수 없는 상황에서, 이미
app/data/stocks.json에 저장돼 있는 원본 재무/시세 데이터(revenue,
operatingIncome, netIncome, marketCap, closePrice 등 — 지난 실제 파이프라인
실행에서 이미 API로 받아온 값)를 그대로 입력으로 재사용해서, update_data.py에
새로 구현된 fair-value v2 로직(이익 정규화 / 섹터 부분회귀 목표가 밴드 /
백분위 등급)만 다시 계산해 stocks.json을 제자리에서 갱신한다.

update_data.py의 실제 함수(score_per, score_pbr, score_discount_bonus,
apply_rank_gate, build_timing_meta, attach_investment_meta 등)를 그대로
import해서 쓴다 — 로직을 따로 베껴 쓰지 않고 프로덕션 코드와 100% 동일한
계산을 보장하기 위해서다. 새 API 호출은 전혀 하지 않는다.

실행: python scripts/migrate_stocks_v2.py
"""

import os
import sys

# update_data.py는 모듈 최상단에서 OPENDART_API_KEY/KRX_API_KEY 존재 여부를
# 검사한다 — 여기서는 순수 계산 함수만 재사용하고 네트워크 호출은 전혀 하지
# 않을 것이므로, 그 검사를 통과시키기 위한 더미값만 넣어준다.
os.environ.setdefault("OPENDART_API_KEY", "local-migration-dummy")
os.environ.setdefault("KRX_API_KEY", "local-migration-dummy")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update_data as ud  # noqa: E402


def migrate():
    stocks = ud.load_json(ud.stocks_path, [])
    if not stocks:
        raise RuntimeError(f"{ud.stocks_path} 이 비어있거나 없습니다.")

    print(f"대상 종목: {len(stocks)}개")
    print(f"sector_map 로드: {len(ud.SECTOR_MAP)}건")

    # --- 1단계: 종목별 정규화 + PER 기반 스코어 재계산 (population 무관) ---
    for s in stocks:
        m = s["metrics"]
        operating_income = m.get("operatingIncome")
        net_income = m.get("netIncome")
        market_cap = m.get("marketCap")
        equity = m.get("equity")
        debt_ratio = m.get("debtRatio")

        normalized_ni, weight, applied = ud.normalize_net_income(operating_income, net_income)

        per = None
        if market_cap and market_cap > 0 and normalized_ni and normalized_ni > 0:
            per = market_cap / normalized_ni

        pbr = None
        if market_cap and market_cap > 0 and equity and equity > 0:
            pbr = market_cap / equity

        per_score = ud.score_per(per)
        pbr_score = ud.score_pbr(pbr)
        discount_bonus = ud.score_discount_bonus(per, pbr)
        value_score = per_score + pbr_score + discount_bonus

        quality_score = s.get("qualityScore", 0)
        safety_score = s.get("safetyScore", 0)
        market_score = s.get("marketScore", 0)
        change_score = s.get("changeScore", 0)
        raw_total_score = value_score + quality_score + safety_score + market_score + change_score

        total_score, rank_penalty, rank_flags, top_rank_eligible = ud.apply_rank_gate(
            raw_total_score, debt_ratio, operating_income, net_income, equity
        )

        m["normalizedNetIncome"] = round(normalized_ni, 0) if normalized_ni is not None else None
        m["netIncomeNormalized"] = applied
        m["normalizationWeight"] = round(weight, 3)
        m["per"] = round(per, 2) if per is not None else None
        m["pbr"] = round(pbr, 2) if pbr is not None else None
        # 목표가 밴드/upside는 2단계(population 통계)에서 채운다 — 우선 비운다.
        m["targetPrice"] = None
        m["targetPriceConservative"] = None
        m["targetPriceOptimistic"] = None
        m["upside"] = None

        s["valueScore"] = value_score
        s["rawTotalScore"] = raw_total_score
        s["totalScore"] = total_score
        s["modelVersion"] = ud.MODEL_VERSION
        s["sectorCode"] = (ud.SECTOR_MAP.get(s["code"]) or {}).get("ksic_중분류")

        sb = s.setdefault("scoreBreakdown", {})
        sb["value"] = value_score
        sb["perScore"] = per_score
        sb["pbrScore"] = pbr_score
        sb["discountBonus"] = discount_bonus

        s.setdefault("rankMeta", {})
        s["rankMeta"]["penalty"] = rank_penalty
        s["rankMeta"]["flags"] = rank_flags
        s["rankMeta"]["topRankEligible"] = top_rank_eligible

        s.setdefault("undervalueMeta", {})
        s["undervalueMeta"]["eligible"] = bool(
            equity
            and equity > 0
            and market_cap
            and market_cap >= ud.MIN_MARKET_CAP
            and m.get("avgTradeValue5d", 0) >= ud.MIN_AVG_TRADE_VALUE
            and per is not None
            and pbr is not None
        )

    print("1단계(정규화/스코어) 완료")

    # --- 2단계: 섹터 부분회귀 기반 목표가 밴드 (population 통계) ---
    sector_per_buckets = {}
    market_per_values = []
    for s in stocks:
        per_value = s["metrics"].get("per")
        if per_value and per_value > 0:
            market_per_values.append(per_value)
            code = s.get("sectorCode")
            if code:
                sector_per_buckets.setdefault(code, []).append(per_value)

    sector_per_stats = {code: ud.percentile_stats(v) for code, v in sector_per_buckets.items()}
    market_per_stats = ud.percentile_stats(market_per_values)
    print(
        f"섹터 표본: {len(sector_per_stats)}개 중분류, "
        f"시장 전체 표본 {market_per_stats['n'] if market_per_stats else 0}개"
    )

    for s in stocks:
        metrics = s["metrics"]
        per_value = metrics.get("per")
        close_price = metrics.get("closePrice") or 0
        if not per_value or per_value <= 0 or not close_price:
            s["fairValueMeta"] = {
                "sectorCode": s.get("sectorCode"),
                "sectorSampleTier": "fixed",
                "sectorSampleSize": 0,
                "regressionLambda": 0.0,
                "sectorMedianPerUsed": None,
            }
            continue

        sector_code = s.get("sectorCode")
        stats = sector_per_stats.get(sector_code) if sector_code else None
        if stats and stats["n"] >= ud.MIN_SECTOR_SAMPLE:
            lam = ud.REGRESSION_LAMBDA_FULL
            sample_tier = "sector"
        elif stats:
            lam = ud.REGRESSION_LAMBDA_LOW
            sample_tier = "sector_small"
        elif market_per_stats:
            stats = market_per_stats
            lam = ud.REGRESSION_LAMBDA_LOW
            sample_tier = "market"
        else:
            stats = None
            lam = 0.0
            sample_tier = "fixed"

        if stats:
            target_per_low = per_value + lam * (stats["p25"] - per_value)
            target_per_mid = per_value + lam * (stats["p50"] - per_value)
            target_per_high = per_value + lam * (stats["p75"] - per_value)
        else:
            target_per_low = target_per_mid = target_per_high = per_value

        target_price_low = int(close_price * (target_per_low / per_value))
        target_price_mid = int(close_price * (target_per_mid / per_value))
        target_price_high = int(close_price * (target_per_high / per_value))
        upside_raw = (target_price_mid - close_price) / close_price * 100

        metrics["targetPriceConservative"] = target_price_low
        metrics["targetPrice"] = target_price_mid
        metrics["targetPriceOptimistic"] = target_price_high
        metrics["upside"] = round(upside_raw, 1)

        display_label = None
        display_reason = None
        upside_capped = round(upside_raw, 1)
        if upside_raw > ud.UPSIDE_CAP_HIGH:
            upside_capped = ud.UPSIDE_CAP_HIGH
            display_label = "구조적 저평가 구간"
            display_reason = "실적변동성"
        elif upside_raw < ud.UPSIDE_CAP_LOW:
            upside_capped = ud.UPSIDE_CAP_LOW
            display_label = "구조적 고평가 구간"
            display_reason = "실적변동성"

        s["display"] = {
            "upsideLabel": display_label,
            "upsideLabelReason": display_reason,
            "upsideCapped": upside_capped,
        }
        s["fairValueMeta"] = {
            "sectorCode": sector_code,
            "sectorSampleTier": sample_tier,
            "sectorSampleSize": stats["n"] if stats else 0,
            "regressionLambda": lam,
            "sectorMedianPerUsed": stats["p50"] if stats else None,
        }

        # timingMeta가 upside를 참조하므로 다시 계산해야 한다.
        s["timingMeta"] = ud.build_timing_meta(s)

    print("2단계(목표가 밴드) 완료")

    # --- 3단계: sectorMeta/marketContext/finalPickMeta 재계산 (프로덕션 함수 재사용) ---
    stocks = ud.attach_investment_meta(stocks)
    print("3단계(finalPickMeta) 완료")

    # --- 4단계: 리스크 등급 재배정 (입력값 불변이라 결과는 기존과 동일해야 정상) ---
    sorted_by_risk = sorted(stocks, key=lambda s: s.get("riskMeta", {}).get("riskScore", 0))
    n = len(sorted_by_risk)
    for idx, s in enumerate(sorted_by_risk):
        percentile_rank = idx / max(n - 1, 1)
        if percentile_rank < ud.RISK_LOW_PCT:
            level = "낮음"
        elif percentile_rank < ud.RISK_MEDIUM_PCT:
            level = "보통"
        else:
            level = "주의"
        s["riskMeta"]["level"] = level

    # --- 5단계: 백분위 기반 등급 (S 상위7% / A 상위25% / B 상위65% / C 나머지, EXCLUDED=D) ---
    grade_order = ["S", "A", "B", "C", "D"]
    included_by_score = sorted(
        [s for s in stocks if s.get("finalPickMeta", {}).get("decision") == "INCLUDED"],
        key=lambda s: s.get("finalPickMeta", {}).get("finalScore", 0),
        reverse=True,
    )
    n_included = len(included_by_score)
    for idx, s in enumerate(included_by_score):
        rank_pct = (idx + 1) / max(n_included, 1)
        if rank_pct <= ud.GRADE_S_PCT:
            s["_gradeCodeRaw"] = "S"
        elif rank_pct <= ud.GRADE_A_PCT:
            s["_gradeCodeRaw"] = "A"
        elif rank_pct <= ud.GRADE_B_PCT:
            s["_gradeCodeRaw"] = "B"
        else:
            s["_gradeCodeRaw"] = "C"

    grade_counts = {"S": 0, "A": 0, "B": 0, "C": 0, "D": 0}
    for s in stocks:
        if s.get("finalPickMeta", {}).get("decision") == "EXCLUDED":
            grade_code = "D"
        else:
            grade_code = s.pop("_gradeCodeRaw", "C")

        downgraded = False
        risk_level = s.get("riskMeta", {}).get("level")
        if risk_level in ("높음", "주의") and grade_code != "D":
            idx = grade_order.index(grade_code)
            grade_code = grade_order[min(idx + 1, len(grade_order) - 1)]
            downgraded = True

        s["unifiedGradeCode"] = grade_code
        s["unifiedGradeDowngraded"] = downgraded
        grade_counts[grade_code] += 1

    print(f"5단계(등급) 완료: {grade_counts}")

    ud.save_json(ud.stocks_path, stocks)
    print(f"저장 완료: {ud.stocks_path}")


if __name__ == "__main__":
    migrate()
