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

# KRX 2026 로그인 정책 대응: pykrx가 내부적으로 os.environ의
# KRX_ID / KRX_PW를 읽어 자동 로그인한다. 여기서는 값이 실제로
# 주입됐는지만 확인하고, 없으면 경고만 남긴다 (에러로 죽이지 않음).
if not os.environ.get("KRX_ID") or not os.environ.get("KRX_PW"):
    print("[WARN] KRX_ID / KRX_PW 환경변수가 비어 있습니다. "
          "GitHub Actions Secrets 및 workflow env 설정을 확인하세요.")

# 한 번에 처리할 최대 종목 수 (KRX 과다요청 차단 방지용).
# 워크플로우 env에서 CODE_LIMIT을 지정하면 그 값을 쓰고, 없으면 300으로 제한.
CODE_LIMIT = int(os.environ.get("CODE_LIMIT", "300"))

# 종목 처리 사이 최소 지연 시간(초). KRX 서버 차단 방지용.
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "1.2"))


def safe_call(func, *args, max_retries=3, **kwargs):
    """pykrx 호출을 감싸서 JSON 파싱 실패/일시 오류 시 재시도한다.
    끝까지 실패하면 None을 반환하고, 호출한 쪽에서 해당 종목을 스킵하도록 한다."""
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


def get_target_codes():
    """우량주스카우터가 이미 관리하는 종목 코드 목록을 재사용한다.
    KRX 차단 방지를 위해 CODE_LIMIT 개수만큼만 잘라서 반환한다."""
    resp = supabase.table("latest_stock_snapshots").select("code").execute()
    codes = sorted({row["code"] for row in resp.data if row.get("code")})
    if not codes:
        print("경고: latest_stock_snapshots에서 코드를 가져오지 못했습니다.")
        return codes

    if len(codes) > CODE_LIMIT:
        print(f"전체 {len(codes)}개 중 {CODE_LIMIT}개로 제한하여 수집합니다.")
        codes = codes[:CODE_LIMIT]

    return codes


def fetch_flow_for_code(code, target_date):
    """특정 종목의 최근 20거래일 투자자별 순매수 데이터를 가져온다."""
    start = (target_date - timedelta(days=30)).strftime("%Y%m%d")
    end = target_date.strftime("%Y%m%d")
    df = safe_call(stock.get_market_trading_value_by_date, start, end, code)
    if df is None or df.empty:
        return None
    return df


def compute_short_balance_change(code, target_date):
    """대차잔고 변화율(최근 대비 5거래일 전)을 계산한다."""
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
    codes = get_target_codes()
    print(f"총 {len(codes)}개 종목 수급 데이터 수집 시작 (기준일 {date_str})")

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

        # 종목 하나 처리 후 KRX 서버 부담을 줄이기 위한 최소 지연
        time.sleep(SLEEP_SECONDS)

    print(f"수집 완료: 성공 {len(rows)}건, 스킵 {skipped}건")

    if not rows:
        print("수집된 데이터가 없습니다. 종료합니다.")
        sys.exit(1)

    result = supabase.table("flow_signals").upsert(rows, on_conflict="code,date").execute()
    print(f"flow_signals에 {len(rows)}건 upsert 완료")


if __name__ == "__main__":
    main()
