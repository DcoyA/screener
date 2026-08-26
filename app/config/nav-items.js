// 메인 내비게이션 구조 - 5개 핵심 진입점(TASK 3, 디자인·IA 개편).
// "성적표"(/performance)는 신뢰 증명 = 전환 엔진이라 반드시 노출한다.
// 모바일 하단 네비(MobileBottomNav.js)와 동일한 구성으로 맞춰 PC/모바일 일관성을 유지한다.

export const NAV_ITEMS = [
  { id: "home", type: "single", href: "/", label: "오늘" },
  { id: "screener", type: "single", href: "/screener", label: "종목찾기" },
  { id: "performance", type: "single", href: "/performance", label: "성적표" },
  { id: "reports", type: "single", href: "/reports", label: "리포트" },
  { id: "me", type: "single", href: "/me", label: "내 종목" },
];
