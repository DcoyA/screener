import os
import sys
from datetime import datetime, timedelta
from pykrx import stock
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_target_codes():
    """우량주스카우터가 이미 관리하는 종목 코드 목록을 재사용한다."""
    resp = supabase.table("latest_stock_snapshots").select("code").execute()
    codes = sorted({row["code"] for row in resp.data if row.get("code")})
    if not codes:
        print("경고: latest_stock_snapshots에서 코드를 가져오지 못했습니다.")
    return codes


def fetch_flow_for_code(code, target_date):
    """특정 종목의 최근 20거래일 투자자별 순매수 데이터를 가져온다."""
    start = (target_date - timedelta(days=30)).strftime("%Y%m%d")
    end = target_date.strftime("%Y%m%d")
    try:
        df = stock.get_market_trading_value_by_date(start, end, code)
    except Exception as e:
        print(f"[{code}] pykrx 조회 실패: {e}")
        return None
    if df is None or df.empty:
        return None
    return df


def compute_short_balance_change(code, target_date):
    """대차잔고 변화율(최근 대비 5거래일 전)을 계산한다."""
    start = (target_date - timedelta(days=15)).strftime("%Y%m%d")
    end = target_date.strftime("%Y%m%d")
    try:
        df = stock.get_shorting_balance_by_date(start, end, code)
    except Exception as e:
        print(f"[{code}] 대차잔고 조회 실패: {e}")
        return None
    if df is None or df.empty or len(df) < 2:
        return None
    latest = df.iloc[-1]
    prev = df.iloc[0]
    prev_balance = prev.get("공매도잔고", 0) or prev.get("잔고", 0)
    latest_balance = latest.get("공매도잔고", 0) or latest.get("잔고", 0)
    if not prev_balance:
        return None
    return round((latest_balance - prev_balance) / prev_balance * 100, 2)


def main():
    target_date = datetime.now()
    date_str = target_date.strftime("%Y-%m-%d")
    codes = get_target_codes()
    print(f"총 {len(codes)}개 종목 수급 데이터 수집 시작 (기준일 {date_str})")

    rows = []
    for code in codes:
        df = fetch_flow_for_code(code, target_date)
        if df is None:
            continue
        latest_row = df.iloc[-1]
        foreign_net = latest_row.get("외국인합계", 0)
        inst_net = latest_row.get("기관합계", 0)
        short_change = compute_short_balance_change(code, target_date)

        rows.append({
            "code": code,
            "date": date_str,
            "foreign_net_buy": float(foreign_net) if foreign_net is not None else None,
            "inst_net_buy": float(inst_net) if inst_net is not None else None,
            "short_balance_change_pct": short_change,
        })

    if not rows:
        print("수집된 데이터가 없습니다. 종료합니다.")
        sys.exit(1)

    result = supabase.table("flow_signals").upsert(rows, on_conflict="code,date").execute()
    print(f"flow_signals에 {len(rows)}건 upsert 완료")


if __name__ == "__main__":
    main()
