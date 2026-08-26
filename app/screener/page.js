import { getAllStocksFromSnapshots } from "../lib/stocksData";
import risks from "../data/risks.json";
import ScreenerPageClient from "./ScreenerPageClient";

export default async function ScreenerPage() {
  const stocks = await getAllStocksFromSnapshots();
  return <ScreenerPageClient stocks={stocks} risks={risks} />;
}
