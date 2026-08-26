import HomeClient from "./components/home/HomeClient";
import { getAllStocksFromSnapshots } from "./lib/stocksData";
import { buildPerformanceData } from "./lib/performanceSummary";
import marketState from "./data/market_state.json";
import history from "./data/history.json";
import staticStocks from "./data/stocks.json";

export default async function Page() {
  const stocks = await getAllStocksFromSnapshots();
  // 성과 요약(승률/초과수익)은 /performance 페이지와 반드시 같은 숫자여야
  // 한다. /performance는 stocks.json(빌드 시점 스냅샷)을 쓰는데, 홈은
  // 나머지 블록에서 Supabase 실시간 스냅샷(stocks)을 쓰고 있어서 그대로
  // 넘기면 두 페이지 승률/초과수익이 미세하게 달라진다(직접 확인함:
  // +8.3%p vs +8.2%p, 43.2% vs 42.8%) - 같은 지표를 화면마다 다르게
  // 보여주는 건 신뢰를 깎아먹으므로, 여기서만 stocks.json을 쓴다.
  const performanceSummary = buildPerformanceData({ history, stocks: staticStocks });
  return (
    <HomeClient
      stocks={stocks}
      marketState={marketState}
      performanceSummary={performanceSummary}
    />
  );
}
