import os
import sys
import time
import json
from datetime import timedelta
from pathlib import Path
from pykrx import stock
from supabase import create_client

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.lib.kst import kst_now, kst_today_str, kst_weekday  # noqa: E402

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

if not os.environ.get("KRX_ID") or not os.environ.get("KRX_PW"):
    print("[WARN] KRX_ID / KRX_PW 환경변수가 비어 있습니다.")

# 시가총액 상위 몇 개까지를 "후보 풀"로 볼지 (기본 300개)
TOP_N = int(os.environ.get("TOP_N", "300"))

# 종목 처리 사이 최소 지연 시간(초)
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "1.2"))

# 20일 z-score를 계산하기 위한 최소 표본 수. 이보다 적으면 통계가 불안정해
# None으로 둔다(상장 직후 종목, 데이터 누락 등으로 표본이 적을 수 있음).
MIN_ZSCORE_SAMPLE = 10


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


def _safe_float(value):
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if f != f else f  # NaN 체크


def compute_flow_metrics(df):
    """30일치 수급 df(날짜 오름차순, df.iloc[-1]이 최신)에서
    1일치(하위호환)/5일 누적/20일 z-score를 함께 계산한다."""
    foreign_series = df["외국인합계"].astype(float)
    inst_series = df["기관합계"].astype(float)

    foreign_net_1d = _safe_float(foreign_series.iloc[-1])
    inst_net_1d = _safe_float(inst_series.iloc[-1])

    foreign_net_5d = _safe_float(foreign_series.tail(5).sum())
    inst_net_5d = _safe_float(inst_series.tail(5).sum())

    window20 = foreign_series.tail(20).dropna()
    foreign_zscore_20d = None
    if len(window20) >= MIN_ZSCORE_SAMPLE and foreign_net_1d is not None:
        std = window20.std(ddof=0)
        if std and std > 0:
            foreign_zscore_20d = round((foreign_net_1d - window20.mean()) / std, 3)

    return {
        "foreign_net_buy": foreign_net_1d,
        "inst_net_buy": inst_net_1d,
        "foreign_net_5d": foreign_net_5d,
        "inst_net_5d": inst_net_5d,
        "foreign_zscore_20d": foreign_zscore_20d,
    }


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


def already_collected_today(date_str):
    """flow_signals에 오늘(KST) 날짜 행이 이미 있으면 True. (STEP 9 멱등성 가드)"""
    try:
        res = supabase.table("flow_signals").select("code").eq("date", date_str).limit(1).execute()
        return bool(res.data)
    except Exception as e:  # noqa: BLE001 - 가드 조회 실패 시 수집을 막지 않는다(fail-open)
        print(f"[멱등성] 오늘자 확인 조회 실패, 수집을 계속합니다: {e}")
        return False


def main():
    target_date = kst_now()
    date_str = kst_today_str()

    # 멱등성 가드: collect 워크플로를 실패 지점부터 재실행해도 이미 끝난 단계는
    # 건너뛴다. FORCE=1이면 무시하고 강제 재수집(flow_signals는 code,date upsert라
    # 재수집해도 중복은 안 생기고 값만 갱신된다).
    if os.environ.get("FORCE") != "1" and already_collected_today(date_str):
        print(f"[멱등성] flow_signals에 오늘({date_str}) 데이터가 이미 있어 스킵합니다 (강제 재수집: FORCE=1)")
        sys.exit(0)

    ranked_codes = get_market_cap_ranked_codes(target_date)
    if not ranked_codes:
        print("시가총액 순위를 가져오지 못해 종료합니다.")
        sys.exit(1)

    # SLEEP_SECONDS=1.2 x 300종목 ≈ 6분(실측 최대 23분)이라 요일별로 나눌
    # 필요가 없다 - 매일 전체 종목을 수집한다.
    print(f"오늘 실제 수급 데이터 수집 대상: {len(ranked_codes)}개 종목 "
          f"(기준일 {date_str}, KST 요일 {kst_weekday()})")

    rows = []
    skipped = 0
    for i, code in enumerate(ranked_codes, start=1):
        df = fetch_flow_for_code(code, target_date)
        if df is None:
            skipped += 1
            time.sleep(SLEEP_SECONDS)
            continue

        metrics = compute_flow_metrics(df)
        short_change = compute_short_balance_change(code, target_date)

        rows.append({
            "code": code,
            "date": date_str,
            **metrics,
            "short_balance_change_pct": short_change,
        })

        if i % 20 == 0:
            print(f"진행 상황: {i}/{len(ranked_codes)} (스킵 {skipped}건)")

        time.sleep(SLEEP_SECONDS)

    print(f"수집 완료: 성공 {len(rows)}건, 스킵 {skipped}건")

    if not rows:
        print("수집된 데이터가 없습니다. 종료합니다.")
        sys.exit(1)

    result = supabase.table("flow_signals").upsert(rows, on_conflict="code,date").execute()
    print(f"flow_signals에 {len(rows)}건 upsert 완료")


if __name__ == "__main__":
    main()
