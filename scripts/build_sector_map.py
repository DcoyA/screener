"""
docs/fair-value-v2.md 4-1절 1단계: DART company.json의 induty_code(표준산업분류)를
종목별로 1회 수집해 app/data/sector_map.json에 캐싱한다.

- 대상 종목: app/data/stocks.json에 있는 종목 코드 전체(현재 파이프라인이
  실제로 쓰는 500종목 유니버스와 동일하게 맞춘다).
- 이미 sector_map.json에 induty_code가 있는 종목은 다시 호출하지 않는다
  (재실행 시 실패/누락분만 이어서 처리 — 쿼터 절약).
- 실패/누락 종목은 app/data/sector_map_failed.json에 별도로 남긴다.
- 호출 한도 초과(status=020)를 감지하면 즉시 중단하고 지금까지의 결과를
  저장한다 — 잠시 후 재실행하면 이어서 처리된다.

실행은 사용자가 직접 한다. .env 파일을 읽지 않고 os.getenv로만 값을 받는다.
    OPENDART_API_KEY=xxxx python scripts/build_sector_map.py
"""

import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "app" / "data"
STOCKS_PATH = DATA_DIR / "stocks.json"
SECTOR_MAP_PATH = DATA_DIR / "sector_map.json"
SECTOR_MAP_FAILED_PATH = DATA_DIR / "sector_map_failed.json"

OPENDART_API_KEY = os.getenv("OPENDART_API_KEY", "").strip()

HTTP_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_SLEEP_SEC = 3
# 종목 사이 호출 간격. 필요하면 실행할 때 환경변수로 조절.
#   SECTOR_MAP_INTERVAL_SEC=0.5 python scripts/build_sector_map.py
REQUEST_INTERVAL_SEC = float(os.getenv("SECTOR_MAP_INTERVAL_SEC", "0.3"))
CHECKPOINT_EVERY = 25

if not OPENDART_API_KEY:
    raise RuntimeError("OPENDART_API_KEY is missing")

# 한국표준산업분류(10차 개정, 2017) 대분류-중분류 대응표.
# 21개 대분류와 각 대분류가 포괄하는 중분류(2자리) 범위 — 공식 분류체계
# 값이며 이 저장소의 실측치가 아니다(docs/fair-value-v2.md 4-2절 참고).
KSIC_DIVISIONS = [
    ("A", "농업, 임업 및 어업", 1, 3),
    ("B", "광업", 5, 8),
    ("C", "제조업", 10, 34),
    ("D", "전기, 가스, 증기 및 공기조절 공급업", 35, 35),
    ("E", "수도, 하수 및 폐기물 처리, 원료 재생업", 36, 39),
    ("F", "건설업", 41, 42),
    ("G", "도매 및 소매업", 45, 47),
    ("H", "운수 및 창고업", 49, 52),
    ("I", "숙박 및 음식점업", 55, 56),
    ("J", "정보통신업", 58, 63),
    ("K", "금융 및 보험업", 64, 66),
    ("L", "부동산업", 68, 68),
    ("M", "전문, 과학 및 기술 서비스업", 70, 73),
    ("N", "사업시설 관리, 사업 지원 및 임대 서비스업", 74, 76),
    ("O", "공공행정, 국방 및 사회보장 행정", 84, 84),
    ("P", "교육 서비스업", 85, 85),
    ("Q", "보건업 및 사회복지 서비스업", 86, 87),
    ("R", "예술, 스포츠 및 여가관련 서비스업", 90, 91),
    ("S", "협회 및 단체, 수리 및 기타 개인 서비스업", 94, 96),
    ("T", "가구내 고용활동 및 자가소비 생산활동", 97, 98),
    ("U", "국제 및 외국기관", 99, 99),
]


class QuotaExceeded(Exception):
    pass


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


def http_get_json(base_url, params):
    query = urllib.parse.urlencode(params)
    url = f"{base_url}?{query}"
    with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_corp_code_xml():
    query = urllib.parse.urlencode({"crtfc_key": OPENDART_API_KEY})
    url = f"https://opendart.fss.or.kr/api/corpCode.xml?{query}"
    with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as resp:
        data = resp.read()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        xml_bytes = zf.read(zf.namelist()[0])
    return ET.fromstring(xml_bytes)


def build_corp_code_map():
    root = download_corp_code_xml()
    mapping = {}
    for item in root.findall("list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        corp_name = (item.findtext("corp_name") or "").strip()
        if stock_code:
            mapping[stock_code] = {"corp_code": corp_code, "corp_name": corp_name}
    return mapping


def load_target_codes():
    stocks = load_json(STOCKS_PATH, [])
    if not stocks:
        raise RuntimeError(
            f"{STOCKS_PATH} 이 비어있거나 없습니다. scripts/update_data.py를 먼저 실행해야 합니다."
        )
    codes = []
    seen = set()
    for s in stocks:
        code = str(s.get("code") or "").strip()
        if code and code not in seen:
            seen.add(code)
            codes.append(code)
    return codes


def ksic_division_for(induty_code):
    digits = "".join(ch for ch in str(induty_code or "") if ch.isdigit())
    if len(digits) < 2:
        return None, None
    mid_code = digits[:2]
    try:
        mid_num = int(mid_code)
    except ValueError:
        return None, mid_code
    for letter, name, lo, hi in KSIC_DIVISIONS:
        if lo <= mid_num <= hi:
            return {"code": letter, "name": name}, mid_code
    return None, mid_code


def fetch_company(corp_code):
    """성공 시 (data, None), 최종 실패 시 (None, 사유문자열)를 반환한다.
    호출 한도 초과(status=020)는 재시도해도 소용없으므로 QuotaExceeded를 던진다."""
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            data = http_get_json(
                "https://opendart.fss.or.kr/api/company.json",
                {"crtfc_key": OPENDART_API_KEY, "corp_code": corp_code},
            )
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = f"network_error: {exc}"
            print(f"    [retry {attempt}/{MAX_RETRIES}] {last_error}")
            time.sleep(RETRY_SLEEP_SEC * attempt)
            continue

        status = data.get("status")
        if status == "000":
            return data, None
        if status == "013":
            # 조회된 데이터 없음 - 재시도해도 결과가 바뀌지 않는다.
            return None, f"no_data(status=013, message={data.get('message')})"
        if status == "020":
            raise QuotaExceeded(data.get("message") or "요청 제한 초과(status=020)")

        last_error = f"status={status}, message={data.get('message')}"
        print(f"    [retry {attempt}/{MAX_RETRIES}] {last_error}")
        time.sleep(RETRY_SLEEP_SEC * attempt)

    return None, last_error or "unknown_error"


def build_output(items):
    return {
        "generatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "DART company.json (induty_code)",
        "count": len(items),
        "items": items,
    }


def main():
    print(f"OPENDART_API_KEY 확인됨 (length={len(OPENDART_API_KEY)})")

    codes = load_target_codes()
    print(f"대상 종목 수: {len(codes)}  (source: {STOCKS_PATH})")

    print("corpCode.xml 다운로드 중...")
    corp_map = build_corp_code_map()
    print(f"corp_code_map 크기: {len(corp_map)}")

    existing = load_json(SECTOR_MAP_PATH, {})
    items = dict(existing.get("items", {})) if isinstance(existing, dict) else {}
    failed = load_json(SECTOR_MAP_FAILED_PATH, [])
    if not isinstance(failed, list):
        failed = []
    # 이번 실행에서 다시 실패하면 새 사유로 덮어써야 하므로, 실패 목록은
    # 이번 실행 결과로 새로 만든다(이전 실행의 실패 사유를 그대로 들고
    # 있으면 재시도 결과와 안 맞을 수 있음). 단, 이번에 아예 건드리지
    # 않는(=이미 성공한) 종목의 과거 실패 기록은 없을 테니 문제 없음.
    failed_codes_prev = {f.get("code") for f in failed if isinstance(f, dict)}
    failed = []

    total = len(codes)
    skipped = 0
    processed = 0

    def checkpoint():
        save_json(SECTOR_MAP_PATH, build_output(items))
        save_json(SECTOR_MAP_FAILED_PATH, failed)

    try:
        for idx, code in enumerate(codes, start=1):
            if code in items and items[code].get("induty_code"):
                skipped += 1
                continue

            corp_info = corp_map.get(code)
            if not corp_info or not corp_info.get("corp_code"):
                print(f"[{idx}/{total}] {code} - corp_code 매핑 없음 (corpCode.xml에 없음)")
                failed.append({"code": code, "reason": "corp_code_not_found"})
                continue

            corp_code = corp_info["corp_code"]
            corp_name = corp_info["corp_name"]

            try:
                data, error = fetch_company(corp_code)
            except QuotaExceeded as exc:
                print(f"\n!! DART 호출 한도 초과로 중단합니다: {exc}")
                print(
                    f"   지금까지 신규 처리 {processed}건(누적 성공 {len(items)}건)은 저장했습니다. "
                    "한도가 풀린 뒤 다시 실행하면 남은 항목부터 이어서 처리합니다."
                )
                checkpoint()
                sys.exit(1)

            if error:
                print(f"[{idx}/{total}] {code} {corp_name} - 실패: {error}")
                failed.append(
                    {"code": code, "corp_name": corp_name, "corp_code": corp_code, "reason": error}
                )
                time.sleep(REQUEST_INTERVAL_SEC)
                continue

            induty_code = str(data.get("induty_code") or "").strip()
            if not induty_code:
                print(f"[{idx}/{total}] {code} {corp_name} - induty_code 비어있음")
                failed.append(
                    {
                        "code": code,
                        "corp_name": corp_name,
                        "corp_code": corp_code,
                        "reason": "induty_code_empty",
                    }
                )
                time.sleep(REQUEST_INTERVAL_SEC)
                continue

            daebunryu, jungbunryu = ksic_division_for(induty_code)
            items[code] = {
                "code": code,
                "corp_name": corp_name or str(data.get("corp_name") or ""),
                "induty_code": induty_code,
                "ksic_대분류": daebunryu,
                "ksic_중분류": jungbunryu,
                "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            processed += 1
            daebunryu_label = daebunryu["code"] if daebunryu else "?"
            print(
                f"[{idx}/{total}] {code} {corp_name} - OK "
                f"induty_code={induty_code} 대분류={daebunryu_label} 중분류={jungbunryu}"
            )

            if processed % CHECKPOINT_EVERY == 0:
                checkpoint()
                print(f"    (체크포인트 저장: 누적 성공 {len(items)}건)")

            time.sleep(REQUEST_INTERVAL_SEC)
    except KeyboardInterrupt:
        print("\n!! 사용자가 중단했습니다(Ctrl+C). 지금까지 결과를 저장합니다.")
    finally:
        checkpoint()

    print("----")
    print(
        f"완료: 대상 {total}개 / 누적 성공 {len(items)}개 "
        f"(이번 실행 신규 {processed}개, 기존값 재사용 스킵 {skipped}개) / 실패 {len(failed)}개"
    )
    if failed_codes_prev:
        recovered = failed_codes_prev - {f["code"] for f in failed}
        still_failing = failed_codes_prev & {f["code"] for f in failed}
        if recovered:
            print(f"  - 이전 실행 실패분 중 이번에 복구됨: {len(recovered)}개")
        if still_failing:
            print(f"  - 이전 실행에 이어 계속 실패 중: {len(still_failing)}개")
    print(f"저장: {SECTOR_MAP_PATH}")
    print(f"실패 목록: {SECTOR_MAP_FAILED_PATH}")


if __name__ == "__main__":
    main()
