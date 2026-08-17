import { createSupabaseServerClient } from "./supabase/server";

// latest_stock_snapshots의 raw_data는 stocks.json 항목과 완전히 같은 모양이므로
// 그대로 꺼내서 배열로 돌려주면 기존 정렬/필터 로직을 그대로 재사용할 수 있다.
export async function getAllStocksFromSnapshots() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("latest_stock_snapshots")
    .select("raw_data");

  if (error) {
    console.error("종목 스냅샷 조회 실패", error);
    return [];
  }

  return (data || []).map((row) => row.raw_data).filter(Boolean);
}
