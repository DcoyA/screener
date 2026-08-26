import { getAllStocksFromSnapshots } from "../lib/stocksData";
import risks from "../data/risks.json";
import ScreenerPageClient from "./ScreenerPageClient";

// TASK 5(디자인·IA 개편): 예전엔 tab/view/risk를 전부 클라이언트의
// useSearchParams()로 읽었는데, 그 훅을 쓰는 컴포넌트는 Suspense
// 경계 안에서 "정적 렌더링에서 제외"되어 실제 데이터 대신 fallback
// ("검색 화면을 불러오는 중...")만 서버 응답에 담기고, 진짜 목록은
// 클라이언트 하이드레이션 이후에야 나타났다(SEO 손실, 첫 렌더 체감
// 속도 저하의 원인). 서버 컴포넌트인 여기서 searchParams를 직접 읽어
// 초기값을 props로 내려주면 그 훅 자체가 필요 없어져서 서버가 처음부터
// 진짜 목록을 그린다.
export default async function ScreenerPage({ searchParams }) {
  const stocks = await getAllStocksFromSnapshots();
  const sp = await searchParams;
  const initialTab = (sp?.tab || "").toString().trim();
  const initialView = (sp?.view || "").toString().trim();
  const initialRisk = (sp?.risk || "").toString().trim();
  return (
    <ScreenerPageClient
      stocks={stocks}
      risks={risks}
      initialTab={initialTab}
      initialView={initialView}
      initialRisk={initialRisk}
    />
  );
}
