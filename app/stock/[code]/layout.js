import SiteHeader from "../../components/SiteHeader";

// 종목 상세는 전역 헤더가 루트 layout이 아니라 페이지마다 개별 렌더되는
// 구조라(홈은 <SiteHeader/>, 나머지는 <PageTopBar/>) 헤더가 빠져 있었다.
// 이 세그먼트에만 헤더를 붙인다 - 루트 layout에 넣으면 이미 헤더를 그리는
// 다른 페이지들이 이중 헤더가 된다.
export default function StockDetailLayout({ children }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
