import io
import json
import os
import re
import time
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
history_path = DATA_DIR / "history.json"
sector_map_path = DATA_DIR / "sector_map.json"

OPENDART_API_KEY = os.getenv("OPENDART_API_KEY", "").strip()
KRX_API_KEY = os.getenv("KRX_API_KEY", "").strip()
# KRX 요청 URL/헤더/파라미터를 로그에 그대로 찍는 디버그 스위치.
# GitHub Actions에서 workflow_dispatch로 수동 실행할 때 켤 수 있게
# .github/workflows/weekly-json-update.yml에 입력값으로 연결돼 있다.
# 키 값 자체는 mask_secret()으로 가려서 찍는다.
KRX_DEBUG = os.getenv("KRX_DEBUG", "").strip().lower() in ("1", "true", "yes")

DEFAULT_KRX_KOSPI_BASIC_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info"
DEFAULT_KRX_KOSDAQ_BASIC_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info"
DEFAULT_KRX_KOSPI_DAILY_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd"
DEFAULT_KRX_KOSDAQ_DAILY_URL = "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd"
DEFAULT_KRX_KOSPI_INDEX_DAILY_URL = "https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd"

MAX_STOCKS = 500
REFRESH_COUNT = 150
refresh_target = REFRESH_COUNT  # backward-compatible alias for old debug/log references
REFRESH_SCAN_MULTIPLIER = 4
HTTP_TIMEOUT = 180
HTTP_RETRIES = 3
HTTP_RETRY_SLEEP = 5
REPORT_CODE = "11011"
DAILY_WINDOW = 5
RECENT_DAYS_BACK = 20
MIN_MARKET_CAP = 100_0000_0000  # 1,000억원
MIN_AVG_TRADE_VALUE = 10_0000_0000  # 10억원

# === RISK GRADE FIX: 등급 분포 조정 비율 ===
RISK_LOW_PCT = 0.40      # 하위 40% -> 낮음
RISK_MEDIUM_PCT = 0.80   # 40%~80% -> 보통, 80%~100% -> 주의

# === FAIR VALUE V2 ===
# 이익 정규화: net_income/operating_income 비율로 가중 보간.
# 1.2 이하는 원본 그대로, 2.0 이상은 operating_income*0.78, 그 사이는 선형 보간.
# operating_income<=0이면 정규화 미적용(원본 유지).
NORMALIZATION_TAX_MULTIPLIER = 0.78
NORMALIZATION_BLEND_LOW = 1.2
NORMALIZATION_BLEND_HIGH = 2.0

# 목표 PER 부분회귀: target_per = per + λ*(섹터중앙값PER - per)
# 섹터는 sector_map.json의 induty_code 2자리 중분류. 표본 5개 미만이면 λ를 낮추고,
# 섹터 매칭 자체가 안 되면 전체 시장 중앙값을 기준으로 λ를 낮춰 적용한다.
REGRESSION_LAMBDA_FULL = 0.3
REGRESSION_LAMBDA_LOW = 0.15
MIN_SECTOR_SAMPLE = 5

# 지주회사 할인: KSIC상 지주회사가 "금융및보험업"(64)으로 분류돼 실제 사업과
# 무관한 금융업 중앙값으로 목표가가 끌려 올라가는 문제 보완. 업계 통상
# NAV 대비 30~50% 할인 중 보수적으로 30%를 목표가(전 구간)에 곱한다.
HOLDING_DISCOUNT_RATE = 0.30

# 상승여력 표시 캡(계산값 자체는 캡 없이 보존, 표시용 필드만 자름)
UPSIDE_CAP_HIGH = 80.0
UPSIDE_CAP_LOW = -40.0

# 등급 백분위 컷오프 (INCLUDED 종목 기준, decision==EXCLUDED는 항상 D)
GRADE_S_PCT = 0.07
GRADE_A_PCT = 0.25
GRADE_B_PCT = 0.65

MODEL_VERSION = "v2"
# === FAIR VALUE V2 끝 ===

kst_now = datetime.utcnow() + timedelta(hours=9)
today = kst_now.strftime("%Y-%m-%d")
target_year = str(kst_now.year - 1)

NEGATIVE_KEYWORDS = [
    "유상증자", "전환사채", "신주인수권부사채", "횡령", "배임",
    "적자전환", "실적악화", "감사의견", "소송", "영업정지",
    "상장폐지", "불성실공시", "채무", "부도", "리콜",
]
UNCERTAINTY_KEYWORDS = [
    "검토중", "예정", "추진", "변경", "정정", "조회공시", "미확정",
]
POSITIVE_KEYWORDS = [
    "수주", "계약체결", "실적개선", "흑자전환", "배당", "자사주", "신사업",
]


def normalize_krx_url(url, fallback):
    candidate = (url or fallback or "").strip()
    if not candidate:
        return fallback
    return candidate.replace("/svc/sample/apis/", "/svc/apis/")


KRX_KOSPI_BASIC_URL = normalize_krx_url(
    os.getenv("KRX_KOSPI_BASIC_URL", ""), DEFAULT_KRX_KOSPI_BASIC_URL
)
KRX_KOSDAQ_BASIC_URL = normalize_krx_url(
    os.getenv("KRX_KOSDAQ_BASIC_URL", ""), DEFAULT_KRX_KOSDAQ_BASIC_URL
)
KRX_KOSPI_DAILY_URL = normalize_krx_url(
    os.getenv("KRX_KOSPI_DAILY_URL", ""), DEFAULT_KRX_KOSPI_DAILY_URL
)
KRX_KOSDAQ_DAILY_URL = normalize_krx_url(
    os.getenv("KRX_KOSDAQ_DAILY_URL", ""), DEFAULT_KRX_KOSDAQ_DAILY_URL
)
KRX_KOSPI_INDEX_DAILY_URL = normalize_krx_url(
    os.getenv("KRX_KOSPI_INDEX_DAILY_URL", ""), DEFAULT_KRX_KOSPI_INDEX_DAILY_URL
)

if not OPENDART_API_KEY:
    raise RuntimeError("OPENDART_API_KEY is missing")
if not KRX_API_KEY:
    raise RuntimeError("KRX_API_KEY is missing")


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_json(path, default):
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return default


def load_sector_map():
    """scripts/build_sector_map.py가 만든 app/data/sector_map.json을 로드한다.
    파일이 없거나 비어있어도 파이프라인 전체가 죽으면 안 되므로 빈 dict로 폴백한다
    (이 경우 모든 종목이 fair-value v2의 "섹터 매칭 실패" 경로로 빠져 시장 전체
    중앙값 기준으로 처리된다)."""
    data = load_json(sector_map_path, {})
    if isinstance(data, dict) and isinstance(data.get("items"), dict):
        return data["items"]
    return {}


SECTOR_MAP = load_sector_map()


def normalize_net_income(operating_income, net_income):
    """이익 정규화(fair-value v2). operating_income<=0이면 정규화하지 않고
    원본을 그대로 반환한다. 그 외에는 ratio=net/op 기준으로
    [NORMALIZATION_BLEND_LOW, NORMALIZATION_BLEND_HIGH] 구간에서 원본과
    operating_income*NORMALIZATION_TAX_MULTIPLIER 사이를 선형 보간한다.
    min()으로 항상 원본 이하로만 움직이도록 보장한다(정규화가 원본보다
    커지는 방향으로 작동하는 경우를 원천 차단).
    반환값: (normalized_net_income, weight, applied)"""
    if operating_income is None or operating_income <= 0 or not net_income:
        return net_income, 0.0, False

    ratio = net_income / operating_income
    if ratio <= NORMALIZATION_BLEND_LOW:
        weight = 0.0
    elif ratio >= NORMALIZATION_BLEND_HIGH:
        weight = 1.0
    else:
        weight = (ratio - NORMALIZATION_BLEND_LOW) / (
            NORMALIZATION_BLEND_HIGH - NORMALIZATION_BLEND_LOW
        )

    blended = net_income * (1 - weight) + (
        operating_income * NORMALIZATION_TAX_MULTIPLIER
    ) * weight
    normalized = min(blended, net_income)
    applied = abs(normalized - net_income) > 1e-6
    return normalized, weight, applied


def percentile_stats(values):
    """정렬된 값 목록에서 p25/p50/p75(순위기반, nearest-rank)와 표본 수를 계산한다."""
    if not values:
        return None
    s = sorted(values)
    n = len(s)

    def _p(p):
        idx = min(n - 1, max(0, round((p / 100) * (n - 1))))
        return s[idx]

    return {"p25": _p(25), "p50": _p(50), "p75": _p(75), "n": n}


def http_get_json(base_url, params):
    query = urllib.parse.urlencode(params)
    url = f"{base_url}?{query}"
    with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


class KrxRequestError(RuntimeError):
    """KRX 요청 실패. http_status가 있으면(401/403 등) 재시도해도 결과가
    바뀌지 않는 인증/권한 오류일 가능성이 높다는 신호로 쓴다."""

    def __init__(self, message, http_status=None):
        super().__init__(message)
        self.http_status = http_status


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
        raise KrxRequestError(
            f"KRX request failed for {url}: {json.dumps(payload, ensure_ascii=False)}",
            http_status=e.code,
        )
    try:
        return json.loads(body)
    except Exception:
        raise KrxRequestError(f"Invalid JSON response from {url}: {body[:300]}")


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


def parse_number(value):
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if text == "":
        return None
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    try:
        return float(text)
    except Exception:
        return None


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


def clamp(value, min_value=0, max_value=100):
    return max(min_value, min(max_value, value))


def mask_secret(value, keep=4):
    """디버그 로그에 인증키 원문이 그대로 찍히지 않도록 마스킹한다.
    앞 keep자만 남기고 나머지는 *로 가린다."""
    if not value:
        return ""
    text = str(value)
    if len(text) <= keep:
        return "*" * len(text)
    return text[:keep] + "*" * (len(text) - keep)


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
    with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as resp:
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


def is_holding_company(stock_name, sector_info):
    """지주회사/금융지주 판별. KSIC상 지주회사는 실제 영위 사업과 무관하게
    "금융 및 보험업"(중분류 64, induty_code가 64로 시작)으로 분류되는 경우가
    흔하다 — 그래서 섹터 부분회귀(target_per)가 실제와 무관한 금융업 중앙값을
    끌어와 적정주가를 과대평가하는 문제가 있었다. 여기에 종목명에 "홀딩스"/
    "지주"가 들어간 경우도 함께 잡는다(KSIC 매칭이 안 됐거나 64가 아닌
    경우 보완)."""
    sector_info = sector_info or {}
    induty_code = str(sector_info.get("induty_code") or "")
    ksic_mid = str(sector_info.get("ksic_중분류") or "")
    is_finance_sector = induty_code.startswith("64") or ksic_mid == "64"

    name = str(stock_name or "")
    is_name_match = ("홀딩스" in name) or ("지주" in name)

    return bool(is_finance_sector or is_name_match)


def krx_headers():
    # KRX 오픈API 공식 스펙: AUTH_KEY는 HTTP 헤더로만 전달한다.
    # (예전 코드는 쿼리스트링으로도 같이 보내는 폴백을 시도했는데,
    # 스펙 위반이라 제거했다 — 아래 fetch_krx_rows 주석 참고.)
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
    """KRX 정보데이터시스템 오픈API 호출.

    예전엔 인증 방식을 확신하지 못해 header-auth / query-auth /
    header+query-auth 3가지를 순서대로 시도했다. KRX 오픈API 공식 스펙은
    AUTH_KEY를 HTTP 헤더로만 받는 방식이라, 쿼리스트링에 AUTH_KEY를 같이
    실어 보내는 두 방식은 스펙 위반이었다 — 지금까지는 header-auth가
    먼저 시도돼서 대개 성공했기 때문에 드러나지 않았을 뿐이다. 스펙대로
    헤더 방식 하나로 정리한다.
    """
    if not url:
        return [], [f"missing url for basDd={bas_dd}"]

    headers = krx_headers()
    params = {"basDd": bas_dd}

    if KRX_DEBUG:
        debug_headers = {
            key: (mask_secret(value) if key == "AUTH_KEY" else value)
            for key, value in headers.items()
        }
        print(f"[KRX_DEBUG] GET {url}?{urllib.parse.urlencode(params)}")
        print(f"[KRX_DEBUG] headers={debug_headers}")

    errors = []
    data = None
    for attempt in range(1, HTTP_RETRIES + 1):
        try:
            data = request_json_url(url, headers=headers, params=params)
            break
        except KrxRequestError as e:
            errors.append(f"attempt {attempt}/{HTTP_RETRIES}: {e}")
            if e.http_status in (401, 403):
                # 인증/권한 오류는 같은 요청을 재시도해도 결과가 바뀌지
                # 않으므로 바로 포기한다 — 나머지 basDd 후보로 넘어가거나
                # 사용자에게 키/구독 상태를 확인하라고 알려주는 편이 낫다.
                print(
                    f"[KRX] AUTH_KEY 인증 실패(HTTP {e.http_status}) — url={url}, "
                    f"basDd={bas_dd}. KRX_API_KEY 값/구독 상태를 확인하세요. "
                    f"AUTH_KEY(마스킹)={mask_secret(KRX_API_KEY)}"
                )
                return [], errors
            if attempt < HTTP_RETRIES:
                time.sleep(HTTP_RETRY_SLEEP)
        except RuntimeError as e:
            errors.append(f"attempt {attempt}/{HTTP_RETRIES}: {e}")
            if attempt < HTTP_RETRIES:
                time.sleep(HTTP_RETRY_SLEEP)

    if data is None:
        return [], errors

    if isinstance(data, dict):
        resp_code = str(data.get("respCode", "")).strip()
        resp_msg = str(data.get("respMsg", "")).strip()
        if resp_code and resp_code != "000":
            errors.append(f"respCode={resp_code}, respMsg={resp_msg}")
            return [], errors
        rows = data.get("OutBlock_1", [])
        if isinstance(rows, list) and rows:
            return rows, errors
        if isinstance(rows, list):
            errors.append(f"OutBlock_1 empty for basDd={bas_dd}")
            return [], errors

    errors.append(f"unexpected payload shape for basDd={bas_dd}")
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
            f"{bas_dd} | KOSPI basic: {' ; '.join(kospi_basic_errors)} | "
            f"KOSDAQ basic: {' ; '.join(kosdaq_basic_errors)}"
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
                f"{bas_dd} | KOSPI daily: {' ; '.join(kospi_daily_errors)} | "
                f"KOSDAQ daily: {' ; '.join(kosdaq_daily_errors)}"
            )

    latest_daily = daily_snapshots[0]["rows"] if daily_snapshots else {}
    used_daily_dates = [snap["basDd"] for snap in daily_snapshots]
    prev_daily = daily_snapshots[1]["rows"] if len(daily_snapshots) > 1 else {}

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

        prev_close = int(prev_daily.get(code, {}).get("closePrice", 0))
        close_price = int(latest_metrics.get("closePrice", 0))
        price_change = close_price - prev_close
        price_change_rate = (price_change / prev_close * 100) if prev_close else 0
        avg_trade_value_5d = int(sum(trade_values) / len(trade_values)) if trade_values else 0

        item.update(
            {
                "tradeValue": int(latest_metrics.get("tradeValue", 0)),
                "closePrice": close_price,
                "prevClosePrice": prev_close,
                "priceChange": price_change,
                "priceChangeRate": round(price_change_rate, 2),
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
    result.sort(
        key=lambda x: (x.get("avgTradeValue5d", 0), x.get("marketCap", 0)),
        reverse=True,
    )

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


def apply_rank_gate(total_score, debt_ratio, operating_income, net_income, equity):
    penalty = 0
    flags = []
    top_rank_eligible = True
    if equity <= 0:
        penalty += 40
        flags.append("자본잠식 또는 자본 0 이하")
        top_rank_eligible = False
    if debt_ratio >= 300:
        penalty += 30
        flags.append("부채비율 300% 이상")
        top_rank_eligible = False
    elif debt_ratio >= 200:
        penalty += 15
        flags.append("부채비율 200% 이상")
        top_rank_eligible = False
    if operating_income <= 0 and net_income <= 0:
        penalty += 10
        flags.append("영업이익/순이익 동시 부진")
    elif operating_income <= 0 or net_income <= 0:
        penalty += 5
        flags.append("이익 안정성 약함")
    adjusted_score = max(total_score - penalty, 0)
    return adjusted_score, penalty, flags, top_rank_eligible


def extract_kospi_benchmark(rows):
    if not rows:
        return None
    for row in rows:
        idx_name = str(
            pick_field(
                row,
                exact_keys=["IDX_NM", "idxNm", "KOR_NM"],
                contains_keys=["idx_nm", "name", "nm"],
            )
            or ""
        ).strip()
        close_value = parse_number(
            pick_field(
                row,
                exact_keys=["CLSPRC_IDX", "TDD_CLSPRC_IDX", "IDX_CLSPRC", "closePrice"],
                contains_keys=["clsprc", "close"],
            )
        )
        if close_value is not None and (
            idx_name.lower() == "kospi"
            or idx_name == "코스피"
            or "kospi" in idx_name.lower()
            or "코스피" in idx_name
        ):
            return {
                "name": idx_name or "KOSPI",
                "close": round(close_value, 2),
            }
    first = rows[0]
    fallback_name = str(first.get("IDX_NM") or first.get("idxNm") or "KOSPI")
    fallback_close = parse_number(
        pick_field(
            first,
            exact_keys=["CLSPRC_IDX", "TDD_CLSPRC_IDX", "IDX_CLSPRC", "closePrice"],
            contains_keys=["clsprc", "close"],
        )
    )
    if fallback_close is not None:
        return {
            "name": fallback_name,
            "close": round(fallback_close, 2),
        }
    return None


def infer_sector(stock_name, market):
    name = str(stock_name or "")
    rules = [
        (["반도체", "칩", "세미", "테크"], "반도체"),
        (["배터리", "전지", "에너지솔루션", "화학"], "2차전지"),
        (["자동차", "모비스", "타이어", "부품"], "자동차/부품"),
        (["금융", "은행", "증권", "카드", "보험", "금융지주"], "금융"),
        (["게임", "엔터", "콘텐츠", "미디어", "스튜디오", "에스엠", "SM", "하이브", "JYP", "와이지", "YG", "큐브", "키이스트", "디어유"], "미디어/엔터"),
        (["바이오", "제약", "헬스", "메디", "약품"], "바이오/제약"),
        (["통신", "텔레콤"], "통신"),
        (["건설", "시멘트", "인프라"], "건설/인프라"),
        (["유통", "마트", "쇼핑", "커머스"], "유통/소비"),
        (["조선", "중공업", "기계"], "산업재"),
    ]
    for keywords, sector_name in rules:
        if any(keyword in name for keyword in keywords):
            return sector_name
    return "대형주" if market == "KOSPI" else "중소형주"


def count_keyword_hits(texts, keywords):
    count = 0
    hits = []
    for text in texts:
        lowered = str(text).lower()
        matched = [keyword for keyword in keywords if keyword.lower() in lowered]
        if matched:
            count += 1
            hits.extend(matched)
    return count, sorted(set(hits))


def build_news_meta(stock):
    texts = []
    rank_flags = stock.get("rankMeta", {}).get("flags", [])
    undervalue_flags = stock.get("undervalueMeta", {}).get("flags", [])
    risk = stock.get("risk", "")
    summary = stock.get("summary", "")
    description = stock.get("description", "")
    title = stock.get("riskMeta", {}).get("title", "")
    check_point = stock.get("riskMeta", {}).get("checkPoint", "")

    texts.extend(rank_flags)
    texts.extend(undervalue_flags)
    texts.extend([risk, summary, description, title, check_point])

    negative_count, negative_hits = count_keyword_hits(texts, NEGATIVE_KEYWORDS)
    uncertainty_count, uncertainty_hits = count_keyword_hits(texts, UNCERTAINTY_KEYWORDS)
    positive_count, positive_hits = count_keyword_hits(texts, POSITIVE_KEYWORDS)

    score = clamp(60 + positive_count * 8 - negative_count * 14 - uncertainty_count * 6)

    flags = []
    if negative_count:
        flags.append(f"악재 {negative_count}건")
    if uncertainty_count:
        flags.append(f"불확실성 {uncertainty_count}건")
    if positive_count:
        flags.append(f"호재 {positive_count}건")
    if not flags:
        flags.append("눈에 띄는 뉴스 플래그 없음")

    return {
        "recentNewsCount": len([t for t in texts if t]),
        "recentDisclosureCount": 0,
        "negativeCount": negative_count,
        "uncertaintyCount": uncertainty_count,
        "positiveCount": positive_count,
        "score": int(round(score)),
        "flags": flags,
        "negativeKeywords": negative_hits,
        "uncertaintyKeywords": uncertainty_hits,
        "positiveKeywords": positive_hits,
    }


def build_timing_meta(stock):
    metrics = stock.get("metrics", {})
    price_change_5d = float(metrics.get("priceChangeRate", 0) or 0)
    upside = float(metrics.get("upside", 0) or 0)
    liquidity = float(metrics.get("avgTradeValue5d", 0) or 0)

    recent_spike_flag = price_change_5d >= 20
    volume_spike_flag = liquidity >= 300_0000_0000
    expensive_flag = upside < -20

    overheat_penalty = 12 if recent_spike_flag else 0
    expensive_penalty = 10 if expensive_flag else 0

    score = clamp(
        55 + price_change_5d * 0.8 + upside * 0.15 - overheat_penalty - expensive_penalty
    )

    reason_parts = []
    if recent_spike_flag:
        reason_parts.append("최근 급등 부담 존재")
    if volume_spike_flag:
        reason_parts.append("거래대금 충분")
    if expensive_flag:
        reason_parts.append("적정가 대비 고평가 부담")
    if not reason_parts:
        reason_parts.append("타이밍상 중립 구간")

    return {
        "score": int(round(score)),
        "recentSpikeFlag": recent_spike_flag,
        "volumeSpikeFlag": volume_spike_flag,
        "reason": " · ".join(reason_parts),
    }


# === RISK GRADE FIX: 절대 기준선 대신 연속 위험도 점수 계산 ===
def compute_risk_score(debt_ratio, equity, avg_trade_value_5d, operating_income, net_income):
    """0~100 사이 연속 점수. 높을수록 위험."""
    score = 0.0

    # 자본잠식 여부 (가장 치명적인 항목)
    if equity <= 0:
        score += 45

    # 부채비율 구간별 가중치
    if debt_ratio >= 300:
        score += 30
    elif debt_ratio >= 200:
        score += 20
    elif debt_ratio >= 150:
        score += 12
    elif debt_ratio >= 100:
        score += 6
    elif debt_ratio >= 60:
        score += 2

    # 유동성(5일 평균 거래대금) 구간별 가중치
    if avg_trade_value_5d < MIN_AVG_TRADE_VALUE:
        score += 20
    elif avg_trade_value_5d < MIN_AVG_TRADE_VALUE * 3:
        score += 10
    elif avg_trade_value_5d < MIN_AVG_TRADE_VALUE * 10:
        score += 3

    # 이익 안정성
    if operating_income <= 0 and net_income <= 0:
        score += 20
    elif operating_income <= 0 or net_income <= 0:
        score += 10

    return clamp(score, 0, 100)


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

    normalized_net_income, normalization_weight, normalization_applied = normalize_net_income(
        operating_income, net_income
    )

    per = None
    if market_cap > 0 and normalized_net_income and normalized_net_income > 0:
        per = market_cap / normalized_net_income

    # target_price/targetPriceLow/High/upside(섹터 부분회귀 기반, fair-value v2)는
    # 이 시점엔 계산할 수 없다 — 섹터 중앙값 PER은 전체 종목이 다 모여야 알 수
    # 있는 population 통계이기 때문에, main()에서 전체 종목 리스트를 만든 뒤
    # 일괄 채운다. 여기서는 자리만 만들어둔다.
    target_price = None
    target_price_low = None
    target_price_high = None
    upside = None

    momentum = round(item.get("priceChangeRate", 0), 2)

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
    change_score = (
        revenue_growth_score
        + operating_income_growth_score
        + net_income_growth_score
    )

    raw_total_score = value_score + quality_score + safety_score + market_score + change_score
    total_score, rank_penalty, rank_flags, top_rank_eligible = apply_rank_gate(
        raw_total_score,
        debt_ratio,
        operating_income,
        net_income,
        equity,
    )

    # === RISK GRADE FIX ===
    # 여기서는 최종 등급(낮음/보통/주의)을 확정하지 않고,
    # 연속 점수(riskScore)와 참고용 문구만 만든다.
    # 실제 등급은 main()에서 전체 종목 분포 기준 백분위로 배정한다.
    risk_score = compute_risk_score(
        debt_ratio, equity, avg_trade_value_5d, operating_income, net_income
    )

    if debt_ratio >= 200 or equity <= 0:
        risk_title = "재무 안정성 점검 필요"
        risk_text = f"부채비율이 {debt_ratio:.1f}%로 높아 재무 안정성 점검이 필요합니다."
        check_point = "부채비율, 차입금, 유상증자 가능성 관련 최신 공시 확인"
    elif avg_trade_value_5d < MIN_AVG_TRADE_VALUE:
        risk_title = "유동성 점검 필요"
        risk_text = f"최근 5영업일 평균 거래대금이 {fmt_krw(avg_trade_value_5d)} 수준으로 낮아 유동성 점검이 필요합니다."
        check_point = "최근 5영업일 거래대금과 체결 강도 확인"
    elif operating_income <= 0 or net_income <= 0:
        risk_title = "이익 안정성 확인 필요"
        risk_text = "영업이익 또는 순이익이 적자여서 이익 안정성 확인이 필요합니다."
        check_point = "다음 분기 실적 개선 여부 확인"
    else:
        risk_title = "재무구조 안정 구간"
        risk_text = "부채비율, 영업이익, 순이익, 거래량 등 주요 지표가 무난한 수준입니다."
        check_point = "업황 변동, 신규 공시 등 일반적인 뉴스 흐름 확인"

    summary = (
        f"PER {fmt_ratio(per)}배, PBR {fmt_ratio(pbr)}배, 시총 {fmt_krw(market_cap)}, "
        f"최근 5일 평균 거래대금 {fmt_krw(avg_trade_value_5d)}, 부채비율 {debt_ratio:.1f}%입니다."
    )
    description = (
        f"{used_year} 사업연도 기준 KRX 시세데이터와 OpenDART 재무데이터를 결합해 산출했습니다. "
        f"영업이익률 {operating_margin:.1f}%, ROE {roe:.1f}%이며, "
        f"매출 성장률 {revenue_growth:.1f}%, 영업이익 성장률 {operating_income_growth:.1f}%, "
        f"순이익 성장률 {net_income_growth:.1f}%입니다."
    )

    sector_name = infer_sector(item["name"], item["market"])
    # fair-value v2: 목표 PER 부분회귀에 쓰는 섹터는 infer_sector()의 키워드
    # 분류(sector_name, sectorMeta/타이밍용으로 계속 씀)가 아니라
    # sector_map.json의 KSIC 중분류다. build_sector_map.py를 먼저 돌려야
    # 채워진다 — 없으면 None이고, main()에서 시장 전체 중앙값 폴백으로 처리된다.
    sector_info = SECTOR_MAP.get(stock_code) or {}
    sector_code = sector_info.get("ksic_중분류")
    holding_discount = is_holding_company(item["name"], sector_info)

    # fair-value v2 계산이 이 종목에 대해 온전한지 판정한다. 셋 중 하나라도
    # 걸리면 "이 종목은 v2 적정가 신뢰도가 낮다"는 뜻이지, 종목 자체를
    # 목록에서 빼는 이유가 되면 안 된다(그게 이번 수정의 핵심 원칙) —
    # 그래서 여기선 플래그만 세우고 아래에서 stock을 그대로 만든다.
    #   1) operating_income<=0: 이익 정규화(normalize_net_income)가 미적용된다
    #   2) sector_code 없음: KSIC 섹터 매칭 실패, 목표가 부분회귀가 저신뢰
    #      폴백(시장 전체 중앙값/고정값)으로 떨어진다
    #   3) per(또는 정규화된 net_income)가 없음: PER/목표가/upside 자체를
    #      계산할 근거가 없다
    fair_value_partial = bool(
        (operating_income is None or operating_income <= 0)
        or not sector_code
        or per is None
        or not normalized_net_income
        or normalized_net_income <= 0
    )
    model_version = "v2-partial" if fair_value_partial else MODEL_VERSION

    stock = {
        "code": stock_code,
        "name": item["name"],
        "market": item["market"],
        "sector": sector_name,
        "sectorCode": sector_code,
        "modelVersion": model_version,
        "fairValuePartial": fair_value_partial,
        "holdingDiscount": holding_discount,
        "holdingDiscountRate": HOLDING_DISCOUNT_RATE if holding_discount else None,
        "rawTotalScore": raw_total_score,
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
            "normalizedNetIncome": round(normalized_net_income, 0)
            if normalized_net_income is not None
            else None,
            "netIncomeNormalized": normalization_applied,
            "normalizationWeight": round(normalization_weight, 3),
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
            "prevClosePrice": int(item.get("prevClosePrice", 0)),
            "priceChange": int(item.get("priceChange", 0)),
            "priceChangeRate": round(item.get("priceChangeRate", 0), 2),
            "targetPrice": target_price,
            "targetPriceConservative": target_price_low,
            "targetPriceOptimistic": target_price_high,
            "upside": round(upside, 1) if upside is not None else None,
            "momentum": momentum,
        },
        "riskMeta": {
            "level": None,          # === RISK GRADE FIX: main()에서 백분위로 배정 ===
            "riskScore": round(risk_score, 1),  # === RISK GRADE FIX: 참고용 연속 점수 ===
            "title": risk_title,
            "checkPoint": check_point,
        },
        "rankMeta": {
            "penalty": rank_penalty,
            "flags": rank_flags,
            "topRankEligible": top_rank_eligible,
        },
        "undervalueMeta": {
            "eligible": (
                equity > 0
                and market_cap >= MIN_MARKET_CAP
                and avg_trade_value_5d >= MIN_AVG_TRADE_VALUE
                and per is not None
                and pbr is not None
            ),
            "flags": (
                (["부채비율 과다"] if debt_ratio >= 200 else [])
                + (["이익 안정성 약함"] if (operating_income <= 0 or net_income <= 0) else [])
            ),
        },
    }

    stock["newsMeta"] = build_news_meta(stock)
    stock["timingMeta"] = build_timing_meta(stock)
    return stock


def build_sector_meta_map(stocks):
    sector_buckets = {}
    for stock in stocks:
        sector = stock.get("sector") or "대형주"
        sector_buckets.setdefault(sector, []).append(stock)

    sector_meta_map = {}
    for sector, bucket in sector_buckets.items():
        avg_return_5d = sum(float(s.get("metrics", {}).get("priceChangeRate", 0) or 0) for s in bucket) / max(len(bucket), 1)
        avg_revenue_growth = sum(float(s.get("metrics", {}).get("revenueGrowth", 0) or 0) for s in bucket) / max(len(bucket), 1)
        avg_liquidity = sum(float(s.get("metrics", {}).get("avgTradeValue5d", 0) or 0) for s in bucket) / max(len(bucket), 1)
        positive_count = sum(
            1 for s in bucket
            if float(s.get("metrics", {}).get("priceChangeRate", 0) or 0) > 0
        )

        return_score = clamp(50 + avg_return_5d * 1.8, 0, 100)
        growth_score = clamp(50 + avg_revenue_growth * 1.2, 0, 100)
        liquidity_score = clamp((avg_liquidity / 300_0000_0000) * 100, 0, 100)
        breadth_score = clamp((positive_count / max(len(bucket), 1)) * 100, 0, 100)

        strength_score = round(
            return_score * 0.35
            + growth_score * 0.25
            + liquidity_score * 0.25
            + breadth_score * 0.15
        )

        sector_meta_map[sector] = {
            "name": sector,
            "strengthScore": int(strength_score),
            "leaderFlag": strength_score >= 65,
            "reason": (
                "최근 흐름과 실적 성장세가 견고해 상대적으로 강한 섹터입니다"
                if strength_score >= 65
                else "최근 흐름이 상대적으로 약하거나 유동성이 부족한 섹터입니다"
            ),
        }
    return sector_meta_map


def build_market_state(stocks):
    avg_total_score = sum(float(s.get("totalScore", 0) or 0) for s in stocks) / max(len(stocks), 1)
    avg_momentum = sum(float(s.get("metrics", {}).get("priceChangeRate", 0) or 0) for s in stocks) / max(len(stocks), 1)
    eligible_ratio = (
        sum(1 for s in stocks if s.get("rankMeta", {}).get("topRankEligible")) / max(len(stocks), 1)
    )

    if avg_momentum >= 2 and eligible_ratio >= 0.55:
        return {
            "state": "risk_on",
            "label": "위험선호",
            "baseFit": 65,
            "reason": "종목군 전반의 모멘텀과 우량 종목 비중이 양호해 위험선호 국면으로 판단합니다.",
        }
    if avg_momentum <= -1 or avg_total_score < 45:
        return {
            "state": "risk_off",
            "label": "보수적 접근",
            "baseFit": 44,
            "reason": "시장 전반의 약세와 우량 종목 비중 하락이 확인되어 신중한 접근이 필요합니다.",
        }
    return {
        "state": "neutral",
        "label": "중립",
        "baseFit": 54,
        "reason": "강세/약세 신호가 뒤섞여 있어 종목별 옥석 가리기가 중요합니다.",
    }


def build_market_context(stock, market_state, sector_meta):
    sector_score = float(sector_meta.get("strengthScore", 50) or 50)
    liquidity = float(stock.get("metrics", {}).get("avgTradeValue5d", 0) or 0)
    market = str(stock.get("market", "")).upper()

    liquidity_bonus = clamp((liquidity / 250_0000_0000) * 15, 0, 15)
    market_bonus = 4 if market == "KOSPI" else 0

    fit_score = clamp(market_state["baseFit"] * 0.55 + sector_score * 0.30 + liquidity_bonus + market_bonus, 0, 100)

    return {
        "marketState": market_state["state"],
        "label": market_state["label"],
        "fitScore": int(round(fit_score)),
        "reason": f"{market_state['reason']} 섹터 강도와 유동성을 함께 반영했습니다.",
    }


# --- Practical final-pick logic v1 ---------------------------------------
# 랭킹 1위 후보 뽑는 최종 필터. finalPickMeta에 저장 결과 참고 시 2위 활용.
THEME_SECTOR_KEYWORDS = ["엔터", "미디어/엔터", "콘텐츠", "게임", "스타트업"]
SPECULATIVE_SECTOR_KEYWORDS = ["바이오/제약", "적자", "테마", "루머", "2차전지", "급등주"]
DEFENSIVE_SECTOR_KEYWORDS = ["통신", "금융", "유틸리티", "필수소비재", "대형주"]
CYCLICAL_SECTOR_KEYWORDS = ["반도체", "자동차/부품", "산업재", "화학", "조선"]


def practical_sector_type(stock):
    text = f"{stock.get('sector') or ''} {stock.get('name') or ''}"
    if any(k in text for k in THEME_SECTOR_KEYWORDS):
        return "theme"
    if any(k in text for k in SPECULATIVE_SECTOR_KEYWORDS):
        return "speculative"
    if any(k in text for k in DEFENSIVE_SECTOR_KEYWORDS):
        return "defensive"
    if any(k in text for k in CYCLICAL_SECTOR_KEYWORDS):
        return "cyclical"
    return "normal"


def practical_liquidity_score(avg_trade_value_5d, market_cap):
    score = 50
    if avg_trade_value_5d >= 300_0000_0000:
        score += 25
    elif avg_trade_value_5d >= 100_0000_0000:
        score += 18
    elif avg_trade_value_5d >= 30_0000_0000:
        score += 10
    elif avg_trade_value_5d >= 10_0000_0000:
        score += 4
    else:
        score -= 20
    if market_cap >= 10_0000_0000_0000:
        score += 12
    elif market_cap >= 1_0000_0000_0000:
        score += 8
    elif market_cap >= 300_0000_0000:
        score += 4
    elif market_cap < MIN_MARKET_CAP:
        score -= 20
    return clamp(score, 0, 100)


def build_final_pick_meta(stock):
    metrics = stock.get("metrics", {}) or {}
    news = stock.get("newsMeta", {}) or {}
    timing = stock.get("timingMeta", {}) or {}
    sector_meta = stock.get("sectorMeta", {}) or {}
    market_ctx = stock.get("marketContext", {}) or {}
    rank_meta = stock.get("rankMeta", {}) or {}
    reasons = []
    hard = []

    base_score = float(stock.get("totalScore", 50) or 50)
    sector = stock.get("sector") or "대형주"
    sector_type = practical_sector_type(stock)
    debt = float(metrics.get("debtRatio", 0) or 0)
    op_income = float(metrics.get("operatingIncome", 0) or 0)
    net_income = float(metrics.get("netIncome", 0) or 0)
    equity = float(metrics.get("equity", 0) or 0)
    market_cap = float(metrics.get("marketCap", 0) or 0)
    avg_value = float(metrics.get("avgTradeValue5d", 0) or 0)
    price_change = float(metrics.get("priceChangeRate", 0) or 0)
    per = metrics.get("per")
    pbr = metrics.get("pbr")
    upside = metrics.get("upside")
    timing_score = float(timing.get("score", 50) or 50)
    sector_strength = float(sector_meta.get("strengthScore", 50) or 50)
    market_fit = float(market_ctx.get("fitScore", 50) or 50)
    market_state = market_ctx.get("marketState", "neutral")
    negative_count = int(news.get("negativeCount", 0) or 0)
    uncertainty_count = int(news.get("uncertaintyCount", 0) or 0)

    if equity <= 0:
        hard.append("자본잠식 또는 자본 0 이하인 종목은 후보에서 제외합니다.")
    if debt >= 250:
        hard.append("부채비율 250% 이상인 종목은 후보에서 제외합니다.")
    if op_income <= 0 and net_income <= 0:
        hard.append("영업이익/순이익이 동시에 부진해서 후보에서 제외합니다.")
    if market_cap and market_cap < MIN_MARKET_CAP:
        hard.append("시가총액이 1,000억원 미만이어서 후보에서 제외합니다.")
    if avg_value and avg_value < MIN_AVG_TRADE_VALUE:
        hard.append("5일 평균 거래대금이 10억원 미만이어서 후보에서 제외합니다.")
    if hard:
        return {"decision": "EXCLUDED", "finalScore": 0, "sectorType": sector_type, "reasons": hard[:5], "debug": {"baseScore": round(base_score, 1), "timingScore": round(timing_score, 1), "sectorStrength": round(sector_strength, 1), "marketFit": round(market_fit, 1)}}

    liquidity_score = practical_liquidity_score(avg_value, market_cap)
    final_score = base_score * 0.30 + timing_score * 0.25 + market_fit * 0.20 + sector_strength * 0.10 + liquidity_score * 0.15

    if sector_type == "theme":
        final_score -= 18
        reasons.append(f"{sector} 섹터는 테마 성격이 강해 안정성 관점에서 감점했습니다.")
    elif sector_type == "speculative":
        final_score -= 25
        reasons.append(f"{sector} 섹터는 투기적 성격이 있어 보수적으로 감점했습니다.")
    elif sector_type == "cyclical":
        final_score -= 6
        reasons.append(f"{sector} 섹터는 경기/업황 민감도가 높아 소폭 감점했습니다.")
    elif sector_type == "defensive":
        final_score += 4
        reasons.append(f"{sector} 섹터는 방어적 성격이 있어 안정성 관점에서 소폭 가점했습니다.")

    if market_state == "risk_off":
        if sector_type in ["theme", "speculative"]:
            final_score -= 10
            reasons.append("보수적 시장 국면에서 테마/투기적 종목 비중을 축소했습니다.")
        elif sector_type == "defensive":
            final_score += 6
            reasons.append("보수적 시장 국면에서 방어적 종목을 우대했습니다.")
    elif market_state == "risk_on":
        if sector_type in ["theme", "speculative"]:
            final_score += 6
            reasons.append("위험선호 국면에서 성장/테마 종목 비중을 소폭 확대했습니다.")

    if negative_count:
        final_score -= negative_count * 6
        reasons.append(f"최근 부정적 뉴스 신호 {negative_count}건을 반영해 감점했습니다.")
    if uncertainty_count:
        final_score -= uncertainty_count * 3
        reasons.append(f"불확실성 신호 {uncertainty_count}건을 반영해 소폭 감점했습니다.")

    if upside is not None and upside >= 20:
        final_score += 4
        reasons.append("목표가 대비 상승여력이 커서 소폭 가점했습니다.")
    elif upside is not None and upside < -20:
        final_score -= 6
        reasons.append("목표가 대비 고평가 부담이 있어 감점했습니다.")

    final_score = clamp(final_score, 0, 100)
    if not reasons:
        reasons.append("특이 신호 없이 기본 지표 기준으로 평가했습니다.")

    return {
        "decision": "INCLUDED",
        "finalScore": int(round(final_score)),
        "sectorType": sector_type,
        "reasons": reasons[:5],
        "debug": {
            "baseScore": round(base_score, 1),
            "timingScore": round(timing_score, 1),
            "sectorStrength": round(sector_strength, 1),
            "marketFit": round(market_fit, 1),
            "liquidityScore": round(liquidity_score, 1),
            "marketState": market_state,
        },
    }
# ---------------------------------------------------------------------------


def attach_investment_meta(stocks):
    sector_meta_map = build_sector_meta_map(stocks)
    market_state = build_market_state(stocks)

    for stock in stocks:
        sector_name = stock.get("sector") or "대형주"
        sector_meta = sector_meta_map.get(
            sector_name,
            {
                "name": sector_name,
                "strengthScore": 50,
                "leaderFlag": False,
                "reason": "섹터 데이터가 부족합니다",
            },
        )
        stock["sectorMeta"] = sector_meta
        stock["marketContext"] = build_market_context(stock, market_state, sector_meta)
        stock["finalPickMeta"] = build_final_pick_meta(stock)

    return stocks


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


def build_history_entry(stocks):
    top_rank_stocks = [
        s for s in stocks if s.get("rankMeta", {}).get("topRankEligible")
    ]
    top_picks = (top_rank_stocks or stocks)[:10]

    kospi_rows, _ = fetch_krx_rows(
        KRX_KOSPI_INDEX_DAILY_URL, kst_now.strftime("%Y%m%d")
    )
    benchmark = extract_kospi_benchmark(kospi_rows)
    if benchmark is None:
        for bas_dd in recent_krx_bas_dd_candidates():
            kospi_rows, _ = fetch_krx_rows(KRX_KOSPI_INDEX_DAILY_URL, bas_dd)
            benchmark = extract_kospi_benchmark(kospi_rows)
            if benchmark:
                break

    return {
        "snapshotDate": today,
        "weekLabel": get_week_label(kst_now),
        "benchmark": benchmark,
        "top10": [
            {
                "rank": idx + 1,
                "code": stock["code"],
                "name": stock["name"],
                "market": stock["market"],
                "selectedPrice": int(stock.get("metrics", {}).get("closePrice", 0)),
                "totalScore": stock.get("totalScore", 0),
                "rawTotalScore": stock.get("rawTotalScore", 0),
                "targetPrice": stock.get("metrics", {}).get("targetPrice"),
                "upside": stock.get("metrics", {}).get("upside"),
                "momentum": stock.get("metrics", {}).get("momentum"),
            }
            for idx, stock in enumerate(top_picks)
        ],
    }


def main():
    corp_map = build_corp_code_map()
    krx_universe = build_krx_universe()
    print(f"[STAGE] krx_universe={len(krx_universe)}  corp_map={len(corp_map)}")

    candidates = [
        x
        for x in krx_universe
        if x["code"] in corp_map
        and x.get("marketCap", 0) > 0
        and x.get("avgTradeValue5d", 0) > 0
    ]
    candidates.sort(
        key=lambda x: (x.get("avgTradeValue5d", 0), x.get("marketCap", 0)),
        reverse=True,
    )
    print(f"[STAGE] candidates(corp_map 매칭 + 시총/거래대금>0)={len(candidates)}")

    stocks = []
    build_none_count = 0
    market_cap_reject_count = 0
    scanned = candidates[: max(MAX_STOCKS * 4, 200)]
    for item in scanned:
        stock = build_stock_item(item, corp_map)
        if not stock:
            build_none_count += 1
            continue
        if stock["metrics"].get("marketCap", 0) < MIN_MARKET_CAP:
            market_cap_reject_count += 1
            continue
        stocks.append(stock)
        if len(stocks) >= MAX_STOCKS:
            break

    print(
        f"[STAGE] build_stock_item 스캔={len(scanned)}건 -> "
        f"성공={len(stocks)} / DART매칭·재무데이터 없음={build_none_count} / "
        f"시총<{MIN_MARKET_CAP}={market_cap_reject_count} "
        f"(MAX_STOCKS={MAX_STOCKS}로 상한 - 스캔 대상 자체를 candidates[:{max(MAX_STOCKS*4,200)}]로 미리 제한함)"
    )

    if not stocks:
        raise RuntimeError(
            "No stocks generated. Check KRX approvals, basDd handling, and DART mappings."
        )

    stocks.sort(
        key=lambda x: (
            1 if x.get("rankMeta", {}).get("topRankEligible") else 0,
            x.get("totalScore", 0),
            x.get("metrics", {}).get("avgTradeValue5d", 0),
            x.get("metrics", {}).get("marketCap", 0),
        ),
        reverse=True,
    )
    stocks = stocks[:MAX_STOCKS]
    print(f"[STAGE] 정렬 후 MAX_STOCKS 상한 적용={len(stocks)}")

    # === FAIR VALUE V2: 섹터 부분회귀 기반 목표가 밴드 ===
    # target_per = per + λ*(섹터중앙값PER - per). 섹터 중앙값은 전체 종목이
    # 모여야 계산 가능한 population 통계이므로 여기서 일괄 처리한다.
    # attach_investment_meta()보다 반드시 먼저 실행해야 한다 — finalPickMeta와
    # timingMeta가 metrics.upside를 참조하기 때문이다.
    sector_per_buckets = {}
    market_per_values = []
    for s in stocks:
        per_value = s.get("metrics", {}).get("per")
        if per_value and per_value > 0:
            market_per_values.append(per_value)
            code = s.get("sectorCode")
            if code:
                sector_per_buckets.setdefault(code, []).append(per_value)

    sector_per_stats = {
        code: percentile_stats(values) for code, values in sector_per_buckets.items()
    }
    market_per_stats = percentile_stats(market_per_values)

    for s in stocks:
        metrics = s["metrics"]
        per_value = metrics.get("per")
        close_price = metrics.get("closePrice") or 0
        if not per_value or per_value <= 0 or not close_price:
            # per(정규화된 순이익 기준)이 없으면 목표가/upside 자체를 계산할
            # 근거가 없다 — 종목을 빼지 않고 관련 필드만 null로 남긴다.
            # metrics.targetPrice*/upside는 build_stock_item()에서 이미
            # None으로 초기화돼 있으므로 여기서 건드릴 필요 없다.
            s["display"] = {
                "upsideLabel": None,
                "upsideLabelReason": None,
                "upsideCapped": None,
            }
            s["fairValueMeta"] = {
                "sectorCode": s.get("sectorCode"),
                "sectorSampleTier": "fixed",
                "sectorSampleSize": 0,
                "regressionLambda": 0.0,
                "sectorMedianPerUsed": None,
            }
            continue

        sector_code = s.get("sectorCode")
        stats = sector_per_stats.get(sector_code) if sector_code else None
        if stats and stats["n"] >= MIN_SECTOR_SAMPLE:
            lam = REGRESSION_LAMBDA_FULL
            sample_tier = "sector"
        elif stats:
            lam = REGRESSION_LAMBDA_LOW
            sample_tier = "sector_small"
        elif market_per_stats:
            stats = market_per_stats
            lam = REGRESSION_LAMBDA_LOW
            sample_tier = "market"
        else:
            stats = None
            lam = 0.0
            sample_tier = "fixed"

        if stats:
            target_per_low = per_value + lam * (stats["p25"] - per_value)
            target_per_mid = per_value + lam * (stats["p50"] - per_value)
            target_per_high = per_value + lam * (stats["p75"] - per_value)
        else:
            target_per_low = target_per_mid = target_per_high = per_value

        target_price_low = int(close_price * (target_per_low / per_value))
        target_price_mid = int(close_price * (target_per_mid / per_value))
        target_price_high = int(close_price * (target_per_high / per_value))

        # 지주회사 할인: 목표가 전 구간(보수/중립/낙관)에 동일하게 적용한다.
        # upside는 이 할인이 반영된 target_price_mid로부터 계산되므로,
        # 이 아래의 모든 계산(캡/라벨, timingMeta, finalPickMeta)에 자동으로
        # 전파된다.
        holding_discount_applied = bool(s.get("holdingDiscount"))
        if holding_discount_applied:
            discount_factor = 1 - HOLDING_DISCOUNT_RATE
            target_price_low = int(target_price_low * discount_factor)
            target_price_mid = int(target_price_mid * discount_factor)
            target_price_high = int(target_price_high * discount_factor)

        upside_raw = (target_price_mid - close_price) / close_price * 100

        metrics["targetPriceConservative"] = target_price_low
        metrics["targetPrice"] = target_price_mid
        metrics["targetPriceOptimistic"] = target_price_high
        metrics["upside"] = round(upside_raw, 1)

        display_label = None
        display_reason = None
        upside_capped = round(upside_raw, 1)
        if upside_raw > UPSIDE_CAP_HIGH:
            upside_capped = UPSIDE_CAP_HIGH
            display_label = "구조적 저평가 구간"
            display_reason = "지주사할인" if holding_discount_applied else "실적변동성"
        elif upside_raw < UPSIDE_CAP_LOW:
            upside_capped = UPSIDE_CAP_LOW
            display_label = "구조적 고평가 구간"
            display_reason = "지주사할인" if holding_discount_applied else "실적변동성"

        s["display"] = {
            "upsideLabel": display_label,
            "upsideLabelReason": display_reason,
            "upsideCapped": upside_capped,
        }
        s["fairValueMeta"] = {
            "sectorCode": sector_code,
            "sectorSampleTier": sample_tier,
            "sectorSampleSize": stats["n"] if stats else 0,
            "regressionLambda": lam,
            "sectorMedianPerUsed": stats["p50"] if stats else None,
        }

        # timingMeta는 build_stock_item()에서 upside=None인 채로 이미 한 번
        # 계산됐다 — 방금 채운 실제 upside로 다시 계산해야 한다.
        s["timingMeta"] = build_timing_meta(s)
    # === FAIR VALUE V2: 목표가 밴드 끝 (등급 백분위는 finalPickMeta 계산 뒤에) ===

    stocks = attach_investment_meta(stocks)

    # === RISK GRADE FIX: 등급을 절대 기준선이 아니라 전체 종목 분포의 백분위로 재배정 ===
    # riskScore가 낮을수록 안전, 높을수록 위험하다는 전제로 오름차순 정렬한 뒤
    # 하위 RISK_LOW_PCT% -> "낮음", 그다음 RISK_MEDIUM_PCT%까지 -> "보통", 나머지 -> "주의"
    sorted_by_risk = sorted(
        stocks, key=lambda s: s.get("riskMeta", {}).get("riskScore", 0)
    )
    n = len(sorted_by_risk)
    for idx, s in enumerate(sorted_by_risk):
        percentile_rank = idx / max(n - 1, 1)
        if percentile_rank < RISK_LOW_PCT:
            level = "낮음"
        elif percentile_rank < RISK_MEDIUM_PCT:
            level = "보통"
        else:
            level = "주의"
        s["riskMeta"]["level"] = level
    # === RISK GRADE FIX 끝 ===

    # === UNIFIED GRADE V2: 백분위 기반 등급 ===
    # S: finalScore 상위 7% / A: 상위 25% / B: 상위 65% / C: 나머지
    # (전부 decision=="INCLUDED" 종목 안에서의 백분위). decision=="EXCLUDED"는
    # 항상 D. 고위험(주의/높음) 종목은 기존 로직대로 한 단계 강등한다.
    # 이 자리에서 계산해야 finalPickMeta.finalScore(방금 계산됨)와
    # riskMeta.level(방금 확정됨)을 둘 다 쓸 수 있다.
    grade_order = ["S", "A", "B", "C", "D"]
    included_by_score = sorted(
        [s for s in stocks if s.get("finalPickMeta", {}).get("decision") == "INCLUDED"],
        key=lambda s: s.get("finalPickMeta", {}).get("finalScore", 0),
        reverse=True,
    )
    n_included = len(included_by_score)
    for idx, s in enumerate(included_by_score):
        rank_pct = (idx + 1) / max(n_included, 1)
        if rank_pct <= GRADE_S_PCT:
            s["_gradeCodeRaw"] = "S"
        elif rank_pct <= GRADE_A_PCT:
            s["_gradeCodeRaw"] = "A"
        elif rank_pct <= GRADE_B_PCT:
            s["_gradeCodeRaw"] = "B"
        else:
            s["_gradeCodeRaw"] = "C"

    for s in stocks:
        if s.get("finalPickMeta", {}).get("decision") == "EXCLUDED":
            grade_code = "D"
        else:
            grade_code = s.pop("_gradeCodeRaw", "C")

        downgraded = False
        risk_level = s.get("riskMeta", {}).get("level")
        if risk_level in ("높음", "주의") and grade_code != "D":
            idx = grade_order.index(grade_code)
            grade_code = grade_order[min(idx + 1, len(grade_order) - 1)]
            downgraded = True

        s["unifiedGradeCode"] = grade_code
        s["unifiedGradeDowngraded"] = downgraded
    # === UNIFIED GRADE V2 끝 ===

    partial_count = sum(1 for s in stocks if s.get("fairValuePartial"))
    print(
        f"[STAGE] fair-value v2/등급 계산 후 최종={len(stocks)} "
        f"(fair-value v2 로직은 종목을 빼지 않는다 - 이 단계 앞뒤로 개수는 절대 안 바뀜) | "
        f"modelVersion=v2-partial={partial_count}건({partial_count / max(len(stocks),1) * 100:.1f}%)"
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
                "riskScore": stock["riskMeta"]["riskScore"],  # === RISK GRADE FIX: 참고용 점수 노출 ===
            }
        )

    top_rank_stocks = [
        s for s in stocks if s.get("rankMeta", {}).get("topRankEligible")
    ]
    top_picks = (top_rank_stocks or stocks)[:10]

    reports = [
        {
            "week": get_week_label(kst_now),
            "publishedAt": today,
            "title": "이번 주 랭킹 상위 + 산업/재무지표 기반 요약 브리핑",
            "summary": "OpenDART 사업보고서 데이터와 KRX 시세데이터/시가총액을 결합해 재무지표·안전성 지표를 함께 반영한 랭킹 브리핑입니다.",
            "topPickCodes": [item["code"] for item in top_picks],
            "highlights": [build_report_highlight(item) for item in top_picks[:5]],
            "marketNote": "각 종목 페이지에서 투자 근거와 리스크, 뉴스 신호, 시장 적합도, 최종 픽 판단 근거를 확인하세요.",
            "disclaimer": "본 자료는 투자 참고용 정보이며 투자 판단과 결과에 대한 책임은 이용자에게 있습니다.",
        }
    ]

    existing_history = load_json(history_path, [])
    history_entry = build_history_entry(stocks)

    history_without_today = [
        item for item in existing_history if item.get("snapshotDate") != today
    ]
    history = [history_entry] + history_without_today
    history = history[:104]

    save_json(history_path, history)
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
