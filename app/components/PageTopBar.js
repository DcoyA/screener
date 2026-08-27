import SiteHeader from "./SiteHeader";

// 기존 7개 페이지가 <PageTopBar />로 import한다. 헤더는 SiteHeader 하나로
// 통일됐고(로고 + 7항목 네비, 홈이 네비 1번이라 "홈으로 가기" 버튼 제거),
// backHref/backLabel prop은 하위호환을 위해 받기만 하고 쓰지 않는다.
export default function PageTopBar() {
  return <SiteHeader />;
}
