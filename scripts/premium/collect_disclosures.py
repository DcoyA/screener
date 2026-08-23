import os
import time
import urllib.request
import urllib.parse
import json
from datetime import datetime, timedelta
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OPENDART_API_KEY = os.environ["OPENDART_API_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

HTTP_TIMEOUT = 30
HTTP_RETRIES = 3
HTTP_RETRY_SLEEP = 5

DISCLOSURE_TYPES = {
    "major_holder": "majorstock",       # 대량보유 상황보고
    "executive_ownership": "elestock",  # 임원ㆍ주요주주 소유보고
}


def call_opendart(endpoint, params):
    query = urllib.parse.urlencode({**params, "crtfc_key": OPENDART_API_KEY})
    url = f"https://opendart.fss.or.kr/api/{endpoint}.json?{query}"
    last_error = None
    for attempt in range(1, HTTP_RETRIES + 1):
        try:
            with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_error = e
            print(f"OpenDART 호출 {attempt}/{HTTP_RETRIES} 실패: {e}")
            if attempt < HTTP_RETRIES:
                time.sleep(HTTP_RETRY_SLEEP)
    raise RuntimeError(f"OpenDART 호출 최종 실패: {last_error}")


def fetch_recent_disclosures(disclosure_type, corp_code, start_date, end_date):
    endpoint = DISCLOSURE_TYPES[disclosure_type]
    params = {
        "corp_code": corp_code,
        "bgn_de": start_date,
        "end_de": end_date,
    }
    data = call_opendart(endpoint, params)
    if data.get("status") != "000":
        return []
    return data.get("list", [])


def get_target_corp_codes():
    """corp_code 매핑 테이블이 이미 있다면 재사용, 없으면 latest_stock_snapshots 기반으로 별도 매핑 필요."""
    resp = supabase.table("latest_stock_snapshots").select("code").execute()
    return sorted({row["code"] for row in resp.data if row.get("code")})


def main():
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    end_str = end_date.strftime("%Y%m%d")
    start_str = start_date.strftime("%Y%m%d")

    codes = get_target_corp_codes()
    print(f"총 {len(codes)}개 종목 공시 조회 시작 ({start_str} ~ {end_str})")

    rows = []
    for code in codes:
        for d_type in DISCLOSURE_TYPES:
            try:
                items = fetch_recent_disclosures(d_type, code, start_str, end_str)
            except RuntimeError as e:
                print(f"[{code}/{d_type}] 조회 실패, 스킵: {e}")
                continue
            for item in items:
                rows.append({
                    "code": code,
                    "disclosure_date": item.get("rcept_dt", "")[:4] + "-" + item.get("rcept_dt", "")[4:6] + "-" + item.get("rcept_dt", "")[6:8],
                    "type": d_type,
                    "summary": f"{item.get('repror', '')} 보고 - {item.get('report_tp', '')}",
                    "source_url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={item.get('rcept_no', '')}",
                })

    if not rows:
        print("신규 공시가 없습니다.")
        return

    supabase.table("disclosure_events").insert(rows).execute()
    print(f"disclosure_events에 {len(rows)}건 저장 완료")


if __name__ == "__main__":
    main()
