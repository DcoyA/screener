// 메인 내비게이션 - 기획서 목업 + 라이브 헤더 통합(STEP 5).
// 그대로 더하면 9~10개가 되어 1280px에서 무너지므로 아래로 확정한다.
//
//   [로고]  홈 · 데일리 Top10 · 내 관심종목 · 성적표 · 리포트 · 모의투자  [🔍][👤][구독 CTA]
//
// - 텍스트 pill 6개(NAV_ITEMS)
// - 우측 아이콘 2개(NAV_ICONS): 검색·사용자. 폭 절약 + 관습적으로 이해됨.
//   (검색은 홈에 큰 검색바가 따로 있다. 사용자정보를 텍스트 pill로 두면 CTA와 경쟁.)
// - 구독 CTA는 MainNav에 하드코딩(.rubyCta 하나만).
//
// 각 항목:
//   href/match  이동 경로 / 활성 판정용 pathname prefix
//   exact       true면 pathname === match 일 때만 활성
//   accent      활성 표시용 --accent-* 토큰(배경색은 안 바꾼다 - STEP 3 원칙)
//   icon        1024~1279px 구간에서 라벨 대신 표시(축약 금지, 아이콘+툴팁)

const HOME = { id: "home", href: "/", match: "/", exact: true, label: "홈", shortLabel: "홈", accent: "--accent-home", icon: "home" };
const TOP10 = { id: "top10", href: "/screener?tab=ranking", match: "/screener", label: "데일리 Top10", shortLabel: "Top10", accent: "--accent-screen", icon: "trendingUp" };
const WATCHLIST = { id: "watchlist", href: "/me/watchlist", match: "/me/watchlist", label: "내 관심종목", shortLabel: "관심종목", accent: "--accent-me", icon: "star" };
const PERFORMANCE = { id: "performance", href: "/performance", match: "/performance", label: "성적표", shortLabel: "성적표", accent: "--accent-perf", icon: "chart" };
const REPORTS = { id: "reports", href: "/reports", match: "/reports", label: "리포트", shortLabel: "리포트", accent: "--accent-report", icon: "newspaper" };
// 기존 라우트 /demo-trade를 그대로 쓴다(신규 생성 금지).
const PAPER = { id: "paper", href: "/demo-trade", match: "/demo-trade", label: "모의투자", shortLabel: "모의투자", accent: "--accent-paper", icon: "wallet" };

const SEARCH = { id: "search", href: "/search", match: "/search", label: "검색", shortLabel: "검색", accent: "--accent-search", icon: "search", variant: "icon" };
const ACCOUNT = { id: "account", href: "/me", match: "/me", exact: true, label: "사용자정보", shortLabel: "내 정보", accent: "--accent-me", icon: "user", variant: "icon" };

// 데스크톱 텍스트 pill 6개.
export const NAV_ITEMS = [HOME, TOP10, WATCHLIST, PERFORMANCE, REPORTS, PAPER];

// 데스크톱 우측 아이콘 그룹(구독 CTA는 MainNav에 하드코딩).
export const NAV_ICONS = [SEARCH, ACCOUNT];

// 모바일 하단 고정 네비 5개. 리포트·모의투자·사용자정보는 상단 햄버거 시트로.
export const MOBILE_BOTTOM = [HOME, TOP10, SEARCH, WATCHLIST, PERFORMANCE];

// 모바일 햄버거 시트 = 전체.
export const NAV_SHEET_ITEMS = [...NAV_ITEMS, SEARCH, ACCOUNT];

export function isNavItemActive(item, pathname) {
  if (!item?.match) return false;
  if (item.exact) return pathname === item.match;
  if (item.match === "/") return pathname === "/";
  return pathname === item.match || pathname.startsWith(`${item.match}/`);
}
