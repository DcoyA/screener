import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "./supabase/admin";

// latest_stock_snapshots의 raw_data는 stocks.json 항목과 완전히 같은 모양이므로
// 그대로 꺼내서 배열로 돌려주면 기존 정렬/필터 로직을 그대로 재사용할 수 있다.
//
// STEP 8: 요청마다 Supabase를 때리던 걸 unstable_cache로 감싼다.
//  - tags: ["stocks"] → 파이프라인 성공 후 /api/revalidate가 revalidateTag로 즉시 무효화
//  - revalidate: 3600 → 훅이 안 붙어도 최대 1시간 뒤 자동 갱신(안전망)
// unstable_cache 콜백 안에서는 cookies()를 못 쓰므로, 쿠키 바인딩된
// createSupabaseServerClient() 대신 서비스 롤 admin 클라이언트로 읽는다.
// (latest_stock_snapshots는 공개 랭킹 데이터이고, CLAUDE.md상 읽기 전용 참조는 허용)
// unstable_cache의 데이터 캐시 엔트리는 2MB 상한이 있다. 전체 raw_data 배열은
// 약 2.1MB라 그대로 캐싱하면 "items over 2MB can not be cached"로 캐시가 안 걸린다.
// 스크리너 4개 탭(RankingTab/RiskCheckTab/FinalPicksTab/AlternativeTab)과 그 하위
// lib에서 전혀 참조하지 않는 필드만 제거해 상한 아래로 맞춘다.
//   - newsMeta  : 스크리너 도달 코드에서 참조 0 (약 100KB)
//   - description: 〃 (약 60KB) — summary/risk는 스크리너가 쓰므로 유지
// 상세 종목 페이지(/stock/[code])는 stocks.json 빌드 import를 쓰므로 영향 없음.
const SCREENER_OMIT_FIELDS = ["newsMeta", "description"];

function slimForScreenerCache(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const out = {};
  for (const key of Object.keys(raw)) {
    if (SCREENER_OMIT_FIELDS.includes(key)) continue;
    out[key] = raw[key];
  }
  return out;
}

async function fetchAllStockSnapshots() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("latest_stock_snapshots")
    .select("raw_data");

  if (error) {
    console.error("종목 스냅샷 조회 실패", error);
    return [];
  }

  return (data || []).map((row) => slimForScreenerCache(row.raw_data)).filter(Boolean);
}

export const getAllStocksFromSnapshots = unstable_cache(
  fetchAllStockSnapshots,
  ["all-stock-snapshots"],
  { tags: ["stocks"], revalidate: 3600 }
);
