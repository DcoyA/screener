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

MAX_STOCKS = 500
REPORT_CODE = "11011"
DAILY_WINDOW = 5
RECENT_DAYS_BACK = 20
MIN_MARKET_CAP = 100_0000_0000  # 1,000억원
MIN_AVG_TRADE_VALUE = 10_0000_0000  # 10억원

kst_now = datetime.utcnow() + timedelta(hours=9)
today = kst_now.strftime("%Y-%m-%d")
target_year = str(kst_now.year - 1)


def normalize_krx_url(url, fallback):
    candidate = (url or fallback or "").strip()
    if not candidate:
        return fallback
    return candidate.replace("/svc/sample/apis/", "/svc/apis/")


KRX_KOSPI_BASIC_URL = normalize_krx_url(os.getenv("KRX_KOSPI_BASIC_URL", ""), DEFAULT_KRX_KOSPI_BASIC_URL)
KRX_KOSDAQ_BASIC_URL = normalize_krx_url(os.getenv("KRX_KOSDAQ_BASIC_URL", ""), DEFAULT_KRX_KOSDAQ_BASIC_URL)
KRX_KOSPI_DAILY_URL = normalize_krx_url(os.getenv("KRX_KOSPI_DAILY_URL", ""), DEFAULT_KRX_KOSPI_DAILY_URL)
KRX_KOSDAQ_DAILY_URL = normalize_krx_url(os.getenv("KRX_KOSDAQ_DAILY_URL", ""), DEFAULT_KRX_KOSDAQ_DAILY_URL)

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
    except Exception:
        return 0


def normalize_code(value):
    if value is None:
        return ""
    digits = re.sub(r"[^0-9]", "", str(value))
    if len(digits) >= 6:
        return digits[-6:]
    return digits.zfill(6) if digits else ""


def fmt_krw(value):
    n = abs(int(value or 0))
    sign = "-" if (value or 0) < 0 else ""

    if n >= 1_0000_0000_0000:
        return f"{sign}{n / 1_0000_0000_0000:.1f}조원"
    if n >= 1_0000_0000:
        return f"{sign}{n / 1_0000_0000:.0f}억원"
    return f"{sign}{n:,}원"


def fmt_ratio(value, digits=1):
    if value is None:
        return "-"
    return f"{value:.{digits}f}"


def pct(a, b):
    if not b:
        return 0.0
    return ((a - b) / abs(b)) * 100


def safe_div(numerator, denominator):
    if not denominator:
        return None
    return numerator / denominator


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
                "corp_name": corp_name,
            }

    return mapping


def krx_headers():
    return {
        "AUTH_KEY": KRX_API_KEY,
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json",
    }


def recent_krx_bas_dd_candidates(days_back=RECENT_DAYS_BACK):
    base_date = (kst_now - timedelta(days=1)).date()
    return [
        (base_date - timedelta(days=offset)).strftime("%Y%m%d")
        for offset in range(days_back)
    ]


def fetch_krx_rows(url, bas_dd):
    if not url:
        return [], [f"missing url for basDd={bas_dd}"]

    attempts = [
        {"headers": krx_headers(), "params": {"basDd": bas_dd}, "label": "header-auth"},
        {"headers": {"Accept": "application/json"}, "params": {"AUTH_KEY": KRX_API_KEY, "basDd": bas_dd}, "label": "query-auth"},
        {"headers": krx_headers(), "params": {"AUTH_KEY": KRX_API_KEY, "basDd": bas_dd}, "label": "header+query-auth"},
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
                return rows, errors
            if isinstance(rows, list):
                errors.append(f"{attempt['label']}: OutBlock_1 empty for basDd={bas_dd}")
                continue

        errors.append(f"{attempt['label']}: unexpected payload shape for basDd={bas_dd}")

    return [], errors


def normalize_basic_rows(rows, market_name):
    result = []
    for row in rows:
        code = normalize_code(
            pick_field(
                row,
                exact_keys=["ISU_SRT_CD", "ISU_CD", "isuSrtCd", "isuCd", "SRTN_CD"],
                contains_keys=["srt_cd", "isu_cd", "stock_code", "short_code"],
            )
        )

        name = pick_field(
            row,
            exact_keys=["ISU_NM", "isuNm", "ISU_ABBRV", "isuAbbrv", "KOR_NM"],
            contains_keys=["isu_nm", "name", "nm", "abbrv"],
        )

        list_shares = parse_amount(
            pick_field(
                row,
                exact_keys=["LIST_SHRS"],
                contains_keys=["list_shrs", "shares"],
            )
        )

        if not code or not name:
            continue

        nm = str(name).strip()
        if "ETF" in nm or "ETN" in nm or "스팩" in nm:
            continue

        result.append(
            {
                "code": code,
                "name": nm,
                "market": market_name,
                "listShares": list_shares,
            }
        )

    return result


def normalize_daily_rows(rows):
    result = {}
    for row in rows:
        code = normalize_code(
            pick_field(
                row,
                exact_keys=["ISU_SRT_CD", "ISU_CD", "isuSrtCd", "isuCd", "SRTN_CD"],
                contains_keys=["srt_cd", "isu_cd", "stock_code", "short_code"],
            )
        )

        trade_value = parse_amount(
            pick_field(
                row,
                exact_keys=["ACC_TRDVAL", "TDD_TRDVAL", "TRDVAL", "accTrdVal"],
                contains_keys=["trdval", "trade_value", "acc_trd"],
            )
        )

        close_price = parse_amount(
            pick_field(
                row,
                exact_keys=["TDD_CLSPRC", "CLSPRC", "closePrice"],
                contains_keys=["clsprc", "close"],
            )
        )

        market_cap = parse_amount(
            pick_field(
                row,
                exact_keys=["MKTCAP", "MKT_CAP", "TDD_MRKT_CAP", "TDD_MRKT_CAP_AMT"],
                contains_keys=["mktcap", "market_cap", "mkt_cap"],
            )
        )

        list_shares = parse_amount(
            pick_field(
                row,
                exact_keys=["LIST_SHRS"],
                contains_keys=["list_shrs", "shares"],
            )
        )

        if not code:
            continue

        result[code] = {
            "tradeValue": trade_value,
            "closePrice": close_price,
            "marketCap": market_cap,
            "listShares": list_shares,
        }

    return result


def build_krx_universe():
    diagnostics = []
    candidates = recent_krx_bas_dd_candidates()

    basic_rows = []
    basic_bas_dd = None
    for bas_dd in candidates:
        kospi_basic_rows, kospi_basic_errors = fetch_krx_rows(KRX_KOSPI_BASIC_URL, bas_dd)
        kosdaq_basic_rows, kosdaq_basic_errors = fetch_krx_rows(KRX_KOSDAQ_BASIC_URL, bas_dd)

        kospi_basic = normalize_basic_rows(kospi_basic_rows, "KOSPI")
        kosdaq_basic = normalize_basic_rows(kosdaq_basic_rows, "KOSDAQ")
        merged_basic = kospi_basic + kosdaq_basic
        if merged_basic:
            basic_rows = merged_basic
            basic_bas_dd = bas_dd
            break

        diagnostics.append(
            f"{bas_dd} | KOSPI basic: {' ; '.join(kospi_basic_errors)} | KOSDAQ basic: {' ; '.join(kosdaq_basic_errors)}"
        )

    if not basic_rows:
        raise RuntimeError(
            "KRX basic info returned 0 rows across recent basDd candidates. "
            f"KOSPI_BASIC_URL={KRX_KOSPI_BASIC_URL}, KOSDAQ_BASIC_URL={KRX_KOSDAQ_BASIC_URL} | "
            + " || ".join(diagnostics[:8])
        )

    daily_snapshots = []
    daily_diagnostics = []
    for bas_dd in candidates:
        kospi_daily_rows, kospi_daily_errors = fetch_krx_rows(KRX_KOSPI_DAILY_URL, bas_dd)
        kosdaq_daily_rows, kosdaq_daily_errors = fetch_krx_rows(KRX_KOSDAQ_DAILY_URL, bas_dd)

        kospi_daily = normalize_daily_rows(kospi_daily_rows)
        kosdaq_daily = normalize_daily_rows(kosdaq_daily_rows)

        merged_daily = {}
        merged_daily.update(kospi_daily)
        merged_daily.update(kosdaq_daily)

        if merged_daily:
            daily_snapshots.append({"basDd": bas_dd, "rows": merged_daily})
            if len(daily_snapshots) >= DAILY_WINDOW:
                break
        else:
            daily_diagnostics.append(
                f"{bas_dd} | KOSPI daily: {' ; '.join(kospi_daily_errors)} | KOSDAQ daily: {' ; '.join(kosdaq_daily_errors)}"
            )

    latest_daily = daily_snapshots[0]["rows"] if daily_snapshots else {}
    used_daily_dates = [snap["basDd"] for snap in daily_snapshots]

    merged = {}
    for row in basic_rows:
        code = row["code"]
        item = dict(row)

        trade_values = []
        latest_metrics = latest_daily.get(code, {})
        for snap in daily_snapshots:
            row_daily = snap["rows"].get(code)
            if row_daily:
                trade_values.append(int(row_daily.get("tradeValue", 0)))
                if not latest_metrics:
                    latest_metrics = row_daily

        avg_trade_value_5d = int(sum(trade_values) / len(trade_values)) if trade_values else 0
        item.update(
            {
                "tradeValue": int(latest_metrics.get("tradeValue", 0)),
                "closePrice": int(latest_metrics.get("closePrice", 0)),
                "marketCap": int(latest_metrics.get("marketCap", 0)),
                "listShares": int(latest_metrics.get("listShares", 0) or item.get("listShares", 0)),
                "avgTradeValue5d": avg_trade_value_5d,
                "basicBasDd": basic_bas_dd,
                "dailyBasDd": used_daily_dates[0] if used_daily_dates else basic_bas_dd,
                "dailyWindowDates": used_daily_dates,
            }
        )
        merged[code] = item

    result = list(merged.values())
    result.sort(key=lambda x: (x.get("avgTradeValue5d", 0), x.get("marketCap", 0)), reverse=True)
    print(f"Using KRX basic basDd={basic_bas_dd}")
    print(f"Using KRX daily basDd window={','.join(used_daily_dates)}")
    if daily_diagnostics:
        print("KRX daily empty-date notes: " + " || ".join(daily_diagnostics[:5]))
    return result


def fetch_major_accounts(corp_code, year):
    data = http_get_json(
        "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json",
        {
            "crtfc_key": OPENDART_API_KEY,
            "corp_code": corp_code,
            "bsns_year": year,
            "reprt_code": REPORT_CODE,
        },
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
            "reprt_code": REPORT_CODE,
        },
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


def score_per(per):
    if per is None or per <= 0:
        return 0
    if per <= 5:
        return 12
    if per <= 8:
        return 10
    if per <= 12:
        return 8
    if per <= 18:
        return 5
    if per <= 25:
        return 2
    return 0


def score_pbr(pbr):
    if pbr is None or pbr <= 0:
        return 0
    if pbr <= 0.5:
        return 12
    if pbr <= 0.8:
        return 10
    if pbr <= 1.2:
        return 8
    if pbr <= 1.8:
        return 5
    if pbr <= 3:
        return 2
    return 0


def score_discount_bonus(per, pbr):
    if per is None or pbr is None or per <= 0 or pbr <= 0:
        return 0
    if per <= 10 and pbr <= 1.0:
        return 6
    if per <= 12 and pbr <= 1.2:
        return 4
    if per <= 15 and pbr <= 1.5:
        return 2
    return 0


def score_operating_margin(op_margin):
    if op_margin > 20:
        return 10
    if op_margin > 15:
        return 8
    if op_margin > 10:
        return 6
    if op_margin > 5:
        return 4
    if op_margin > 0:
        return 2
    return 0


def score_roe(roe):
    if roe > 20:
        return 10
    if roe > 15:
        return 8
    if roe > 10:
        return 6
    if roe > 5:
        return 4
    if roe > 0:
        return 2
    return 0


def score_profit_stability(operating_income, net_income):
    if operating_income > 0 and net_income > 0:
        return 5
    if operating_income > 0 or net_income > 0:
        return 2
    return 0


def score_debt_ratio(debt_ratio):
    if debt_ratio < 30:
        return 10
    if debt_ratio < 60:
        return 8
    if debt_ratio < 100:
        return 6
    if debt_ratio < 150:
        return 4
    if debt_ratio < 200:
        return 2
    return 0


def score_earnings_safety(operating_income, net_income):
    if operating_income > 0 and net_income > 0:
        return 10
    if operating_income > 0 and net_income <= 0:
        return 6
    if operating_income <= 0 and net_income > 0:
        return 4
    return 0


def score_market_cap(market_cap):
    if market_cap < 100_0000_0000:
        return 0
    if market_cap < 300_0000_0000:
        return 2
    if market_cap < 1_0000_0000_0000:
        return 4
    if market_cap < 10_0000_0000_0000:
        return 7
    if market_cap < 50_0000_0000_0000:
        return 6
    return 5


def score_liquidity(avg_trade_value_5d):
    if avg_trade_value_5d < 10_0000_0000:
        return 0
    if avg_trade_value_5d < 30_0000_0000:
        return 2
    if avg_trade_value_5d < 100_0000_0000:
        return 4
    if avg_trade_value_5d < 300_0000_0000:
        return 6
    return 8


def score_revenue_growth(growth):
    if growth > 20:
        return 4
    if growth > 10:
        return 3
    if growth > 0:
        return 2
    if growth > -10:
        return 1
    return 0


def score_operating_income_growth(growth):
    if growth > 30:
        return 4
    if growth > 15:
        return 3
    if growth > 0:
        return 2
    if growth > -10:
        return 1
    return 0


def score_net_income_growth(growth):
    if growth > 30:
        return 2
    if growth > 0:
        return 1
    return 0


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
    operating_income = parse_amount(op_row.get("thstrm_amount"))
    operating_income_prev = parse_amount(op_row.get("frmtrm_amount"))
    net_income = parse_amount(net_row.get("thstrm_amount"))
    net_income_prev = parse_amount(net_row.get("frmtrm_amount"))
    assets = parse_amount(assets_row.get("thstrm_amount"))
    liabilities = parse_amount(liabilities_row.get("thstrm_amount"))
    equity = parse_amount(equity_row.get("thstrm_amount"))

    if revenue <= 0 or equity <= 0:
        return None

    trade_value = int(item.get("tradeValue", 0))
    avg_trade_value_5d = int(item.get("avgTradeValue5d", 0))
    market_cap = int(item.get("marketCap", 0))
    close_price = int(item.get("closePrice", 0))
    list_shares = int(item.get("listShares", 0))

    operating_margin = (operating_income / revenue * 100) if revenue else 0.0
    debt_ratio = (liabilities / equity * 100) if equity else 9999.0
    revenue_growth = pct(revenue, revenue_prev) if revenue_prev else 0.0
    operating_income_growth = pct(operating_income, operating_income_prev) if operating_income_prev else 0.0
    net_income_growth = pct(net_income, net_income_prev) if net_income_prev else 0.0
    roe = (net_income / equity * 100) if equity > 0 else 0.0

    per = None
    if market_cap > 0 and net_income > 0:
        per = market_cap / net_income

    pbr = None
    if market_cap > 0 and equity > 0:
        pbr = market_cap / equity

    per_score = score_per(per)
    pbr_score = score_pbr(pbr)
    discount_bonus = score_discount_bonus(per, pbr)
    value_score = per_score + pbr_score + discount_bonus

    operating_margin_score = score_operating_margin(operating_margin)
    roe_score = score_roe(roe)
    profit_stability_score = score_profit_stability(operating_income, net_income)
    quality_score = operating_margin_score + roe_score + profit_stability_score

    debt_ratio_score = score_debt_ratio(debt_ratio)
    earnings_safety_score = score_earnings_safety(operating_income, net_income)
    safety_score = debt_ratio_score + earnings_safety_score

    market_cap_score = score_market_cap(market_cap)
    liquidity_score = score_liquidity(avg_trade_value_5d)
    market_score = market_cap_score + liquidity_score

    revenue_growth_score = score_revenue_growth(revenue_growth)
    operating_income_growth_score = score_operating_income_growth(operating_income_growth)
    net_income_growth_score = score_net_income_growth(net_income_growth)
    change_score = revenue_growth_score + operating_income_growth_score + net_income_growth_score

    total_score = value_score + quality_score + safety_score + market_score + change_score

    if debt_ratio >= 200 or equity <= 0:
        risk_level = "주의"
        risk_title = "재무 안정성 점검 필요"
        risk_text = f"부채비율이 {debt_ratio:.1f}%로 높아 재무 안정성 점검이 필요합니다."
        check_point = "부채비율, 차입금, 유상증자 가능성 관련 최신 공시 확인"
    elif avg_trade_value_5d < MIN_AVG_TRADE_VALUE:
        risk_level = "보통"
        risk_title = "유동성 점검 필요"
        risk_text = f"최근 5영업일 평균 거래대금이 {fmt_krw(avg_trade_value_5d)} 수준으로 낮아 유동성 점검이 필요합니다."
        check_point = "최근 5영업일 거래대금과 체결 강도 확인"
    elif operating_income <= 0 or net_income <= 0:
        risk_level = "주의"
        risk_title = "이익 안정성 확인 필요"
        risk_text = "영업이익 또는 순이익이 약해 수익성의 지속 여부를 점검해야 합니다."
        check_point = "다음 분기 실적과 이익 회복 흐름 확인"
    else:
        risk_level = "낮음"
        risk_title = "전반적 안정 구간"
        risk_text = "저평가, 재무안정성, 거래 유동성이 모두 비교적 양호한 편입니다."
        check_point = "업황 변화와 다음 분기 실적 흐름 확인"

    summary = (
        f"PER {fmt_ratio(per)}배, PBR {fmt_ratio(pbr)}배, 시총 {fmt_krw(market_cap)}, "
        f"최근 5일 평균 거래대금 {fmt_krw(avg_trade_value_5d)}, 부채비율 {debt_ratio:.1f}%입니다."
    )

    description = (
        f"{used_year} 사업보고서와 KRX 시장데이터를 함께 반영했습니다. "
        f"영업이익률은 {operating_margin:.1f}%, ROE는 {roe:.1f}%이며, "
        f"매출 성장률 {revenue_growth:.1f}%, 영업이익 성장률 {operating_income_growth:.1f}%, "
        f"순이익 성장률 {net_income_growth:.1f}%입니다."
    )

    return {
        "code": stock_code,
        "name": item["name"],
        "market": item["market"],
        "totalScore": total_score,
        "valueScore": value_score,
        "qualityScore": quality_score,
        "safetyScore": safety_score,
        "marketScore": market_score,
        "changeScore": change_score,
        "risk": risk_text,
        "summary": summary,
        "description": description,
        "updatedAt": today,
        "basisYear": used_year,
        "corpCode": corp_info["corp_code"],
        "scoreBreakdown": {
            "value": value_score,
            "quality": quality_score,
            "safety": safety_score,
            "market": market_score,
            "change": change_score,
            "perScore": per_score,
            "pbrScore": pbr_score,
            "discountBonus": discount_bonus,
            "operatingMarginScore": operating_margin_score,
            "roeScore": roe_score,
            "profitStabilityScore": profit_stability_score,
            "debtRatioScore": debt_ratio_score,
            "earningsSafetyScore": earnings_safety_score,
            "marketCapScore": market_cap_score,
            "liquidityScore": liquidity_score,
            "revenueGrowthScore": revenue_growth_score,
            "operatingIncomeGrowthScore": operating_income_growth_score,
            "netIncomeGrowthScore": net_income_growth_score,
        },
        "metrics": {
            "revenue": revenue,
            "operatingIncome": operating_income,
            "netIncome": net_income,
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "debtRatio": round(debt_ratio, 1),
            "operatingMargin": round(operating_margin, 1),
            "revenueGrowth": round(revenue_growth, 1),
            "operatingIncomeGrowth": round(operating_income_growth, 1),
            "netIncomeGrowth": round(net_income_growth, 1),
            "roe": round(roe, 1),
            "per": round(per, 2) if per is not None else None,
            "pbr": round(pbr, 2) if pbr is not None else None,
            "marketCap": market_cap,
            "tradeValue": trade_value,
            "avgTradeValue5d": avg_trade_value_5d,
            "closePrice": close_price,
            "listShares": list_shares,
            "basicBasDd": item.get("basicBasDd"),
            "dailyBasDd": item.get("dailyBasDd"),
            "dailyWindowDates": item.get("dailyWindowDates", []),
        },
        "riskMeta": {
            "level": risk_level,
            "title": risk_title,
            "checkPoint": check_point,
        },
    }


def get_week_label(dt):
    week_no = ((dt.day - 1) // 7) + 1
    return f"{dt.year}년 {dt.month}월 {week_no}주차"


def build_report_highlight(stock):
    metrics = stock.get("metrics", {})
    return (
        f"{stock['name']}: PER {fmt_ratio(metrics.get('per'))}배, "
        f"PBR {fmt_ratio(metrics.get('pbr'))}배, 시총 {fmt_krw(metrics.get('marketCap', 0))}, "
        f"최근 5일 평균 거래대금 {fmt_krw(metrics.get('avgTradeValue5d', 0))}, "
        f"부채비율 {metrics.get('debtRatio', 0):.1f}%"
    )


def main():
    corp_map = build_corp_code_map()
    krx_universe = build_krx_universe()

    candidates = [
        x
        for x in krx_universe
        if x["code"] in corp_map
        and x.get("marketCap", 0) > 0
        and x.get("avgTradeValue5d", 0) > 0
    ]
    candidates.sort(key=lambda x: (x.get("avgTradeValue5d", 0), x.get("marketCap", 0)), reverse=True)

    stocks = []
    for item in candidates[: max(MAX_STOCKS * 4, 200)]:
        stock = build_stock_item(item, corp_map)
        if not stock:
            continue

        if stock["metrics"].get("marketCap", 0) < MIN_MARKET_CAP:
            continue

        stocks.append(stock)
        if len(stocks) >= MAX_STOCKS:
            break

    if not stocks:
        raise RuntimeError("No stocks generated. Check KRX approvals, basDd handling, and DART mappings.")

    stocks.sort(
        key=lambda x: (
            x["totalScore"],
            x["metrics"].get("avgTradeValue5d", 0),
            x["metrics"].get("marketCap", 0),
        ),
        reverse=True,
    )

    risks = []
    for stock in stocks:
        risks.append(
            {
                "date": today,
                "code": stock["code"],
                "name": stock["name"],
                "level": stock["riskMeta"]["level"],
                "title": stock["riskMeta"]["title"],
                "summary": stock["risk"],
                "checkPoint": stock["riskMeta"]["checkPoint"],
            }
        )

    top_picks = stocks[:10]
    reports = [
        {
            "week": get_week_label(kst_now),
            "publishedAt": today,
            "title": "이번 주 공시 + 시장데이터 기반 우량주 후보 리포트",
            "summary": "OpenDART 사업보고서와 KRX 상장종목/일별매매정보를 바탕으로 저평가·안전성·시장성을 함께 반영한 주간 리포트입니다.",
            "topPickCodes": [item["code"] for item in top_picks],
            "highlights": [build_report_highlight(item) for item in top_picks[:5]],
            "marketNote": "이번 단계부터는 PER, PBR, 시가총액, 최근 5영업일 평균 거래대금을 함께 반영한 점수 체계로 상위 후보를 선별합니다.",
            "disclaimer": "본 자료는 투자 권유가 아니라 공개 데이터 기반 정리 자료입니다.",
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
