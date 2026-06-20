#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
주식 + ETF + 시장상태 통합 파이프라인 실행기

기본 흐름
1) update_data.py 실행 -> stocks.json / risks.json / reports.json / history.json 생성
2) update_etf_universe.py 실행 -> etf_master.json -> etf_universe.json 생성
3) generate_market_state.py 실행 -> market_state.json 생성

주의
- 실제 레포 파일명이 다르면 --update-script / --market-script / --etf-script 로 경로 지정 가능
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def run_step(command, label):
    print(f"\n[RUN] {label}: {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        raise RuntimeError(f"step failed: {label}")


def parse_args():
    parser = argparse.ArgumentParser(description="데이터 파이프라인 일괄 실행")
    parser.add_argument("--python", default=sys.executable, help="python interpreter")
    parser.add_argument("--update-script", default="update_data.py", help="주식 데이터 업데이트 스크립트")
    parser.add_argument("--etf-script", default="update_etf_universe.py", help="ETF 유니버스 업데이트 스크립트")
    parser.add_argument("--market-script", default="generate_market_state.py", help="시장 상태 생성 스크립트")
    parser.add_argument("--stocks", default="app/data/stocks.json", help="market state용 stocks 입력")
    parser.add_argument("--sector-map", default="sectorMap.json", help="market state용 sector map 입력")
    parser.add_argument("--override", default="market_context_override.json", help="시장 문구 override JSON")
    parser.add_argument("--output", default="app/data/market_state.json", help="market state 출력 경로")
    parser.add_argument("--skip-etf", action="store_true", help="ETF 유니버스 생성을 건너뜀")
    parser.add_argument("--skip-market", action="store_true", help="market_state 생성을 건너뜀")
    return parser.parse_args()


def main():
    args = parse_args()

    py = args.python
    update_script = Path(args.update_script)
    etf_script = Path(args.etf_script)
    market_script = Path(args.market_script)

    if not update_script.exists():
        raise RuntimeError(f"update script not found: {update_script}")
    run_step([py, str(update_script)], "stocks/risk/report update")

    if not args.skip_etf:
        if not etf_script.exists():
            raise RuntimeError(f"ETF script not found: {etf_script}")
        run_step([py, str(etf_script)], "ETF universe update")

    if not args.skip_market:
        if not market_script.exists():
            raise RuntimeError(f"market state script not found: {market_script}")
        run_step(
            [
                py, str(market_script),
                "--stocks", args.stocks,
                "--sector-map", args.sector_map,
                "--override", args.override,
                "--output", args.output,
            ],
            "market state generation",
        )

    print("\n[DONE] data pipeline completed")


if __name__ == "__main__":
    main()
