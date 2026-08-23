import os
import re
import time
import zipfile
import io
import urllib.request
import urllib.parse
import json
import xml.etree.ElementTree as ET
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
    "major_holder": "majorstock",
    "executive_ownership": "elestock",
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


def download_corp_code_map():
    query = urllib.parse.urlencode({"crtfc_key": OPENDART_API_KEY})
    url = f"https://opendart.fss.or.kr/api/corpCode.xml?{query}"

    print("OpenDART corpCode 매핑 파일 다운로드 중...")
    with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as resp:
        zip_bytes = resp.read()

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        xml_bytes = z.read("CORPCODE.xml")

    root = ET.fromstring(xml_bytes)
    mapping = {}
    for item in root.findall("list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        if stock_code:
            mapping[stock_code] = corp_code

    print(f"corp_code 매핑 {len(mapping)}건 완료 (상장사 기준)")
    return mapping


def fetch_recent_disclosures(disclosure_type, corp_code, start_date, end_date):
    endpoint = DISCLOSURE_TYPES[disclosure_type]
    params = {
        "corp_code": corp_code,
        "bgn_de": start_date,
        "end_de": end_date,
    }
    data = call_opendart(endpoint, params)
    status = data.get("status")
    if status != "000":
        if status != "013":
            print(f"OpenDART 응답 이상 (status={status}, message={data.get('message')})")
        return []
    return data.get("list", [])


def get_target_codes_with_corp_code():
    resp = supabase.table("latest_stock_snapshots").select("code").execute()
    ticker_codes = sorted({row["code"] for row in resp.data if row.get("code")})

    corp_map = download_corp_code_map()

    matched = []
    unmatched = 0
    for code in ticker_codes:
        corp_code = corp_map.get(code)
        if corp_code:
            matched.append((code, corp_code))
        else:
            unmatched += 1

    print(f"종목코드 {len(ticker_codes)}개 중 corp_code 매칭 {len(matched)}건, 미매칭 {unmatched}건")
    return matched


def normalize_rcept_dt(raw_value):
    digits = re.sub(r"\D", "", raw_value or "")
    if len(digits) != 8:
        return None
    return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"


def main():
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    end_str = end_date.strftime("%Y%m%d")
    start_str = start_date.strftime("%Y%m%d")

    targets = get_target_codes_with_corp_code()
    print(f"총 {len(targets)}개 종목 공시 조회 시작 ({start_str} ~ {end_str})")

    rows = []
    skipped_bad_date = 0
    for code, corp_code in targets:
        for d_type in DISCLOSURE_TYPES:
            try:
                items = fetch_recent_disclosures(d_type, corp_code, start_str, end_str)
            except RuntimeError as e:
                print(f"[{code}/{d_type}] 조회 실패, 스킵: {e}")
                continue
            for item in items:
                raw_dt = (item.get("rcept_dt") or "").strip()
                disclosure_date = normalize_rcept_dt(raw_dt)
                if not disclosure_date:
                    skipped_bad_date += 1
                    print(f"[{code}/{d_type}] rcept_dt 형식 이상('{raw_dt}'), 이 건 스킵")
                    continue

                rows.append({
                    "code": code,
                    "disclosure_date": disclosure_date,
                    "type": d_type,
                    "summary": f"{item.get('repror', '')} 보고 - {item.get('report_tp', '')}",
                    "source_url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={item.get('rcept_no', '')}",
                })
            time.sleep(0.3)

    print(f"날짜 형식 이상으로 스킵된 건수: {skipped_bad_date}")

    if not rows:
        print("신규 공시가 없습니다.")
        return

    supabase.table("disclosure_events").insert(rows).execute()
    print(f"disclosure_events에 {len(rows)}건 저장 완료")


if __name__ == "__main__":
    main()
