#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
대안 투자 / 시장 상태 자동 판정 스크립트

역할:
1) stocks.json을 읽어 현재 시장 상태를 규칙 기반으로 판정
2) 개별주 / ETF / 배당·방어 / 고위험 접근 중 무엇이 유리한지 점수화
3) ETF 추천까지 포함한 market_state.json 생성

입력 파일(기본값)
- stocks.json
- sectorMap.json (선택)
- market_context_override.json (선택)
- app/data/etf_universe.json (선택, 없으면 내장 ETF 후보 사용)

출력 파일
- market_state.json
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import mean
from typing import Any, Dict, List, Tuple


DEFAULT_ETF_UNIVERSE = [
    {
        "code": "091160",
        "name": "KODEX 반도체",
        "type": "sector",
        "sector": "반도체",
        "desc": "국내 반도체 대표 기업 묶음",
        "behavior": "업종 상승 초기에 강하게 반응",
    },
    {
        "code": "069500",
        "name": "KODEX 200",
        "type": "index",
        "sector": "지수",
        "desc": "코스피 대표 200 종목 추종",
        "behavior": "시장 방향성 추종에 적합",
    },
    {
        "code": "102110",
        "name": "TIGER 200",
        "type": "index",
        "sector": "지수",
        "desc": "코스피 200 지수 추종",
        "behavior": "개별주보다 분산형 대응에 유리",
    },
    {
        "code": "148020",
        "name": "TIGER 배당성장",
        "type": "dividend",
        "sector": "배당",
        "desc": "배당 + 성장 혼합형 ETF",
        "behavior": "하락장 방어 구간에서 상대적으로 안정적",
    },
    {
        "code": "233740",
        "name": "KODEX 코스닥150",
        "type": "index",
        "sector": "성장",
        "desc": "코스닥 성장주 중심 지수 추종",
        "behavior": "강한 상승장에 탄력적이지만 변동성 큼",
    },
]


# -----------------------------
# 유틸
# -----------------------------

def load_json(path: Path, default=None):
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, "", "-"):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def avg(values: List[float], default: float = 0.0) -> float:
    valid = [v for v in values if isinstance(v, (int, float))]
    return mean(valid) if valid else default


def now_kst_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def humanize_mode(mode_key: str) -> str:
    return {
        "stock_pick": "개별주",
        "etf": "ETF",
        "dividend_defensive": "배당/방어",
        "high_risk": "고위험",
    }.get(mode_key, mode_key)


# -----------------------------
# 필드 접근 헬퍼
# -----------------------------

def get_metric(stock: Dict[str, Any], *keys: str, default: float = 0.0) -> float:
    cur: Any = stock
    for key in keys:
        if isinstance(cur, dict) and key in cur:
            cur = cur[key]
        else:
            return default
    return to_float(cur, default)


def get_sector(stock: Dict[str, Any], sector_map: Dict[str, str]) -> str:
    code = str(stock.get("code", ""))
    sector = stock.get("sector") or stock.get("industry") or sector_map.get(code)
    return str(sector).strip() if sector else "미분류"


# -----------------------------
# 특징량 계산
# -----------------------------

def enrich_stock(stock: Dict[str, Any], sector_map: Dict[str, str]) -> Dict[str, Any]:
    total_score = to_float(stock.get("totalScore"), 0.0)
    raw_total_score = to_float(stock.get("rawTotalScore"), total_score)
    value_score = to_float(stock.get("valueScore"), 0.0)
    market_cap = get_metric(stock, "metrics", "marketCap", default=0.0)
    liquidity_5d = get_metric(stock, "metrics", "avgTradeValue5d", default=0.0)
    close_price = get_metric(stock, "metrics", "closePrice", default=0.0)
    target_price = get_metric(stock, "metrics", "targetPrice", default=0.0)
    upside = get_metric(stock, "metrics", "upside", default=0.0)
    debt_ratio = get_metric(stock, "metrics", "debtRatio", default=0.0)

    ret_5d = (
        get_metric(stock, "metrics", "return5d", default=float("nan"))
        if isinstance(stock.get("metrics"), dict)
        else to_float(stock.get("return5d"), float("nan"))
    )
    if ret_5d != ret_5d:
        ret_5d = to_float(stock.get("return5d"), float("nan"))

    ret_20d = (
        get_metric(stock, "metrics", "return20d", default=float("nan"))
        if isinstance(stock.get("metrics"), dict)
        else to_float(stock.get("return20d"), float("nan"))
    )
    if ret_20d != ret_20d:
        ret_20d = to_float(stock.get("return20d"), float("nan"))

    trade_value_ratio = (
        get_metric(stock, "metrics", "tradeValueVs5d", default=float("nan"))
        if isinstance(stock.get("metrics"), dict)
        else to_float(stock.get("tradeValueVs5d"), float("nan"))
    )
    if trade_value_ratio != trade_value_ratio:
        trade_value_ratio = to_float(stock.get("tradeValueVs5d"), float("nan"))

    foreign_net = (
        get_metric(stock, "metrics", "foreignNetBuy", default=float("nan"))
        if isinstance(stock.get("metrics"), dict)
        else to_float(stock.get("foreignNetBuy"), float("nan"))
    )
    if foreign_net != foreign_net:
        foreign_net = to_float(stock.get("foreignNetBuy"), float("nan"))

    inst_net = (
        get_metric(stock, "metrics", "institutionNetBuy", default=float("nan"))
        if isinstance(stock.get("metrics"), dict)
        else to_float(stock.get("institutionNetBuy"), float("nan"))
    )
    if inst_net != inst_net:
        inst_net = to_float(stock.get("institutionNetBuy"), float("nan"))

    rank_meta = stock.get("rankMeta") or {}
    undervalue_meta = stock.get("undervalueMeta") or {}
    rank_flags = list(rank_meta.get("flags") or [])
    undervalue_flags = list(undervalue_meta.get("flags") or [])
    penalty = to_float(rank_meta.get("penalty"), 0.0)
    top_rank_eligible = bool(rank_meta.get("topRankEligible"))
    undervalue_eligible = bool(undervalue_meta.get("eligible"))

    rebound_signal = False
    if ret_5d == ret_5d and ret_20d == ret_20d:
        rebound_signal = (ret_20d < 0) and (ret_5d > 0)

    liquidity_burst = False
    if trade_value_ratio == trade_value_ratio:
        liquidity_burst = trade_value_ratio >= 1.3

    investors_turn_positive = False
    if foreign_net == foreign_net or inst_net == inst_net:
        investors_turn_positive = (foreign_net if foreign_net == foreign_net else 0.0) + (
            inst_net if inst_net == inst_net else 0.0
        ) > 0

    risk_flag_count = len(rank_flags) + len(undervalue_flags)
    risk_score = penalty + risk_flag_count * 2
    if debt_ratio >= 200:
        risk_score += 5
    elif debt_ratio >= 120:
        risk_score += 2

    return {
        "code": str(stock.get("code", "")),
        "name": stock.get("name", ""),
        "market": stock.get("market", ""),
        "sector": get_sector(stock, sector_map),
        "summary": stock.get("summary", ""),
        "totalScore": total_score,
        "rawTotalScore": raw_total_score,
        "valueScore": value_score,
        "marketCap": market_cap,
        "avgTradeValue5d": liquidity_5d,
        "closePrice": close_price,
        "targetPrice": target_price,
        "upside": upside,
        "debtRatio": debt_ratio,
        "return5d": ret_5d if ret_5d == ret_5d else None,
        "return20d": ret_20d if ret_20d == ret_20d else None,
        "tradeValueVs5d": trade_value_ratio if trade_value_ratio == trade_value_ratio else None,
        "foreignNetBuy": foreign_net if foreign_net == foreign_net else None,
        "institutionNetBuy": inst_net if inst_net == inst_net else None,
        "topRankEligible": top_rank_eligible,
        "undervalueEligible": undervalue_eligible,
        "rankFlags": rank_flags,
        "undervalueFlags": undervalue_flags,
        "penalty": penalty,
        "reboundSignal": rebound_signal,
        "liquidityBurst": liquidity_burst,
        "investorsTurnPositive": investors_turn_positive,
        "riskScore": risk_score,
    }


# -----------------------------
# 시장 상태 판정
# -----------------------------

def build_feature_summary(stocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not stocks:
        return {
            "count": 0,
            "eligibleRatio": 0.0,
            "avgTotalScore": 0.0,
            "avgUpside": 0.0,
            "avgLiquidity5d": 0.0,
            "riskConcentration": 1.0,
            "momentumSupportRatio": 0.0,
            "reboundRatio": 0.0,
            "liquidityBurstRatio": 0.0,
            "investorPositiveRatio": 0.0,
            "sectorSpread": 0,
            "strongSectorCounts": {},
        }

    total_count = len(stocks)
    eligible = [s for s in stocks if s["topRankEligible"]]
    top_pool = sorted(
        stocks,
        key=lambda x: (x["topRankEligible"], x["totalScore"], x["avgTradeValue5d"]),
        reverse=True,
    )[:20]

    elig_ratio = len(eligible) / total_count if total_count else 0.0
    avg_total = avg([s["totalScore"] for s in top_pool], 0.0)
    avg_upside = avg([s["upside"] for s in top_pool], 0.0)
    avg_liquidity = avg([s["avgTradeValue5d"] for s in top_pool], 0.0)

    risk_values = [s["riskScore"] for s in top_pool]
    risk_concentration = sum(1 for r in risk_values if r >= 6) / len(risk_values) if risk_values else 1.0

    momentum_support = []
    rebound = []
    liquidity_burst = []
    investor_positive = []
    sector_counter = Counter()

    for s in top_pool:
        sector_counter[s["sector"]] += 1
        ret_5d = s.get("return5d")
        if ret_5d is not None and ret_5d > 0:
            momentum_support.append(1)
        elif ret_5d is not None:
            momentum_support.append(0)

        rebound.append(1 if s.get("reboundSignal") else 0)
        liquidity_burst.append(1 if s.get("liquidityBurst") else 0)
        investor_positive.append(1 if s.get("investorsTurnPositive") else 0)

    sector_spread = len([k for k in sector_counter.keys() if k and k != "미분류"])

    return {
        "count": total_count,
        "eligibleRatio": round(elig_ratio, 4),
        "avgTotalScore": round(avg_total, 2),
        "avgUpside": round(avg_upside, 2),
        "avgLiquidity5d": round(avg_liquidity, 2),
        "riskConcentration": round(risk_concentration, 4),
        "momentumSupportRatio": round(avg(momentum_support, 0.0), 4),
        "reboundRatio": round(avg(rebound, 0.0), 4),
        "liquidityBurstRatio": round(avg(liquidity_burst, 0.0), 4),
        "investorPositiveRatio": round(avg(investor_positive, 0.0), 4),
        "sectorSpread": sector_spread,
        "strongSectorCounts": dict(sector_counter.most_common(5)),
        "topPoolCodes": [s["code"] for s in top_pool[:10]],
    }


def score_modes(summary: Dict[str, Any]) -> Dict[str, float]:
    elig = summary["eligibleRatio"]
    avg_total = summary["avgTotalScore"]
    avg_upside = summary["avgUpside"]
    risk = summary["riskConcentration"]
    momentum = summary["momentumSupportRatio"]
    rebound = summary["reboundRatio"]
    burst = summary["liquidityBurstRatio"]
    investor = summary["investorPositiveRatio"]
    sector_spread = summary["sectorSpread"]

    stock_pick = 0.0
    stock_pick += elig * 28
    stock_pick += clamp((avg_total - 60) / 25, 0, 1) * 18
    stock_pick += clamp(avg_upside / 20, 0, 1.2) * 12
    stock_pick += momentum * 14
    stock_pick += rebound * 8
    stock_pick += burst * 10
    stock_pick += investor * 8
    stock_pick += clamp(sector_spread / 6, 0, 1) * 6
    stock_pick -= risk * 12

    etf = 0.0
    etf += clamp(sector_spread / 6, 0, 1.2) * 22
    etf += clamp((0.75 - elig) / 0.75, 0, 1) * 18
    etf += clamp((0.7 - momentum) / 0.7, 0, 1) * 12
    etf += clamp((0.8 - burst) / 0.8, 0, 1) * 8
    etf += clamp(avg_upside / 18, 0, 1.1) * 8
    etf += risk * 18
    etf += 10

    dividend_defensive = 0.0
    dividend_defensive += risk * 28
    dividend_defensive += clamp((0.55 - momentum) / 0.55, 0, 1) * 16
    dividend_defensive += clamp((0.45 - rebound) / 0.45, 0, 1) * 10
    dividend_defensive += clamp((0.65 - elig) / 0.65, 0, 1) * 14
    dividend_defensive += clamp((12 - avg_upside) / 12, 0, 1) * 12
    dividend_defensive += 8

    high_risk = 0.0
    high_risk += momentum * 22
    high_risk += burst * 28
    high_risk += investor * 16
    high_risk += clamp(avg_upside / 25, 0, 1.2) * 12
    high_risk += rebound * 10
    high_risk -= risk * 18

    return {
        "stock_pick": round(clamp(stock_pick, 0, 100), 2),
        "etf": round(clamp(etf, 0, 100), 2),
        "dividend_defensive": round(clamp(dividend_defensive, 0, 100), 2),
        "high_risk": round(clamp(high_risk, 0, 100), 2),
    }


def select_mode_labels(mode_scores: Dict[str, float]) -> Tuple[List[str], List[str]]:
    ranked = sorted(mode_scores.items(), key=lambda x: x[1], reverse=True)
    preferred = [k for k, _ in ranked[:2]]
    avoided = [k for k, _ in ranked if k not in preferred]

    if "high_risk" not in avoided and mode_scores.get("high_risk", 0) < 55:
        avoided = [m for m in avoided if m != "high_risk"] + ["high_risk"]

    return preferred, avoided[:2]


def determine_market_tone(summary: Dict[str, Any], mode_scores: Dict[str, float]) -> str:
    stock_pick = mode_scores["stock_pick"]
    etf = mode_scores["etf"]
    defensive = mode_scores["dividend_defensive"]

    if stock_pick >= 68 and summary["momentumSupportRatio"] >= 0.55 and summary["riskConcentration"] <= 0.35:
        return "공격 가능"
    if defensive >= 60 and summary["riskConcentration"] >= 0.4:
        return "보수 우위"
    if etf >= 58:
        return "분산 접근 우위"
    return "중립"


def build_top_sector_notes(summary: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    sectors = [(k, v) for k, v in summary.get("strongSectorCounts", {}).items() if k and k != "미분류"]
    strong = [k for k, _ in sectors[:3]]
    weak: List[str] = []
    return strong, weak


def generate_one_line_summary(market_tone: str, preferred_modes: List[str], summary: Dict[str, Any]) -> str:
    pref_labels = [humanize_mode(m) for m in preferred_modes]
    momentum = summary["momentumSupportRatio"]
    risk = summary["riskConcentration"]

    if market_tone == "공격 가능":
        return f"현재는 개별주 해석이 비교적 유리한 구간이며, {' / '.join(pref_labels[:2])} 중심 접근이 적합합니다."
    if market_tone == "보수 우위":
        return f"현재는 공격보다 방어가 중요한 구간으로, {' / '.join(pref_labels[:2])} 관점이 더 유리합니다."
    if market_tone == "분산 접근 우위":
        return f"지금은 개별주 추격보다 {' / '.join(pref_labels[:2])}처럼 분산형 접근이 더 적합한 구간입니다."
    if momentum >= 0.5 and risk <= 0.35:
        return f"방향성은 있으나 선별이 필요한 구간으로, {' / '.join(pref_labels[:2])} 접근을 병행하는 것이 유리합니다."
    return f"현재는 확신형 장세보다 확인형 장세에 가깝고, {' / '.join(pref_labels[:2])} 관점으로 보는 편이 무난합니다."


def build_strategy_notes(market_tone: str, preferred_modes: List[str], avoided_modes: List[str], summary: Dict[str, Any]) -> List[str]:
    notes: List[str] = []
    momentum = summary["momentumSupportRatio"]
    rebound = summary["reboundRatio"]
    burst = summary["liquidityBurstRatio"]
    risk = summary["riskConcentration"]

    pref_labels = [humanize_mode(m) for m in preferred_modes]
    avoid_labels = [humanize_mode(m) for m in avoided_modes]

    notes.append(f"오늘은 {' / '.join(pref_labels[:2])} 관점 우선으로 보는 편이 유리합니다.")
    if momentum < 0.45:
        notes.append("최근 단기 모멘텀 지지 종목 비중이 낮아 추격형 접근은 보수적으로 보는 편이 좋습니다.")
    if rebound >= 0.3:
        notes.append("일부 종목은 반등 신호가 나타나고 있어, 추세 추종보다 반등 확인형 접근이 유효할 수 있습니다.")
    if burst >= 0.35:
        notes.append("거래대금 증가 종목이 늘고 있어, 실제로 돈이 몰리는 구간인지 함께 확인할 필요가 있습니다.")
    if risk >= 0.4:
        notes.append("위험 플래그가 많은 종목 비중이 높아 방어적 접근 비중을 같이 가져가는 편이 낫습니다.")
    if avoid_labels:
        notes.append(f"오늘은 {' / '.join(avoid_labels[:1])} 접근은 상대적으로 보수적으로 보는 편이 좋습니다.")
    return notes[:4]


def build_approach_cards(mode_scores: Dict[str, float], preferred: List[str], avoided: List[str]) -> List[Dict[str, Any]]:
    cards = []
    descriptions = {
        "stock_pick": "좋은 기업 중 지금 실제로 반응 가능한 후보를 선별하는 접근",
        "etf": "개별 종목보다 업종/지수 분산으로 방향성에 대응하는 접근",
        "dividend_defensive": "공격보다 방어와 안정에 무게를 두는 접근",
        "high_risk": "레버리지·고변동 상품처럼 짧고 강한 방향 베팅에 가까운 접근",
    }

    for key in ["stock_pick", "etf", "dividend_defensive", "high_risk"]:
        score = mode_scores.get(key, 0.0)
        if key in preferred:
            status = "유리"
        elif key in avoided:
            status = "보수"
        else:
            status = "중립"

        cards.append(
            {
                "key": key,
                "label": humanize_mode(key),
                "score": round(score, 2),
                "status": status,
                "description": descriptions[key],
            }
        )
    return cards


def build_today_stock_reason(stock: Dict[str, Any]) -> str:
    chunks = []
    if stock["topRankEligible"]:
        chunks.append("종합 조건 통과")
    if stock["totalScore"] >= 70:
        chunks.append(f"총점 {int(round(stock['totalScore']))}점")
    # CLAUDE.md 상승여력 표기 상한(+60%): 원문 숫자를 그대로 문장에 구워 넣지 않는다.
    if stock["upside"] > 60:
        chunks.append("상승여력 구조적 할인 구간")
    elif stock["upside"] > 0:
        chunks.append(f"상승여력 {round(stock['upside'], 1)}%")
    if stock.get("liquidityBurst"):
        chunks.append("거래대금 증가 신호")
    if stock.get("reboundSignal"):
        chunks.append("반등 신호")
    if stock.get("rankFlags"):
        chunks.append(stock["rankFlags"][0])
    return " · ".join(chunks[:4]) if chunks else "현재 기준으로 가장 균형이 좋은 후보입니다."


def pick_today_candidates(stocks: List[Dict[str, Any]], preferred_modes: List[str]) -> Dict[str, Any]:
    def stock_pick_score(s: Dict[str, Any]) -> float:
        score = 0.0
        score += s["totalScore"] * 0.55
        score += clamp(s["upside"], -10, 25) * 0.8
        score += clamp((s["avgTradeValue5d"] / 20_000_000_000), 0, 2) * 8
        score += 4 if s["topRankEligible"] else 0
        score += 3 if s.get("liquidityBurst") else 0
        score += 2 if s.get("reboundSignal") else 0
        score += 2 if s.get("investorsTurnPositive") else 0
        score -= s["riskScore"] * 1.5
        return score

    eligible = [s for s in stocks if s["topRankEligible"]]
    base_pool = eligible if eligible else stocks
    today_stock = sorted(base_pool, key=stock_pick_score, reverse=True)[0] if base_pool else None

    today_alternative = None
    if preferred_modes:
        alt = preferred_modes[0]
        if alt == "stock_pick" and len(preferred_modes) > 1:
            alt = preferred_modes[1]
        today_alternative = {
            "mode": alt,
            "label": humanize_mode(alt),
            "reason": {
                "etf": "개별주보다 업종/지수 분산 접근이 더 나은 구간으로 해석됩니다.",
                "dividend_defensive": "공격보다 방어가 유리한 구간으로, 배당·방어형 접근이 상대적으로 적합합니다.",
                "high_risk": "모멘텀은 있으나 변동성도 큰 구간이므로 초보에게는 보수적으로 권합니다.",
                "stock_pick": "현재는 개별주 해석이 가장 유리한 구간입니다.",
            }.get(alt, "현재 시장 상태상 이 접근이 대안이 될 수 있습니다."),
        }

    stock_payload = None
    if today_stock:
        stock_payload = {
            "code": today_stock["code"],
            "name": today_stock["name"],
            "market": today_stock["market"],
            "sector": today_stock["sector"],
            "totalScore": today_stock["totalScore"],
            "upside": today_stock["upside"],
            "avgTradeValue5d": today_stock["avgTradeValue5d"],
            "summary": today_stock["summary"],
            "whyNow": build_today_stock_reason(today_stock),
        }

    return {
        "todayStock": stock_payload,
        "todayAlternative": today_alternative,
    }


def load_etf_universe() -> List[Dict[str, Any]]:
    candidate_paths = [
        Path("app/data/etf_universe.json"),
        Path("data/etf_universe.json"),
        Path("etf_universe.json"),
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                return load_json(p, default=DEFAULT_ETF_UNIVERSE)
            except Exception:
                return DEFAULT_ETF_UNIVERSE
    return DEFAULT_ETF_UNIVERSE


def recommend_etfs(market_tone: str, strong_sectors: List[str]) -> List[Dict[str, Any]]:
    etfs = load_etf_universe()
    recommendations = []

    for etf in etfs:
        score = 0
        reason_parts: List[str] = []

        if etf.get("sector") and etf.get("sector") in strong_sectors:
            score += 3
            reason_parts.append(f"{etf['sector']} 업종이 현재 상위에서 강하게 포착됨")

        if market_tone in ["중립", "분산 접근 우위"] and etf.get("type") == "index":
            score += 2
            reason_parts.append("개별주보다 지수 추종이 유리한 구간")

        if market_tone == "보수 우위" and etf.get("type") == "dividend":
            score += 3
            reason_parts.append("위험 구간에서는 배당/방어형이 유리")

        if market_tone == "공격 가능" and etf.get("type") == "sector" and etf.get("sector") in strong_sectors:
            score += 1
            reason_parts.append("업종 강세 구간에서 개별주 대안으로 적합")

        if score > 0:
            recommendations.append(
                {
                    "code": etf.get("code", ""),
                    "name": etf.get("name", ""),
                    "reason": " / ".join(reason_parts) if reason_parts else "현재 시장 상태상 대안 접근용 ETF",
                    "desc": etf.get("desc", ""),
                    "behavior": etf.get("behavior", ""),
                    "score": score,
                    "type": etf.get("type", ""),
                    "sector": etf.get("sector", ""),
                }
            )

    recommendations.sort(key=lambda x: (x["score"], x["name"]), reverse=True)
    return recommendations[:3]


def apply_overrides(payload: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    if not override:
        return payload

    merged = dict(payload)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            tmp = dict(merged[key])
            tmp.update(value)
            merged[key] = tmp
        else:
            merged[key] = value
    return merged


# -----------------------------
# 메인 실행
# -----------------------------

def build_market_state(stocks_path: Path, sector_map_path: Path, override_path: Path) -> Dict[str, Any]:
    raw_stocks = load_json(stocks_path, default=[])
    sector_map = load_json(sector_map_path, default={})
    override = load_json(override_path, default={})

    if not raw_stocks:
        raise ValueError("stocks.json이 비어 있어 시장 상태를 계산할 수 없습니다.")

    stocks = [enrich_stock(stock, sector_map) for stock in raw_stocks]
    feature_summary = build_feature_summary(stocks)
    mode_scores = score_modes(feature_summary)
    preferred_modes, avoided_modes = select_mode_labels(mode_scores)
    market_tone = determine_market_tone(feature_summary, mode_scores)
    one_line_summary = generate_one_line_summary(market_tone, preferred_modes, feature_summary)
    strategy_notes = build_strategy_notes(market_tone, preferred_modes, avoided_modes, feature_summary)
    approach_cards = build_approach_cards(mode_scores, preferred_modes, avoided_modes)
    today_candidates = pick_today_candidates(stocks, preferred_modes)
    strong_sectors, weak_sectors = build_top_sector_notes(feature_summary)
    etf_recommendations = recommend_etfs(market_tone, strong_sectors)

    payload = {
        "generatedAt": now_kst_iso(),
        "source": {
            "stocks": str(stocks_path),
            "sectorMap": str(sector_map_path) if sector_map_path.exists() else None,
            "override": str(override_path) if override_path.exists() else None,
        },
        "header": {
            "title": "대안 투자",
            "summary": one_line_summary,
            "marketTone": market_tone,
        },
        "signals": feature_summary,
        "modeScores": mode_scores,
        "preferredModes": [humanize_mode(x) for x in preferred_modes],
        "avoidModes": [humanize_mode(x) for x in avoided_modes],
        "approachCards": approach_cards,
        "topSectors": {
            "strong": strong_sectors,
            "weak": weak_sectors,
        },
        "strategyNotes": strategy_notes,
        "today": today_candidates,
        "etfRecommendations": etf_recommendations,
        "disclaimer": "본 결과는 규칙 기반 시장 상태 판정이며, 확정 수익이나 특정 매매를 보장하지 않습니다.",
    }

    payload = apply_overrides(payload, override)
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="시장 상태 자동 판정 + 대안 투자 페이지용 JSON 생성")
    parser.add_argument("--stocks", default="stocks.json", help="stocks.json 경로")
    parser.add_argument("--sector-map", dest="sector_map", default="sectorMap.json", help="sectorMap.json 경로 (선택)")
    parser.add_argument(
        "--override",
        default="market_context_override.json",
        help="운영자가 일부 문구/값을 덮어쓸 override JSON 경로 (선택)",
    )
    parser.add_argument("--output", default="market_state.json", help="출력 JSON 경로")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    stocks_path = Path(args.stocks)
    sector_map_path = Path(args.sector_map)
    override_path = Path(args.override)
    output_path = Path(args.output)

    payload = build_market_state(stocks_path, sector_map_path, override_path)

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("[완료] market_state.json 생성")
    print(f"- 출력 파일: {output_path}")
    print(f"- 시장 톤: {payload['header']['marketTone']}")
    print(f"- 한 줄 요약: {payload['header']['summary']}")
    print(f"- 유리한 접근: {', '.join(payload['preferredModes'])}")
    print(f"- ETF 추천: {', '.join([x['name'] for x in payload.get('etfRecommendations', [])]) or '없음'}")


if __name__ == "__main__":
    main()
