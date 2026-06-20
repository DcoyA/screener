#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETF master DB -> 운영 유니버스 자동 선별 스크립트

역할
- app/data/etf_master.json 을 읽어 추천/노출용 app/data/etf_universe.json 생성
- 너무 많은 ETF를 그대로 노출하지 않고, 유동성/대표성/설명 가능성 기준으로 선별
- generate_market_state.py 가 바로 읽을 수 있는 형태로 저장

입력 예시 필드(일부만 있어도 동작)
- code, name, manager, launchDate, benchmark, riskLevel
- return1m, return3m, return6m, return1y
- topHoldings (array)
- avgTradeValue5d or avgVolume or aum
- assetClass, region, sector, theme
- leveraged, inverse, hedged

출력 필드
- code, name, type, sector, desc, behavior, riskLevel, manager, launchDate,
  benchmark, return1m, return3m, return6m, return1y, topHoldings, priority,
  reviewNeeded, tags, scoreMeta
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


def load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return default


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, "", "-"):
            return default
        return float(value)
    except Exception:
        return default


def normalize_code(value: Any) -> str:
    text = "".join(ch for ch in str(value or "") if ch.isdigit())
    return text[-6:].zfill(6) if text else ""


def normalize_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        items = []
        for chunk in value.replace("\n", ",").replace("/", ",").split(","):
            chunk = chunk.strip()
            if chunk:
                items.append(chunk)
        return items
    return []


def guess_type(item: Dict[str, Any]) -> str:
    asset_class = str(item.get("assetClass") or "").lower()
    sector = str(item.get("sector") or "")
    theme = str(item.get("theme") or "")
    name = str(item.get("name") or "")

    if "bond" in asset_class or "채권" in name:
        return "bond"
    if "commodity" in asset_class or "금" in name or "gold" in name.lower():
        return "commodity"
    if "dividend" in asset_class or "배당" in name:
        return "dividend"
    if theme:
        return "theme"
    if sector and sector not in ("지수", "미국지수"):
        return "sector"
    if "미국" in name or "s&p" in name.lower() or "nasdaq" in name.lower():
        return "global"
    return "index"


def guess_sector(item: Dict[str, Any]) -> str:
    sector = str(item.get("sector") or "").strip()
    if sector:
        return sector
    name = str(item.get("name") or "")
    if "반도체" in name:
        return "반도체"
    if "배당" in name:
        return "배당"
    if "채권" in name or "KOFR" in name or "국고채" in name:
        return "채권"
    if "미국" in name or "S&P" in name or "나스닥" in name:
        return "미국지수"
    if "골드" in name or "금" in name:
        return "금"
    if "코스닥" in name:
        return "성장"
    return "지수"


def build_desc(item: Dict[str, Any]) -> str:
    if item.get("desc"):
        return str(item["desc"])
    benchmark = str(item.get("benchmark") or "").strip()
    if benchmark:
        return benchmark
    return "대표 지수/섹터 흐름을 추종하는 ETF"


def build_behavior(item: Dict[str, Any]) -> str:
    if item.get("behavior"):
        return str(item["behavior"])
    t = guess_type(item)
    if t == "bond":
        return "주식 대비 변동성이 낮고 방어적으로 움직이는 편"
    if t == "dividend":
        return "변동성 확대 구간에서 상대적으로 방어적일 수 있음"
    if t in ("sector", "theme"):
        return "업종/테마 기대가 커질 때 상대적으로 민감하게 반응"
    if t == "global":
        return "해외 지수와 환율 흐름에 함께 영향을 받을 수 있음"
    return "시장 전체 방향을 비교적 직관적으로 반영"


def compute_liquidity_proxy(item: Dict[str, Any]) -> float:
    avg_trade_value = to_float(item.get("avgTradeValue5d"), 0.0)
    avg_volume = to_float(item.get("avgVolume"), 0.0)
    aum = to_float(item.get("aum"), 0.0)
    return max(avg_trade_value, avg_volume * 1000.0, aum * 0.02)


def compute_priority(item: Dict[str, Any]) -> int:
    score = 0
    liq = compute_liquidity_proxy(item)
    if liq >= 100_0000_0000:
        score += 3
    elif liq >= 30_0000_0000:
        score += 2
    elif liq >= 10_0000_0000:
        score += 1

    if item.get("manager"):
        score += 1
    if item.get("launchDate"):
        score += 1
    if item.get("benchmark"):
        score += 1
    if normalize_list(item.get("topHoldings")):
        score += 1

    t = guess_type(item)
    if t in ("index", "bond", "dividend", "global"):
        score += 1

    return min(score, 5)


def build_tags(item: Dict[str, Any]) -> List[str]:
    tags = []
    for key in ["sector", "theme", "assetClass", "region"]:
        value = str(item.get(key) or "").strip()
        if value:
            tags.append(value)
    t = guess_type(item)
    if t == "index":
        tags.extend(["대표지수", "분산"])
    elif t == "global":
        tags.extend(["글로벌", "분산"])
    elif t == "bond":
        tags.extend(["안정", "방어"])
    elif t == "dividend":
        tags.extend(["배당", "방어"])
    elif t == "sector":
        tags.extend(["업종", guess_sector(item)])
    elif t == "theme":
        tags.extend(["테마", guess_sector(item)])
    seen = set()
    result = []
    for tag in tags:
        if tag and tag not in seen:
            seen.add(tag)
            result.append(tag)
    return result[:10]


def include_in_universe(item: Dict[str, Any], min_liquidity: float, allow_leveraged: bool, allow_inverse: bool) -> bool:
    code = normalize_code(item.get("code"))
    name = str(item.get("name") or "").strip()
    if not code or not name:
        return False

    if (item.get("leveraged") is True or "레버리지" in name) and not allow_leveraged:
        return False
    if (item.get("inverse") is True or "인버스" in name) and not allow_inverse:
        return False
    if "ETN" in name.upper():
        return False

    liq = compute_liquidity_proxy(item)
    if liq < min_liquidity:
        return False

    return True


def dedupe_by_benchmark(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    chosen = {}
    result = []
    for item in items:
        benchmark = str(item.get("benchmark") or item.get("name") or "").strip().lower()
        key = benchmark or normalize_code(item.get("code"))
        current = chosen.get(key)
        if current is None:
            chosen[key] = item
            result.append(item)
            continue

        current_priority = compute_priority(current)
        item_priority = compute_priority(item)
        if item_priority > current_priority:
            idx = result.index(current)
            result[idx] = item
            chosen[key] = item
    return result


def transform(item: Dict[str, Any]) -> Dict[str, Any]:
    code = normalize_code(item.get("code"))
    top_holdings = normalize_list(item.get("topHoldings") or item.get("holdings"))
    transformed = {
        "code": code,
        "name": str(item.get("name") or "").strip(),
        "type": guess_type(item),
        "sector": guess_sector(item),
        "manager": str(item.get("manager") or item.get("provider") or item.get("operator") or "").strip(),
        "launchDate": str(item.get("launchDate") or item.get("inceptionDate") or item.get("listedDate") or "").strip(),
        "benchmark": str(item.get("benchmark") or item.get("indexName") or "").strip(),
        "riskLevel": str(item.get("riskLevel") or "").strip() or "보통",
        "return1m": to_float(item.get("return1m") or item.get("returns", {}).get("m1") or item.get("perf", {}).get("m1"), None),
        "return3m": to_float(item.get("return3m") or item.get("returns", {}).get("m3") or item.get("perf", {}).get("m3"), None),
        "return6m": to_float(item.get("return6m") or item.get("returns", {}).get("m6") or item.get("perf", {}).get("m6"), None),
        "return1y": to_float(item.get("return1y") or item.get("returns", {}).get("y1") or item.get("perf", {}).get("y1"), None),
        "topHoldings": top_holdings,
        "desc": build_desc(item),
        "behavior": build_behavior(item),
        "priority": compute_priority(item),
        "reviewNeeded": False,
        "tags": build_tags(item),
        "scoreMeta": {
            "liquidityProxy": compute_liquidity_proxy(item),
            "hasManager": bool(item.get("manager") or item.get("provider") or item.get("operator")),
            "hasLaunchDate": bool(item.get("launchDate") or item.get("inceptionDate") or item.get("listedDate")),
            "hasBenchmark": bool(item.get("benchmark") or item.get("indexName")),
            "hasTopHoldings": bool(top_holdings),
        },
    }
    return transformed


def build_universe(master_items: List[Dict[str, Any]], min_liquidity: float, allow_leveraged: bool, allow_inverse: bool, dedupe: bool) -> List[Dict[str, Any]]:
    filtered = [
        transform(item)
        for item in master_items
        if include_in_universe(item, min_liquidity=min_liquidity, allow_leveraged=allow_leveraged, allow_inverse=allow_inverse)
    ]
    if dedupe:
        filtered = dedupe_by_benchmark(filtered)
    filtered.sort(
        key=lambda x: (
            int(x.get("priority", 0)),
            to_float(x.get("scoreMeta", {}).get("liquidityProxy"), 0.0),
            str(x.get("name") or ""),
        ),
        reverse=True,
    )
    return filtered


def parse_args():
    parser = argparse.ArgumentParser(description="ETF master DB에서 운영 유니버스 생성")
    parser.add_argument("--input", default="app/data/etf_master.json", help="입력 master JSON 경로")
    parser.add_argument("--output", default="app/data/etf_universe.json", help="출력 universe JSON 경로")
    parser.add_argument("--min-liquidity", type=float, default=10_0000_0000, help="최소 유동성 프록시 (기본 10억원)")
    parser.add_argument("--allow-leveraged", action="store_true", help="레버리지 ETF 포함")
    parser.add_argument("--allow-inverse", action="store_true", help="인버스 ETF 포함")
    parser.add_argument("--no-dedupe", action="store_true", help="동일/유사지수 중복 제거 비활성화")
    return parser.parse_args()


def main():
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    master_items = load_json(input_path, [])
    if not master_items:
        raise RuntimeError(f"ETF master DB가 비어 있습니다: {input_path}")

    universe = build_universe(
        master_items,
        min_liquidity=args.min_liquidity,
        allow_leveraged=args.allow_leveraged,
        allow_inverse=args.allow_inverse,
        dedupe=(not args.no_dedupe),
    )
    save_json(output_path, universe)

    print(f"ETF universe build completed: input={input_path}, output={output_path}, count={len(universe)}")


if __name__ == "__main__":
    main()
