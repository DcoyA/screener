"""데이터 품질 게이트 (2단계: WARN / BLOCK).

update_data.py 직후, Supabase 적재(ingest-daily-snapshot.mjs) 직전에 실행한다.

- WARN: 슬랙 알림만 보내고 적재는 계속 진행한다 (exit 0)
- BLOCK: 슬랙 알림 + exit 1로 적재를 막는다
BLOCK은 "이 수치가 나왔다는 건 코드나 외부 API가 깨졌다는 뜻"인 경우에만 쓴다.
그 외 이상 신호는 전부 WARN이다.

절대 임계값(QUALITY_THRESHOLDS) 검사는 Supabase 베이스라인 유무와 무관하게
항상 BLOCK까지 갈 수 있다. 베이스라인이 없을 때 스킵되는 건 "직전 실행 대비
변화량(델타)" 검사뿐이다 — 애초에 비교할 직전 값이 없으니 델타 자체를 계산할
수 없기 때문이다.

필드 매핑(app/data/stocks.json, JS 셰이프 기준):
  fairValue    -> metrics.targetPrice
  currentPrice -> metrics.closePrice
(Supabase latest_stock_snapshots 테이블 컬럼명과는 다르다 - 이 스크립트는
Supabase 적재 이전 단계라 로컬 stocks.json만 본다.)

Supabase 베이스라인/로그 기능은 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY가
설정돼 있고 pipeline_quality_log 테이블이 존재할 때만 동작한다
(docs/migrations/pipeline-quality-log.sql, 실행은 사용자가 직접 함).
둘 중 하나라도 없으면 델타 검사만 건너뛰고 절대 임계값 검사는 그대로 수행한다
- 이 기능이 파이프라인을 새로 막는 일은 없다.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
# 검증 스크립트가 실 API 호출 없이 픽스처 파일로 테스트할 수 있도록 오버라이드 허용.
STOCKS_PATH = Path(os.environ.get("STOCKS_JSON_PATH") or (ROOT / "app" / "data" / "stocks.json"))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 절대 임계값. 운영 중 조정할 값이라 여기 한 군데에 모아두고, 각각
# QUALITY_THRESHOLD_<KEY>_<WARN|BLOCK> 환경변수로 덮어쓸 수 있게 한다.
# (s_grade_ratio만 범위형이라 _LOW/_HIGH 접미사가 따로 붙는다.)
QUALITY_THRESHOLDS = {
    "stock_count_ratio": {"warn": 0.85, "block": 0.50},
    "fair_value_null_ratio": {"warn": 0.25, "block": 0.45},
    "per_outlier_ratio": {"warn": 0.09, "block": 0.15},
    "s_grade_ratio": {"warn": (0.04, 0.14), "block": (0.02, 0.20)},
    "zero_price_count": {"warn": 1, "block": 5},
    "sector_unmapped_ratio": {"warn": 0.22, "block": 0.30},
}
PER_OUTLIER_PER_VALUE = 200

# 직전 성공 실행 대비 변화량(퍼센트포인트) 임계값. 넘으면 WARN.
# 셋 중 2개 이상이 동시에 넘으면 전체 판정을 BLOCK으로 올린다.
QUALITY_DELTA_THRESHOLDS = {
    "per_outlier_ratio": 0.03,
    "sector_unmapped_ratio": 0.05,
    "fair_value_null_ratio": 0.10,
}
DELTA_BLOCK_ESCALATION_COUNT = 2

TIER_RANK = {"pass": 0, "warn": 1, "block": 2}


def _env_float(name, default):
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        print(f"[품질게이트] {name} 값 파싱 실패({raw!r}) - 기본값 {default} 사용")
        return default


def _threshold(key, tier):
    default = QUALITY_THRESHOLDS[key][tier]
    return _env_float(f"QUALITY_THRESHOLD_{key.upper()}_{tier.upper()}", default)


def _range_threshold(key, tier):
    lo_default, hi_default = QUALITY_THRESHOLDS[key][tier]
    lo = _env_float(f"QUALITY_THRESHOLD_{key.upper()}_{tier.upper()}_LOW", lo_default)
    hi = _env_float(f"QUALITY_THRESHOLD_{key.upper()}_{tier.upper()}_HIGH", hi_default)
    return lo, hi


def _delta_threshold(key):
    default = QUALITY_DELTA_THRESHOLDS[key]
    return _env_float(f"QUALITY_DELTA_THRESHOLD_{key.upper()}", default)


class MetricResult:
    def __init__(self, key, label, value, actual_display, threshold_display, tier):
        self.key = key
        self.label = label
        self.value = value  # Supabase 로깅/델타 비교용 원값 (None이면 로깅 스킵)
        self.actual_display = actual_display
        self.threshold_display = threshold_display
        self.tier = tier


def tier_for_max(value, warn_thr, block_thr):
    if value > block_thr:
        return "block"
    if value > warn_thr:
        return "warn"
    return "pass"


def tier_for_min(value, warn_thr, block_thr):
    if value < block_thr:
        return "block"
    if value < warn_thr:
        return "warn"
    return "pass"


def tier_for_min_count(value, warn_thr, block_thr):
    if value >= block_thr:
        return "block"
    if value >= warn_thr:
        return "warn"
    return "pass"


def tier_for_range(value, warn_lo, warn_hi, block_lo, block_hi):
    if value < block_lo or value > block_hi:
        return "block"
    if value < warn_lo or value > warn_hi:
        return "warn"
    return "pass"


def load_stocks(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_previous_stocks():
    """git의 직전 커밋(HEAD)에 있는 stocks.json을 읽는다.

    update_data.py가 로컬 파일을 이미 새 내용으로 덮어쓴 뒤, 커밋되기 전에
    이 스크립트가 실행되므로 HEAD는 아직 "어제" 버전을 가리킨다. Supabase는
    이 단계에서 아직 건드리지 않으므로 자격증명이 전혀 필요 없다.
    """
    if os.environ.get("STOCKS_JSON_PATH"):
        print("[품질게이트] STOCKS_JSON_PATH 오버라이드(픽스처 테스트) - git 기반 종목 수 비교 스킵")
        return None
    try:
        result = subprocess.run(
            ["git", "show", "HEAD:app/data/stocks.json"],
            cwd=ROOT,
            capture_output=True,
            encoding="utf-8",
            check=True,
        )
        return json.loads(result.stdout)
    except Exception as e:
        print(f"[품질게이트] 직전 stocks.json을 읽지 못함(최초 실행이거나 히스토리 없음): {e}")
        return None


def check_stock_count(stocks, prev_stocks):
    if not prev_stocks:
        print("[품질게이트] 직전(git) 데이터 없음 - 종목 수 비교 스킵")
        return None
    ratio = len(stocks) / len(prev_stocks) if prev_stocks else 0
    warn_thr = _threshold("stock_count_ratio", "warn")
    block_thr = _threshold("stock_count_ratio", "block")
    tier = tier_for_min(ratio, warn_thr, block_thr)
    print(f"[품질게이트] 종목 수: {len(stocks)}건 (직전 {len(prev_stocks)}건, 비율 {ratio * 100:.1f}%) -> {tier}")
    return MetricResult(
        "stock_count_ratio", "종목 수(직전 대비 비율)", ratio,
        f"{ratio * 100:.1f}% ({len(stocks)}/{len(prev_stocks)})",
        f"WARN<{warn_thr * 100:.0f}% / BLOCK<{block_thr * 100:.0f}%",
        tier,
    )


def check_fair_value_null(stocks):
    total = len(stocks)
    null_count = sum(1 for s in stocks if s.get("metrics", {}).get("targetPrice") is None)
    ratio = null_count / total if total else 0
    warn_thr = _threshold("fair_value_null_ratio", "warn")
    block_thr = _threshold("fair_value_null_ratio", "block")
    tier = tier_for_max(ratio, warn_thr, block_thr)
    print(f"[품질게이트] fairValue(targetPrice) 결측: {null_count}/{total}건 ({ratio * 100:.1f}%) -> {tier}")
    return MetricResult(
        "fair_value_null_ratio", "fairValue 결측 비율", ratio,
        f"{ratio * 100:.1f}% ({null_count}/{total})",
        f"WARN>{warn_thr * 100:.0f}% / BLOCK>{block_thr * 100:.0f}%",
        tier,
    )


def check_per_outliers(stocks):
    total = len(stocks)
    outlier_count = sum(
        1 for s in stocks
        if (s.get("metrics", {}).get("per") or 0) > PER_OUTLIER_PER_VALUE
    )
    ratio = outlier_count / total if total else 0
    warn_thr = _threshold("per_outlier_ratio", "warn")
    block_thr = _threshold("per_outlier_ratio", "block")
    tier = tier_for_max(ratio, warn_thr, block_thr)
    print(f"[품질게이트] PER>{PER_OUTLIER_PER_VALUE} 이상치: {outlier_count}/{total}건 ({ratio * 100:.1f}%) -> {tier}")
    return MetricResult(
        "per_outlier_ratio", "PER 이상치 비율", ratio,
        f"{ratio * 100:.1f}% ({outlier_count}/{total})",
        f"WARN>{warn_thr * 100:.0f}% / BLOCK>{block_thr * 100:.0f}%",
        tier,
    )


def check_s_grade_ratio(stocks):
    total = len(stocks)
    s_count = sum(1 for s in stocks if s.get("unifiedGradeCode") == "S")
    ratio = s_count / total if total else 0
    warn_lo, warn_hi = _range_threshold("s_grade_ratio", "warn")
    block_lo, block_hi = _range_threshold("s_grade_ratio", "block")
    tier = tier_for_range(ratio, warn_lo, warn_hi, block_lo, block_hi)
    print(f"[품질게이트] S등급 비율: {s_count}/{total}건 ({ratio * 100:.1f}%) -> {tier}")
    return MetricResult(
        "s_grade_ratio", "S등급 비율", ratio,
        f"{ratio * 100:.1f}% ({s_count}/{total})",
        f"WARN {warn_lo * 100:.0f}~{warn_hi * 100:.0f}% / BLOCK {block_lo * 100:.0f}~{block_hi * 100:.0f}%",
        tier,
    )


def check_zero_close_price(stocks):
    zero_count = sum(
        1 for s in stocks
        if not (s.get("metrics", {}).get("closePrice") or 0) > 0
    )
    warn_thr = _threshold("zero_price_count", "warn")
    block_thr = _threshold("zero_price_count", "block")
    tier = tier_for_min_count(zero_count, warn_thr, block_thr)
    print(f"[품질게이트] currentPrice(closePrice) 0/결측: {zero_count}건 -> {tier}")
    return MetricResult(
        "zero_price_count", "currentPrice 0/결측 건수", zero_count,
        f"{zero_count}건",
        f"WARN>={warn_thr:.0f}건 / BLOCK>={block_thr:.0f}건",
        tier,
    )


def check_sector_unmapped(stocks):
    total = len(stocks)
    unmapped = sum(1 for s in stocks if not s.get("sectorCode"))
    ratio = unmapped / total if total else 0
    warn_thr = _threshold("sector_unmapped_ratio", "warn")
    block_thr = _threshold("sector_unmapped_ratio", "block")
    tier = tier_for_max(ratio, warn_thr, block_thr)
    print(f"[품질게이트] 섹터 미매핑: {unmapped}/{total}건 ({ratio * 100:.1f}%) -> {tier}")
    return MetricResult(
        "sector_unmapped_ratio", "섹터 미매핑 비율", ratio,
        f"{ratio * 100:.1f}% ({unmapped}/{total})",
        f"WARN>{warn_thr * 100:.0f}% / BLOCK>{block_thr * 100:.0f}%",
        tier,
    )


def check_uniform_close_price(stocks):
    prices = {
        s.get("metrics", {}).get("closePrice")
        for s in stocks
        if s.get("metrics", {}).get("closePrice")
    }
    is_uniform = len(stocks) > 1 and len(prices) <= 1
    tier = "block" if is_uniform else "pass"
    print(f"[품질게이트] 서로 다른 currentPrice 값 개수: {len(prices)} -> {tier}")
    return MetricResult(
        "uniform_close_price", "전 종목 동일 currentPrice", len(prices),
        f"고유값 {len(prices)}개 (종목 {len(stocks)}건)",
        "2개 이상 (미만이면 즉시 BLOCK - API 응답 고장 의심)",
        tier,
    )


# ---- Supabase 베이스라인/로깅 (선택 기능 - 실패해도 게이트 자체는 안 죽는다) ----

def supabase_request(method, path, params=None, body=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if method == "POST":
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def kst_today_str():
    return (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d")


def fetch_baseline():
    """가장 최근의 '직전 성공 실행'(BLOCK 지표가 하나도 없었던 run_date)의
    지표값 맵을 반환한다. Supabase 미설정/테이블 없음/베이스라인 없음이면
    None을 반환하고, 델타 검사는 스킵된다(절대 검사는 그대로 진행됨)."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[품질게이트] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 미설정 - 델타 검사 스킵")
        return None
    try:
        rows = supabase_request(
            "GET", "pipeline_quality_log",
            params={"select": "run_date,metric_name,metric_value,verdict", "order": "run_date.desc", "limit": "500"},
        )
    except Exception as e:
        print(f"[품질게이트] pipeline_quality_log 조회 실패(마이그레이션 미실행일 수 있음) - 델타 검사 스킵: {e}")
        return None
    if not rows:
        print("[품질게이트] pipeline_quality_log에 과거 기록 없음(최초 실행) - 델타 검사 스킵")
        return None

    by_date = defaultdict(list)
    for r in rows:
        by_date[r["run_date"]].append(r)

    for run_date in sorted(by_date.keys(), reverse=True):
        entries = by_date[run_date]
        if any(e["verdict"] == "block" for e in entries):
            continue
        return {"run_date": run_date, "metrics": {e["metric_name"]: e["metric_value"] for e in entries}}

    print("[품질게이트] BLOCK 없는 직전 성공 실행을 찾지 못함 - 델타 검사 스킵")
    return None


def log_results(results):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    today = kst_today_str()
    payload = [
        {"run_date": today, "metric_name": r.key, "metric_value": r.value, "verdict": r.tier}
        for r in results
        if r.value is not None
    ]
    if not payload:
        return
    try:
        supabase_request("POST", "pipeline_quality_log", body=payload)
        print(f"[품질게이트] pipeline_quality_log에 {len(payload)}개 지표 기록 완료 ({today})")
    except Exception as e:
        print(f"[품질게이트] pipeline_quality_log 기록 실패(마이그레이션 미실행일 수 있음, 무시하고 진행): {e}")


def compute_delta_results(results, baseline):
    """직전 성공 실행 대비 변화량 검사. baseline이 없으면 빈 리스트."""
    if not baseline:
        return []
    by_key = {r.key: r for r in results}
    delta_results = []
    for key in QUALITY_DELTA_THRESHOLDS:
        current = by_key.get(key)
        prev_value = baseline["metrics"].get(key)
        if current is None or current.value is None or prev_value is None:
            continue
        prev_value = float(prev_value)
        delta = current.value - prev_value
        pp_thr = _delta_threshold(key)
        tier = "warn" if delta > pp_thr else "pass"
        print(
            f"[품질게이트] {current.label} 델타: {delta * 100:+.1f}%p "
            f"(직전 {prev_value * 100:.1f}% -> 현재 {current.value * 100:.1f}%) -> {tier}"
        )
        delta_results.append(MetricResult(
            f"{key}__delta", f"{current.label} (직전 대비 변화)", delta,
            f"{delta * 100:+.1f}%p (직전 {prev_value * 100:.1f}% -> 현재 {current.value * 100:.1f}%)",
            f"WARN>+{pp_thr * 100:.0f}%p",
            tier,
        ))
    return delta_results


def build_actions_link():
    repo = os.environ.get("GITHUB_REPOSITORY")
    run_id = os.environ.get("GITHUB_RUN_ID")
    if not repo or not run_id:
        return "(로컬 실행 - Actions 링크 없음)"
    return f"https://github.com/{repo}/actions/runs/{run_id}"


def send_slack_alert(overall_tier, violations, passed, escalation_note):
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("SLACK_WEBHOOK_URL 미설정 - 슬랙 전송을 생략합니다")
        return

    if overall_tier == "block":
        title = "🔴 [BLOCK] 파이프라인 품질 실패 — 적재 중단됨"
    else:
        title = "🟡 [WARN] 파이프라인 품질 경고 — 적재는 진행됨"

    violation_lines = "\n".join(
        f"• *[{r.tier.upper()}] {r.label}* - 실측: {r.actual_display} / 기준: {r.threshold_display}"
        for r in violations
    )
    passed_line = "통과: " + ", ".join(f"{r.label} {r.actual_display}" for r in passed) if passed else "통과: (없음)"

    text_parts = [title, violation_lines]
    if escalation_note:
        text_parts.append(escalation_note)
    text_parts.append(passed_line)
    text_parts.append(build_actions_link())
    text = "\n".join(part for part in text_parts if part)

    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[품질게이트] 슬랙 전송 완료(HTTP {resp.status})")
    except urllib.error.URLError as e:
        print(f"[품질게이트] 슬랙 전송 실패: {e}")


def main():
    stocks = load_stocks(STOCKS_PATH)
    prev_stocks = load_previous_stocks()

    results = []
    for r in [
        check_stock_count(stocks, prev_stocks),
        check_fair_value_null(stocks),
        check_per_outliers(stocks),
        check_s_grade_ratio(stocks),
        check_zero_close_price(stocks),
        check_sector_unmapped(stocks),
        check_uniform_close_price(stocks),
    ]:
        if r is not None:
            results.append(r)

    baseline = fetch_baseline()
    delta_results = compute_delta_results(results, baseline)

    escalation_note = None
    warned_delta_keys = [r for r in delta_results if r.tier == "warn"]
    if len(warned_delta_keys) >= DELTA_BLOCK_ESCALATION_COUNT:
        escalation_note = (
            f"⚠️ 직전 대비 악화된 지표가 {len(warned_delta_keys)}개 동시 발생"
            f"({', '.join(r.label for r in warned_delta_keys)}) - 개별 지표는 WARN이지만 "
            f"복합 악화로 전체 판정을 BLOCK으로 상향합니다."
        )

    all_results = results + delta_results
    overall_tier = "pass"
    for r in all_results:
        if TIER_RANK[r.tier] > TIER_RANK[overall_tier]:
            overall_tier = r.tier
    if escalation_note:
        overall_tier = "block"

    log_results(results)

    violations = [r for r in all_results if r.tier != "pass"]
    passed = [r for r in all_results if r.tier == "pass"]

    print(f"\n[품질게이트] 전체 판정: {overall_tier.upper()}")
    if violations:
        for r in violations:
            print(f"  - [{r.tier.upper()}] {r.label}: 실측 {r.actual_display} / 기준 {r.threshold_display}")
    if escalation_note:
        print(f"  {escalation_note}")

    if overall_tier != "pass":
        send_slack_alert(overall_tier, violations, passed, escalation_note)

    if overall_tier == "block":
        sys.exit(1)

    print("[품질게이트] 적재 계속 진행")


if __name__ == "__main__":
    main()
