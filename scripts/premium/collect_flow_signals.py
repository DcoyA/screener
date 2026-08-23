import os
import sys
import time
import json
from datetime import datetime, timedelta
from pykrx import stock
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

if not os.environ.get("KRX_ID") or not os.environ.get("KRX_PW"):
    print("[WARN] KRX_ID / KRX_PW 환경변수가 비어 있습니다.")

# 시가총액 상위 몇 개까지를 "후보 풀"로 볼지 (기본 300개)
TOP_N = int(os.environ.get("TOP_N", "300"))

# 종목 처리 사이 최소 지연 시간(초)
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "1.2"))

# 요일별로 몇 묶음(chunk)으로 나눌지. 월/화/목/금 = 4묶음
WEEKDAY_TO_CHUNK = {
    0: 0,  # 월요일 -> 1번 묶음
    1: 1,  # 화요일 -> 2번 묶음
    3: 2,  # 목요일 -> 3번 묶음
    4: 3,  # 금요일 -> 4번 묶음
}
TOTAL_CHUNKS = 4


def safe_call(func, *args, max_retries=3, **kwargs):
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except json.JSONDecodeError:
            wait = 5 * (attempt + 1)
            print(f"[WARN] {func.__name__} JSON decode 실패, {wait}초 대기 후 재시도 "
                  f"({attempt + 1}/{max_retries})")
            time.sleep(wait)
        except Exception as e:
            print(f"[ERROR] {func.__name__} 호출 실패: {e} "
                  f"({attempt + 1}/{max_retries})")
            time.sleep(3)
    return None


def get_market_cap_ranked_codes(target_date):
    """전체 시장 시가총액을 '딱 1번' 호출로 가져와서 상위 TOP_N개 코드를
    시가총액 내림차순으로 반환한다. 휴장일이면 최대 5일 전까지 거슬러 찾는다."""
    for back in range(0, 6):
        check_date = target_date - timedelta(days=back)
        date_str = check_date.strftime("%Y%m%d")
        df = safe_call(stock.get_market_cap_by_ticker, date_str, market="ALL")
        if df is not None and not df.empty:
            df_sorted = df.sort_values("시가총액", ascending=False)
            codes = df_sorted.index.tolist()[:TOP_N]
            print(f"{date_str} 기준 시가총액 데이터로 상위 {len(codes)}개 종목 확정")
            return codes
        print(f"{date_str}는 데이터 없음(휴장 추정), 하루 전으로 재시도")
    print("경고: 최근 6일간 시가총액 데이터를 가져오지 못했습니다.")
    return []


def get_today_chunk(all_codes, target_date):
    """오늘 요일에 해당하는 묶음(전체의 1/4)만 잘라서 반환한다."""
    weekday = target_date.weekday()  # 0=월 1=화 2=수 3=목 4=금 5=토 6=일
    chunk_index = WEEKDAY_TO_CHUNK.get(weekday)

    if chunk_index is None:
        print(f"[INFO] 오늘 요일({weekday})은 지정된 수집일이 아닙니다. 첫 묶음으로 실행합니다.")
        chunk_index = 0

    chunk_size = max(1, len(all_codes) // TOTAL_CHUNKS)
    start = chunk_index * chunk_size
    end = start + chunk_size if chunk_index < TOTAL_CHUNKS - 1 else len(all_codes)
    chunk = all_codes[start:end]
    print(f"오늘은 {chunk_index + 1}/{TOTAL_CHUNKS}번 묶음 처리: {len(chunk)}개 종목 "
          f"(전체 {len(all_codes)}개 중 {start}~{end})")
    return chunk


def fetch_flow_for_code(code, target_date):
    start = (target_date - timedelta(days=30)).strftime("%Y%m%d")
    end = target_date.strftime("%Y%m%d")
    df = safe_call(stock.get_market_trading_value_by_date, start, end, code)
    if df is None or df.empty:
        return None
    return df


def compute_short_balance_change(code, target_date):
    start = (target_date - timedelta(days=15)).strftime("%Y%m%d")
    end = target_date.strftime("%Y%m%d")
    df = safe_call(stock.get_shorting_balance_by_date, start, end, code)
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

    ranked_codes = get_market_cap_ranked_codes(target_date)
    if not ranked_codes:
        print("시가총액 순위를 가져오지 못해 종료합니다.")
        sys.exit(1)

    codes = get_today_chunk(ranked_codes, target_date)
    print(f"오늘 실제 수급 데이터 수집 대상: {len(codes)}개 종목 (기준일 {date_str})")

    rows = []
    skipped = 0
    for i, code in enumerate(codes, start=1):
        df = fetch_flow_for_code(code, target_date)
        if df is None:
            skipped += 1
            time.sleep(SLEEP_SECONDS)
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

        if i % 20 == 0:
            print(f"진행 상황: {i}/{len(codes)} (스킵 {skipped}건)")

        time.sleep(SLEEP_SECONDS)

    print(f"수집 완료: 성공 {len(rows)}건, 스킵 {skipped}건")

    if not rows:
        print("수집된 데이터가 없습니다. 종료합니다.")
        sys.exit(1)

    result = supabase.table("flow_signals").upsert(rows, on_conflict="code,date").execute()
    print(f"flow_signals에 {len(rows)}건 upsert 완료")


if __name__ == "__main__":
    main()
