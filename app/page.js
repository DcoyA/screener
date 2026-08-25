import HomeClient from "./components/home/HomeClient";
import { getAllStocksFromSnapshots } from "./lib/stocksData";
import { createSupabaseAdminClient } from "./lib/supabase/admin";
import notices from "./data/notices.json";

async function getLatestSentReport() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, topic_title, content_json")
    .eq("status", "sent")
    .order("issue_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("최신 프리미엄 리포트 조회 실패:", error);
    return null;
  }
  return data;
}

export default async function Page() {
  const [stocks, latestReport] = await Promise.all([
    getAllStocksFromSnapshots(),
    getLatestSentReport(),
  ]);
  return <HomeClient stocks={stocks} notices={notices} latestReport={latestReport} />;
}
