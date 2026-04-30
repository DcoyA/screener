export const sampleStocks = [
  {
    code: "005930",
    name: "삼성전자",
    market: "KOSPI",
    totalScore: 92,
    valueScore: 34,
    qualityScore: 23,
    safetyScore: 18,
    changeScore: 17,
    risk: "리스크 없음",
    summary: "저평가·수익성·안정성이 모두 우수한 상위권 후보입니다."
  },
  {
    code: "000660",
    name: "SK하이닉스",
    market: "KOSPI",
    totalScore: 84,
    valueScore: 26,
    qualityScore: 24,
    safetyScore: 16,
    changeScore: 18,
    risk: "리스크 없음",
    summary: "성장성과 수익성이 강하지만 밸류 부담은 함께 확인할 필요가 있습니다."
  },
  {
    code: "005380",
    name: "현대차",
    market: "KOSPI",
    totalScore: 88,
    valueScore: 35,
    qualityScore: 21,
    safetyScore: 18,
    changeScore: 14,
    risk: "리스크 없음",
    summary: "가치와 안정성 측면이 강한 편이며 추가 공시 점검 가치가 있습니다."
  },
  {
    code: "214150",
    name: "클래시스",
    market: "KOSDAQ",
    totalScore: 76,
    valueScore: 20,
    qualityScore: 24,
    safetyScore: 15,
    changeScore: 17,
    risk: "리스크 없음",
    summary: "고수익성과 성장성을 유지하는 종목으로 추적 가치가 있습니다."
  },
  {
    code: "263750",
    name: "펄어비스",
    market: "KOSDAQ",
    totalScore: 54,
    valueScore: 18,
    qualityScore: 12,
    safetyScore: 10,
    changeScore: 14,
    risk: "변동성 확인 필요",
    summary: "일부 지표는 무난하지만 선별적 해석이 필요한 종목입니다."
  }
];

export const sampleRisks = [
  {
    code: "263750",
    name: "펄어비스",
    date: "2026-04-28",
    type: "변동성 점검",
    severity: "중",
    summary: "실적 기대와 실제 수치 간 괴리 가능성을 점검할 필요가 있습니다."
  },
  {
    code: "214150",
    name: "클래시스",
    date: "2026-04-25",
    type: "공시 체크",
    severity: "하",
    summary: "최근 공시 흐름은 안정적이나 분기 업데이트 확인이 필요합니다."
  }
];

export const sampleReports = [
  {
    id: "2026-w18",
    title: "2026년 4월 마지막 주 저평가 후보 요약",
    summary: "가치·품질·안정성 기준 상위 종목과 위험 공시를 함께 정리한 주간 요약입니다."
  }
];
