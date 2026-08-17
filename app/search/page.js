import { getAllStocksFromSnapshots } from "../lib/stocksData";
import risks from "../data/risks.json";
import SearchPageClient from "./SearchPageClient";

export default async function SearchPage() {
  const stocks = await getAllStocksFromSnapshots();
  return <SearchPageClient stocks={stocks} risks={risks} />;
}
