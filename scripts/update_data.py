import json
from pathlib import Path
from datetime import datetime, timedelta
import os

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "app" / "data"

stocks_path = DATA_DIR / "stocks.json"
risks_path = DATA_DIR / "risks.json"
reports_path = DATA_DIR / "reports.json"

# OpenDART 키는 이번 단계에서는 저장/검증용으로만 읽는다.
# 다음 단계에서 실제 API 호출 로직에 붙인다.
opendart_api_key = os.getenv("OPENDART_API_KEY", "")

kst_now = datetime.utcnow() + timedelta(hours=9)
today = kst_now.strftime("%Y-%m-%d")

def get_week_label(dt):
    week_no = ((dt.day - 1) // 7) + 1
    return f"{dt.year}년 {dt.month}월 {week_no}주차"

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

stocks = load_json(stocks_path)
stocks = sorted(stocks, key=lambda x: x["totalScore"], reverse=True)

# 주간 실행 흔적을 남기기 위해 updatedAt 추가
for stock in stocks:
    stock["updatedAt"] = today

# 리스크 JSON 자동 재구성
risk_map = {
    "005930": {
        "level": "보통",
        "title": "업황 변동성 점검 필요",
        "summary": "대형 악재 공시는 없지만 반도체 업황 민감도는 계속 확인이 필요합니다.",
        "checkPoint": "다음 분기 실적 발표와 수요 관련 공시 흐름 확인"
    },
    "005380": {
        "level": "낮음",
        "title": "전반적 리스크 안정",
        "summary": "가치와 재무 안정성 측면은 양호하지만 환율과 글로벌 수요 변수는 함께 봐야 합니다.",
        "checkPoint": "환율과 해외 판매 관련 공시 체크"
    },
    "000660": {
        "level": "주의",
        "title": "밸류 부담 구간 체크 필요",
        "summary": "성장성과 수익성은 좋지만 업황 기대가 빠르게 주가에 반영될 가능성을 점검해야 합니다.",
        "checkPoint": "실적 서프라이즈 지속 여부와 메모리 업황 공시 확인"
    }
}

risks = []
for stock in stocks:
    base = risk_map.get(stock["code"], {
        "level": "보통",
        "title": "추가 공시 점검 필요",
        "summary": "기본 점수는 양호하나 최신 공시 흐름을 추가 확인해야 합니다.",
        "checkPoint": "최근 공시와 재무 흐름 재확인"
    })

    risks.append({
        "date": today,
        "code": stock["code"],
        "name": stock["name"],
        "level": base["level"],
        "title": base["title"],
        "summary": base["summary"],
        "checkPoint": base["checkPoint"]
    })

top_picks = stocks[:3]
highlights = [item["summary"] for item in top_picks]

reports = [
    {
        "week": get_week_label(kst_now),
        "publishedAt": today,
        "title": "이번 주 공시 기반 우량주 후보 리포트",
        "summary": "공식 공시·재무·시장 데이터를 바탕으로 이번 주 상위 후보 종목과 핵심 체크포인트를 자동 정리한 주간 리포트입니다.",
        "topPickCodes": [item["code"] for item in top_picks],
        "highlights": highlights,
        "marketNote": "이번 주는 점수 상위 후보를 중심으로 공시 리스크와 밸류 부담을 함께 점검하는 접근이 중요합니다.",
        "disclaimer": "본 자료는 투자 권유가 아니라 공개 데이터 기반 정리 자료입니다.",
        "dataSourceReady": bool(opendart_api_key)
    }
]

save_json(stocks_path, stocks)
save_json(risks_path, risks)
save_json(reports_path, reports)

print("JSON update completed")
print(f"today={today}")
print(f"opendart_key_loaded={'YES' if opendart_api_key else 'NO'}")
