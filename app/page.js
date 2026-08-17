import HomeClient from "./components/home/HomeClient";
import { getAllStocksFromSnapshots } from "./lib/stocksData";
import notices from "./data/notices.json";

export default async function Page() {
  const stocks = await getAllStocksFromSnapshots();
  return <HomeClient stocks={stocks} notices={notices} />;
}
