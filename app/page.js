import HomeClient from "./components/home/HomeClient";
import staticStocks from "./data/stocks.json";

// 홈은 stocks.json(빌드 스냅샷) 하나만 쓴다 - /performance·/screener와 숫자가
// 어긋나지 않게 하기 위함. (예전엔 일부 블록이 Supabase 실시간 스냅샷을 써서
// 페이지마다 승률/점수가 미세하게 달랐다.)
export default function Page() {
  return <HomeClient stocks={staticStocks} />;
}
