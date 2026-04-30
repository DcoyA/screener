import io
import json
import os
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

API_KEY = os.getenv("OPENDART_API_KEY", "").strip()

TARGET_STOCKS = {
    "005930": {"name": "삼성전자", "market": "KOSPI"},
    "005380": {"name": "현대차", "market": "KOSPI"},
    "000660": {"name": "SK하이닉스", "market": "KOSPI"},
}

kst_now = datetime.utcnow() + timedelta(hours=9)
today = kst_now.strftime("%Y-%m-%d")
target_year = str(kst_now.year - 1)  # 예: 2026-04 기준 2025 사업보고서 사용
report_code = "11011"  # 사업보고서

if not API_KEY:
    raise RuntimeError("OPENDART_API_KEY is missing")

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def http_get_json(base_url, params):
    query = urllib.parse.urlencode(params)
    url = f"{base_url}?{query}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))

def download_corp_code_xml():
    query = urllib.parse.urlencode({"crtfc_key": API_KEY})
    url = f"https://opendart.fss.or.kr/api/corpCode.xml?{query}"
    with urllib.request.urlopen(url) as resp:
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

def fetch_major_accounts(corp_code, year):
    data = http_get_json(
        "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json",
        {
            "crtfc_key": API_KEY,
            "corp_code": corp_code,
            "bsns_year": year,
            "reprt_code": report_code
        }
    )

    if data.get("status") == "000":
        return data.get("list", []), year

    # 올해-1 사업보고서가 아직 없을 수도 있으므로 1년 전 fallback
    fallback_year = str(int(year) - 1)
    data2 = http_get_json(
        "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json",
        {
            "crtfc_key": API_KEY,
            "corp_code": corp_code,
            "bsns_year": fallback_year,
            "reprt_code": report_code
        }
    )

    if data2.get("status") == "000":
        return data2.get("list", []), fallback_year

    raise RuntimeError(
        f"Failed to fetch financials for corp_code={corp_code}, "
        f"status={data.get('status')} / fallback={data2.get('status')}"
    )

def build_stock_item(stock_code, meta, corp_map):
    corp_info = corp_map.get(stock_code)
    if not corp_info:
        raise RuntimeError(f"corp_code not found for stock_code={stock_code}")

    rows, used_year = fetch_major_accounts(corp_info["corp_code"], target_year)

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

    op_margin = (op_income / revenue * 100) if revenue else 0.0
    debt_ratio = (liabilities / equity * 100) if equity else 999.0
    revenue_growth = pct(revenue, revenue_prev) if revenue_prev else 0.0
    op_growth = pct(op_income, op_income_prev) if op_income_prev else 0.0
    net_growth = pct(net_income, net_income_prev) if net_income_prev else 0.0

    # NOTE:
    # 이번 단계는 OpenDART만 붙이므로, valueScore는 진짜 PER/PBR 기반이 아니라
    # "재무 기반 후보 점수" 성격의 임시 점수다.
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
        safety_score += 15
    elif debt_ratio < 100:
        safety_score += 12
    elif debt_ratio < 150:
        safety_score += 9
    elif debt_ratio < 200:
        safety_score += 6
    else:
        safety_score += 2
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
    elif op_margin < 5:
        risk_text = f"영업이익률이 {op_margin:.1f}% 수준이라 수익성 방어력을 추가 확인할 필요가 있습니다."
        risk_level = "보통"
        risk_title = "수익성 방어력 점검 필요"
        check_point = "영업이익률과 비용 구조 관련 공시 흐름 확인"
    else:
        risk_text = f"사업보고서 기준 재무 구조는 비교적 안정적이지만 업황 변수는 함께 확인해야 합니다."
        risk_level = "낮음"
        risk_title = "전반적 재무 안정"
        check_point = "업황 및 다음 분기 실적 흐름 확인"

    summary = (
        f"{used_year} 사업보고서 기준 매출 {fmt_krw(revenue)}, "
        f"영업이익 {fmt_krw(op_income)}, 부채비율 {debt_ratio:.1f}%입니다."
    )

    description = (
        f"{used_year} 사업보고서 주요계정 기준으로 보면 "
        f"매출은 전년 대비 {revenue_growth:.1f}%, "
        f"영업이익은 전년 대비 {op_growth:.1f}% 변동했습니다. "
        f"자본총계는 {fmt_krw(equity)}이며, "
        f"현재 점수는 OpenDART 재무 데이터만 반영한 1차 후보 점수입니다."
    )

    return {
        "code": stock_code,
        "name": meta["name"],
        "market": meta["market"],
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

    stocks = []
    for stock_code, meta in TARGET_STOCKS.items():
        item = build_stock_item(stock_code, meta, corp_map)
        stocks.append(item)

    stocks = sorted(stocks, key=lambda x: x["totalScore"], reverse=True)

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

    top_picks = stocks[:3]
    reports = [
        {
            "week": get_week_label(kst_now),
            "publishedAt": today,
            "title": "이번 주 공시 기반 우량주 후보 리포트",
            "summary": "OpenDART 사업보고서 주요계정을 바탕으로 자동 생성한 주간 리포트입니다.",
            "topPickCodes": [item["code"] for item in top_picks],
            "highlights": [item["summary"] for item in top_picks],
            "marketNote": "이번 단계는 OpenDART 재무 데이터만 반영한 상태이며, 다음 단계에서 KRX 시장 데이터(PER/PBR 등)를 붙여 가치 해석을 강화합니다.",
            "disclaimer": "본 자료는 투자 권유가 아니라 공개 데이터 기반 정리 자료입니다."
        }
    ]

    save_json(stocks_path, stocks)
    save_json(risks_path, risks)
    save_json(reports_path, reports)

    print("REAL DART update completed")
    print(f"today={today}")
    print(f"target_year={target_year}")
    print(f"generated_stocks={len(stocks)}")

if __name__ == "__main__":
    main()
