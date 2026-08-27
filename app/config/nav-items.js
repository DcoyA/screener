// 메인 내비게이션 구조 - 기획서 헤더 반영(7항목).
// 기획서에는 성적표(/performance)와 리포트가 빠져 있으나, 성적표는 이 서비스의
// 유일한 차별점이자 구독 설득 근거라 반드시 유지한다.
//
// 각 항목:
//   href   실제 이동 경로(쿼리 포함 가능)
//   match  활성 라우트 판정용 pathname prefix (쿼리 제외)
//   exact  true면 pathname === match 일 때만 활성 (/me vs /me/watchlist 충돌 방지)
//   accent 활성 표시에 쓰는 --accent-* 토큰 이름 (배경색은 안 바꾼다 - STEP 3 원칙)
//   variant "avatar"면 텍스트 pill 대신 원형 아이콘 버튼으로 렌더
//   groupEnd  true면 데스크톱 헤더에서 이 항목 뒤에 구분선(┃)을 그린다(기획서 목업)

export const NAV_ITEMS = [
  { id: "home", href: "/", match: "/", exact: true, label: "홈", shortLabel: "홈", accent: "--accent-home", icon: "home" },
  { id: "top10", href: "/screener?tab=ranking", match: "/screener", label: "데일리 Top10", shortLabel: "Top10", accent: "--accent-screen", icon: "trendingUp" },
  { id: "search", href: "/search", match: "/search", label: "종목검색", shortLabel: "검색", accent: "--accent-search", icon: "search", groupEnd: true },
  { id: "watchlist", href: "/me/watchlist", match: "/me/watchlist", label: "내 관심종목", shortLabel: "관심종목", accent: "--accent-me", icon: "star" },
  { id: "performance", href: "/performance", match: "/performance", label: "성적표", shortLabel: "성적표", accent: "--accent-perf", icon: "chart" },
  { id: "paper", href: "/paper", match: "/paper", label: "모의투자", shortLabel: "모의투자", accent: "--accent-paper", icon: "wallet", groupEnd: true },
  { id: "account", href: "/me", match: "/me", exact: true, label: "사용자정보", shortLabel: "내 정보", accent: "--accent-me", icon: "user", variant: "avatar" },
];

// 모바일 하단 고정 네비에 노출할 항목(7개는 다 안 들어감). 나머지(모의투자·
// 사용자정보)는 상단 햄버거 시트로 들어간다.
export const MOBILE_BOTTOM_IDS = ["home", "top10", "search", "watchlist", "performance"];

export function isNavItemActive(item, pathname) {
  if (!item?.match) return false;
  if (item.exact) return pathname === item.match;
  if (item.match === "/") return pathname === "/";
  return pathname === item.match || pathname.startsWith(`${item.match}/`);
}
