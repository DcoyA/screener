import io
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "app" / "data"

stocks_path = DATA_DIR / "stocks.json"
risks_path = DATA_DIR / "risks.json"
reports_path = DATA_DIR / "reports.json"

OPENDART_API_KEY = os.getenv("OPENDART_API_KEY", "").strip()
KRX_API_KEY = os.getenv("KRX_API_KEY", "").strip()

DEFAULT_KRX_KOSPI_BASIC_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info"
DEFAULT_KRX_KOSDAQ_BASIC_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info"
DEFAULT_KRX_KOSPI_DAILY_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd"
DEFAULT_KRX_KOSDAQ_DAILY_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd"

def normalize_krx_url(url, fallback):
    candidate = (url or fallback or "").strip()
    if not candidate:
        return fallback
    candidate = candidate.replace("/svc/sample/apis/", "/svc/apis/")
    return candidate

KRX_KOSPI_BASIC_URL = normalize_krx_url(os.getenv("KRX_KOSPI_BASIC_URL", ""), DEFAULT_KRX_KOSPI_BASIC_URL)
KRX_KOSDAQ_BASIC_URL = normalize_krx_url(os.getenv("KRX_KOSDAQ_BASIC_URL", ""), DEFAULT_KRX_KOSDAQ_BASIC_URL)
KRX_KOSPI_DAILY_URL = normalize_krx_url(os.getenv("KRX_KOSPI_DAILY_URL", ""), DEFAULT_KRX_KOSPI_DAILY_URL)
KRX_KOSDAQ_DAILY_URL = normalize_krx_url(os.getenv("KRX_KOSDAQ_DAILY_URL", ""), DEFAULT_KRX_KOSDAQ_DAILY_URL)

MAX_STOCKS = 50
REPORT_CODE = "11011"

kst_now = datetime.utcnow() + timedelta(hours=9)
today = kst_now.strftime("%Y-%m-%d")
target_year = str(kst_now.year - 1)

if not OPENDART_API_KEY:
    raise RuntimeError("OPENDART_API_KEY is missing")

if not KRX_API_KEY:
    raise RuntimeError("KRX_API_KEY is missing")

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def http_get_json(base_url, params):
    query = urllib.parse.urlencode(params)
    url = f"{base_url}?{query}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))

def request_json_url(url, headers=None, params=None):
    headers = headers or {}
    if params:
        query = urllib.parse.urlencode(params)
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{query}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(body) if body else {}
        except Exception:
            payload = {"raw": body}
        payload["http_status"] = e.code
        raise RuntimeError(f"KRX request failed for {url}: {json.dumps(payload, ensure_ascii=False)}")

    try:
        return json.loads(body)
    except Exception:
        raise RuntimeError(f"Invalid JSON response from {url}: {body[:300]}")

def parse_amount(value):
    if value is None:
        return 0
    text = str(value).strip().replace(",", "")
    if text == "":
        return 0
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    try:
        return int(float(text))
    except:
        return 0

def normalize_code(value):
    if value is None:
        return ""
    digits = re.sub(r"[^0-9]", "", str(value))
    if len(digits) >= 6:
        return digits[-6:]
    return digits.zfill(6) if digits else ""

def fmt_krw(value):
    n = abs(int(value))
    sign = "-" if value < 0 else ""

    if n >= 1_0000_0000_0000:
        return f"{sign}{n / 1_0000_0000_0000:.1f}조원"
    elif n >= 1_0000_0000:
        return f"{sign}{n / 1_0000_0000:.0f}억원"
    else:
        return f"{sign}{n:,}원"

def pct(a, b):
    if not b:
        return 0.0
    return ((a - b) / abs(b)) * 100

def pick_field(row, exact_keys=None, contains_keys=None):
    exact_keys = exact_keys or []
    contains_keys = contains_keys or []

    lowered = {str(k).lower(): k for k in row.keys()}

    for key in exact_keys:
        if key.lower() in lowered:
            return row[lowered[key.lower()]]

    for k, v in row.items():
        lk = str(k).lower()
        for ck in contains_keys:
            if ck.lower() in lk:
                return v

    return None

def download_corp_code_xml():
    query = urllib.parse.urlencode({"crtfc_key": OPENDART_API_KEY})
    url = f"https://opendart.fss.or.kr/api/corpCode.xml?{query}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read()

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        xml_name = zf.namelist()[0]
        xml_bytes = zf.read(xml_name)

    return ET.fromstring(xml_bytes)

def build_corp_code_map():
    root = download_corp_code_xml()
    mapping = {}

    for item in root.findall("list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        corp_name = (item.findtext("corp_name") or "").strip()

        if stock_code:
            mapping[stock_code] = {
                "corp_code": corp_code,
                "corp_name": corp_name
            }

    return mapping

def krx_headers():
    return {
        "AUTH_KEY": KRX_API_KEY,
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json"
    }

def fetch_krx_rows(url):
    if not url:
        return []

    attempts = [
        {"headers": krx_headers(), "params": None, "label": "header-auth"},
        {"headers": {"Accept": "application/json"}, "params": {"AUTH_KEY": KRX_API_KEY}, "label": "query-auth"},
        {"headers": krx_headers(), "params": {"AUTH_KEY": KRX_API_KEY}, "label": "header+query-auth"},
    ]

    errors = []
    for attempt in attempts:
        try:
            data = request_json_url(url, headers=attempt["headers"], params=attempt["params"])
        except RuntimeError as e:
            errors.append(f"{attempt['label']}: {e}")
            continue

        if isinstance(data, dict):
            resp_code = str(data.get("respCode", "")).strip()
            resp_msg = str(data.get("respMsg", "")).strip()
            if resp_code and resp_code != "000":
                errors.append(f"{attempt['label']}: respCode={resp_code}, respMsg={resp_msg}")
                continue

            rows = data.get("OutBlock_1", [])
            if isinstance(rows, list) and rows:
                return rows
            if isinstance(rows, list):
                errors.append(f"{attempt['label']}: OutBlock_1 empty")
                continue

        errors.append(f"{attempt['label']}: unexpected payload shape")

    raise RuntimeError("KRX rows fetch failed for %s | %s" % (url, " ; ".join(errors)))

def normalize_basic_rows(rows, market_name):
    result = []
    for row in rows:
        code = normalize_code(
            pick_field(
                row,
                exact_keys=["ISU_SRT_CD", "ISU_CD", "isuSrtCd", "isuCd", "SRTN_CD"],
                contains_keys=["srt_cd", "isu_cd", "stock_code", "short_code"]
            )
        )

        name = pick_field(
            row,
            exact_keys=["ISU_NM", "isuNm", "ISU_ABBRV", "isuAbbrv", "KOR_NM"],
            contains_keys=["isu_nm", "name", "nm", "abbrv"]
        )

        market_cap = parse_amount(
            pick_field(
                row,
                exact_keys=["MKTCAP", "MKT_CAP", "TDD_MRKT_CAP", "TDD_MRKT_CAP_AMT"],
                contains_keys=["mkt_cap", "market_cap", "mktcap"]
            )
        )

        if not code or not name:
            continue

        nm = str(name).strip()

        if "ETF" in nm or "ETN" in nm or "스팩" in nm:
            continue

        result.append({
            "code": code,
            "name": nm,
            "market": market_name,
            "marketCap": market_cap
        })

    return result

def normalize_daily_rows(rows):
    result = {}
    for row in rows:
        code = normalize_code(
            pick_field(
                row,
                exact_keys=["ISU_SRT_CD", "ISU_CD", "isuSrtCd", "isuCd", "SRTN_CD"],
                contains_keys=["srt_cd", "isu_cd", "stock_code", "short_code"]
            )
        )

        trade_value = parse_amount(
            pick_field(
                row,
                exact_keys=["ACC_TRDVAL", "TDD_TRDVAL", "TRDVAL", "accTrdVal"],
                contains_keys=["trdval", "trade_value", "acc_trd"]
            )
        )

        close_price = parse_amount(
            pick_field(
                row,
                exact_keys=["TDD_CLSPRC", "CLSPRC", "closePrice"],
                contains_keys=["clsprc", "close"]
            )
        )

        if not code:
            continue

        result[code] = {
            "tradeValue": trade_value,
            "closePrice": close_price
        }

    return result

def build_krx_universe():
    kospi_basic = normalize_basic_rows(fetch_krx_rows(KRX_KOSPI_BASIC_URL), "KOSPI")
    kosdaq_basic = normalize_basic_rows(fetch_krx_rows(KRX_KOSDAQ_BASIC_URL), "KOSDAQ")

    basic_rows = kospi_basic + kosdaq_basic
    if not basic_rows:
        raise RuntimeError(
            "KRX basic info returned 0 rows. "
            f"KOSPI_BASIC_URL={KRX_KOSPI_BASIC_URL}, KOSDAQ_BASIC_URL={KRX_KOSDAQ_BASIC_URL}"
        )

    kospi_daily = normalize_daily_rows(fetch_krx_rows(KRX_KOSPI_DAILY_URL))
    kosdaq_daily = normalize_daily_rows(fetch_krx_rows(KRX_KOSDAQ_DAILY_URL))

    daily_map = {}
    daily_map.update(kospi_daily)
    daily_map.update(kosdaq_daily)

    merged = {}
    for row in basic_rows:
        code = row["code"]
        item = dict(row)
        item.update(daily_map.get(code, {"tradeValue": 0, "closePrice": 0}))
        merged[code] = item

    result = list(merged.values())
    result.sort(key=lambda x: (x.get("tradeValue", 0), x.get("marketCap", 0)), reverse=True)
    return result

def fetch_major_accounts(corp_code, year):
    data = http_get_json(
        "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json",
        {
            "crtfc_key": OPENDART_API_KEY,
            "corp_code": corp_code,
            "bsns_year": year,
            "reprt_code": REPORT_CODE
        }
    )

    if data.get("status") == "000":
        return data.get("list", []), year

    fallback_year = str(int(year) - 1)
    data2 = http_get_json(
        "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json",
        {
            "crtfc_key": OPENDART_API_KEY,
            "corp_code": corp_code,
            "bsns_year": fallback_year,
            "reprt_code": REPORT_CODE
        }
    )

    if data2.get("status") == "000":
        return data2.get("list", []), fallback_year

    return [], fallback_year

def pick_account(rows, names):
    for target in names:
        for row in rows:
            name = str(row.get("account_nm", "")).strip()
            if name == target:
                return row

    for target in names:
        for row in rows:
            name = str(row.get("account_nm", "")).strip()
            if target in name:
                return row

    return {}

def build_stock_item(item, corp_map):
    stock_code = item["code"]
    corp_info = corp_map.get(stock_code)
    if not corp_info:
        return None

    rows, used_year = fetch_major_accounts(corp_info["corp_code"], target_year)
    if not rows:
        return None

    revenue_row = pick_account(rows, ["매출액", "수익(매출액)", "영업수익"])
    op_row = pick_account(rows, ["영업이익", "영업이익(손실)"])
    net_row = pick_account(rows, ["당기순이익", "당기순이익(손실)"])
    assets_row = pick_account(rows, ["자산총계"])
    liabilities_row = pick_account(rows, ["부채총계"])
    equity_row = pick_account(rows, ["자본총계"])

    revenue = parse_amount(revenue_row.get("thstrm_amount"))
    revenue_prev = parse_amount(revenue_row.get("frmtrm_amount"))

    op_income = parse_amount(op_row.get("thstrm_amount"))
    op_income_prev = parse_amount(op_row.get("frmtrm_amount"))

    net_income = parse_amount(net_row.get("thstrm_amount"))
    net_income_prev = parse_amount(net_row.get("frmtrm_amount"))

    assets = parse_amount(assets_row.get("thstrm_amount"))
    liabilities = parse_amount(liabilities_row.get("thstrm_amount"))
    equity = parse_amount(equity_row.get("thstrm_amount"))

    if revenue <= 0 or equity <= 0:
        return None

    op_margin = (op_income / revenue * 100) if revenue else 0.0
    debt_ratio = (liabilities / equity * 100) if equity else 999.0
    revenue_growth = pct(revenue, revenue_prev) if revenue_prev else 0.0
    op_growth = pct(op_income, op_income_prev) if op_income_prev else 0.0
    net_growth = pct(net_income, net_income_prev) if net_income_prev else 0.0

    trade_value = int(item.get("tradeValue", 0))
    market_cap = int(item.get("marketCap", 0))
    close_price = int(item.get("closePrice", 0))

    value_score = 0
    value_score += 10 if equity > 0 else 0
    value_score += 10 if op_income > 0 else 0
    value_score += 8 if net_income > 0 else 0
    value_score += 12 if op_margin >= 10 else 8 if op_margin >= 5 else 4
    value_score = min(value_score, 40)

    quality_score = 0
    quality_score += 5 if revenue > 0 else 0
    quality_score += 8 if op_income > 0 else 0
    quality_score += 5 if net_income > 0 else 0
    quality_score += 7 if op_margin >= 15 else 5 if op_margin >= 10 else 3 if op_margin >= 5 else 1
    quality_score = min(quality_score, 25)

    safety_score = 0
    safety_score += 5 if equity > 0 else 0
    if debt_ratio < 50:
        safety_score += 12
    elif debt_ratio < 100:
        safety_score += 10
    elif debt_ratio < 150:
        safety_score += 7
    elif debt_ratio < 200:
        safety_score += 4
    else:
        safety_score += 1

    if trade_value >= 100_0000_0000:
        safety_score += 3
    elif trade_value >= 10_0000_0000:
        safety_score += 2
    elif trade_value >= 1_0000_0000:
        safety_score += 1

    safety_score = min(safety_score, 20)

    change_score = 0
    change_score += 5 if revenue_growth >= 10 else 3 if revenue_growth > 0 else 0
    change_score += 6 if op_growth >= 10 else 4 if op_growth > 0 else 0
    if net_income > 0 and net_income_prev <= 0:
        change_score += 4
    elif net_growth > 0:
        change_score += 4
    change_score = min(change_score, 15)

    total_score = value_score + quality_score + safety_score + change_score

    if debt_ratio >= 200:
        risk_text = f"부채비율이 {debt_ratio:.1f}%로 높은 편이라 재무 안정성 점검이 필요합니다."
        risk_level = "주의"
        risk_title = "재무 안정성 점검 필요"
        check_point = "부채비율과 차입 부담 관련 최신 공시 확인"
    elif op_income <= 0:
        risk_text = "영업이익이 적자이거나 낮아 수익성 회복 여부를 확인해야 합니다."
        risk_level = "주의"
        risk_title = "수익성 회복 여부 확인 필요"
        check_point = "다음 분기 실적 및 영업이익 개선 여부 확인"
    elif trade_value < 1_0000_0000:
        risk_text = "거래대금이 상대적으로 낮아 유동성 측면 점검이 필요합니다."
        risk_level = "보통"
        risk_title = "유동성 점검 필요"
        check_point = "최근 거래대금 및 시장 관심도 확인"
    else:
        risk_text = "재무 구조와 유동성은 비교적 안정적이지만 업황 변수는 함께 확인해야 합니다."
        risk_level = "낮음"
        risk_title = "전반적 안정 구간"
        check_point = "업황 및 다음 분기 실적 흐름 확인"

    summary = (
        f"{used_year} 사업보고서 기준 매출 {fmt_krw(revenue)}, "
        f"영업이익 {fmt_krw(op_income)}, 부채비율 {debt_ratio:.1f}%입니다."
    )

    description = (
        f"{used_year} 사업보고서 기준 재무와 KRX 시장 데이터를 함께 반영했습니다. "
        f"매출은 전년 대비 {revenue_growth:.1f}%, 영업이익은 전년 대비 {op_growth:.1f}% 변동했고, "
        f"최근 일별매매정보 기준 거래대금은 {fmt_krw(trade_value)} 수준입니다."
    )

    return {
        "code": stock_code,
        "name": item["name"],
        "market": item["market"],
        "totalScore": total_score,
        "valueScore": value_score,
        "qualityScore": quality_score,
        "safetyScore": safety_score,
        "changeScore": change_score,
        "risk": risk_text,
        "summary": summary,
        "description": description,
        "updatedAt": today,
        "basisYear": used_year,
        "corpCode": corp_info["corp_code"],
        "metrics": {
            "revenue": revenue,
            "operatingIncome": op_income,
            "netIncome": net_income,
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "debtRatio": round(debt_ratio, 1),
            "operatingMargin": round(op_margin, 1),
            "revenueGrowth": round(revenue_growth, 1),
            "operatingIncomeGrowth": round(op_growth, 1),
            "netIncomeGrowth": round(net_growth, 1),
            "marketCap": market_cap,
            "tradeValue": trade_value,
            "closePrice": close_price
        },
        "riskMeta": {
            "level": risk_level,
            "title": risk_title,
            "checkPoint": check_point
        }
    }

def get_week_label(dt):
    week_no = ((dt.day - 1) // 7) + 1
    return f"{dt.year}년 {dt.month}월 {week_no}주차"

def main():
    corp_map = build_corp_code_map()
    krx_universe = build_krx_universe()

    # 거래대금/시총 기준 상위 후보 중 DART 매핑 가능한 종목만 우선 수집
    candidates = [x for x in krx_universe if x["code"] in corp_map]
    candidates.sort(key=lambda x: (x.get("tradeValue", 0), x.get("marketCap", 0)), reverse=True)

    stocks = []
    for item in candidates[: max(MAX_STOCKS * 3, 150)]:
        stock = build_stock_item(item, corp_map)
        if stock:
            stocks.append(stock)
        if len(stocks) >= MAX_STOCKS:
            break

    if not stocks:
        raise RuntimeError("No stocks generated. Check KRX approvals and DART mappings.")

    stocks.sort(
        key=lambda x: (
            x["totalScore"],
            x["metrics"].get("tradeValue", 0),
            x["metrics"].get("marketCap", 0)
        ),
        reverse=True
    )

    risks = []
    for stock in stocks:
        risks.append({
            "date": today,
            "code": stock["code"],
            "name": stock["name"],
            "level": stock["riskMeta"]["level"],
            "title": stock["riskMeta"]["title"],
            "summary": stock["risk"],
            "checkPoint": stock["riskMeta"]["checkPoint"]
        })

    top_picks = stocks[:10]
    reports = [
        {
            "week": get_week_label(kst_now),
            "publishedAt": today,
            "title": "이번 주 공시 + 시장데이터 기반 우량주 후보 리포트",
            "summary": "OpenDART 사업보고서와 KRX 상장종목/일별매매정보를 바탕으로 자동 생성한 주간 리포트입니다.",
            "topPickCodes": [item["code"] for item in top_picks],
            "highlights": [item["summary"] for item in top_picks[:5]],
            "marketNote": "이번 단계부터는 KRX 상장 종목 정보와 거래대금을 함께 반영해 다수 종목 후보군을 자동 수집합니다.",
            "disclaimer": "본 자료는 투자 권유가 아니라 공개 데이터 기반 정리 자료입니다."
        }
    ]

    save_json(stocks_path, stocks)
    save_json(risks_path, risks)
    save_json(reports_path, reports)

    print("KRX + DART bulk update completed")
    print(f"today={today}")
    print(f"target_year={target_year}")
    print(f"krx_universe={len(krx_universe)}")
    print(f"generated_stocks={len(stocks)}")

if __name__ == "__main__":
    main()
