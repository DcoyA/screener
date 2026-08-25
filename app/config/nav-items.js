// 메인 내비게이션 구조 - CLEO 스타일 리디자인으로 4개 핵심 진입점만 남긴다.
// 모바일 하단 네비(MobileBottomNav.js)와 동일한 구성으로 맞춰 PC/모바일 일관성을 유지한다.
// 기존 "모의투자", "ETF(대안투자)", "이용가이드"는 홈 화면 카드로 이동했다.

export const NAV_ITEMS = [
  { id: "home", type: "single", href: "/", label: "홈" },
  { id: "search", type: "single", href: "/search", label: "스크리너" },
  { id: "reports", type: "single", href: "/reports", label: "리포트" },
  { id: "wishlist", type: "single", href: "/wishlist", label: "마이" },
];
