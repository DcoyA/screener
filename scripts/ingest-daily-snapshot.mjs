// scripts/ingest-daily-snapshot.mjs (핵심 발췌)
import { createClient } from "@supabase/supabase-js";
import stocks from "../app/data/stocks.json" with { type: "json" };
import { getUnifiedGrade } from "../app/lib/grade.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const todayKst = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

async function validateAndGuard(rawList) {
  const valid = rawList.filter((s) => s?.code && s?.name && s?.market);
  const { count: yesterdayCount } = await supabase
    .from("stock_daily_snapshots")
    .select("code", { count: "exact", head: true })
    .lt("snapshot_date", todayKst)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (yesterdayCount && valid.length < yesterdayCount * 0.95) {
    throw new Error(
      `이상치 감지: 어제 ${yesterdayCount}건 대비 오늘 ${valid.length}건. 적재를 중단합니다.`
    );
  }
  return valid;
}
