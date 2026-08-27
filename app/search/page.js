import PageTopBar from "../components/PageTopBar";
import SearchClient from "./SearchClient";
import staticStocks from "../data/stocks.json";
import { normalizeStockName } from "../lib/stockName";

export const metadata = {
  title: "종목검색",
  description: "종목명 일부 또는 종목코드로 종목을 찾고 현재 시세를 확인합니다.",
};

// 클라이언트로 넘기는 검색 인덱스는 {code, name, market} 만. (stocks.json 전체는
// 500개 × 수십 필드라 번들에 실으면 무겁다. 이름은 정제해서 넘긴다.)
export default function SearchPage() {
  const index = staticStocks.map((s) => ({
    code: s.code,
    name: normalizeStockName(s.name),
    market: s.market || "",
  }));

  return (
    <main className="container" style={{ background: "var(--page-bg)", minHeight: "60vh" }}>
      <PageTopBar />
      <SearchClient index={index} />
    </main>
  );
}
