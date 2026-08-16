// 메인 내비게이션 구조
// type: "group" -> 하위 items를 드롭다운으로 묶어서 보여줌 (예: 종목발굴 퍼널)
// type: "single" -> 독립된 단일 링크
// type: "muted"  -> 톤을 낮춘 보조 링크 (이용가이드 등)

export const NAV_ITEMS = [
  {
    id: "discovery",
    type: "group",
    label: "종목발굴",
    // 그룹 자체를 눌렀을 때 이동할 기본 경로 (퍼널의 시작점)
    defaultHref: "/ranking",
    items: [
      { href: "/ranking", label: "1. 랭킹", desc: "전체 종목을 점수로 정렬" },
      { href: "/risk", label: "2. 위험진단", desc: "위험도를 걸러내기" },
      { href: "/final-picks", label: "3. 실전투자", desc: "최종 선정 종목 확인" },
    ],
  },
  {
    id: "trust",
    type: "group",
    label: "성과·리포트",
    defaultHref: "/performance",
    items: [
      { href: "/performance", label: "성과/백테스트", desc: "전략의 과거 성과 검증" },
      { href: "/reports", label: "리포트", desc: "시장/종목 분석 리포트" },
    ],
  },
  { id: "demo-trade", type: "single", href: "/demo-trade", label: "모의투자" },
  { id: "alternative", type: "single", href: "/alternative", label: "ETF" },
  { id: "wishlist", type: "single", href: "/wishlist", label: "관심종목" },
  { id: "notice", type: "muted", href: "/notice", label: "이용가이드" },
];
