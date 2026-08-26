import { createSupabaseServerClient } from "./supabase/server";

// 4주/8주/12주 전 + 현재, 총 4개 시점을 보여준다.
const LOOKBACK_WEEKS = [12, 8, 4];

const GRADE_RANK = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const BIG_SWING_THRESHOLD = 3; // 등급 3단계 이상 차이나면 경고

function daysAgoStr(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// targetDateStr "그 날짜의" 스냅샷이 아니라 "그 날짜 이전 중 가장 최근"
// 스냅샷을 찾는다 - 휴장일 등으로 정확히 그 날짜 스냅샷이 없을 수 있어서.
// 그래도 못 찾으면(파이프라인 누적 기간이 그만큼 안 됨 등) null - 임의로
// 보간하지 않는다.
async function fetchGradeAsOf(supabase, code, targetDateStr) {
  const { data, error } = await supabase
    .from("stock_daily_snapshots")
    .select("unified_grade_code, snapshot_date")
    .eq("code", code)
    .lte("snapshot_date", targetDateStr)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { grade: data.unified_grade_code, asOfDate: data.snapshot_date };
}

// currentGrade는 호출 측(getStockDiagnosisData)이 이미 latest_stock_snapshots에서
// 가져온 값을 그대로 받는다 - 여기서 중복 조회하지 않는다.
export async function getGradeHistory(code, currentGrade) {
  const supabase = await createSupabaseServerClient();

  const pastPoints = await Promise.all(
    LOOKBACK_WEEKS.map(async (weeks) => {
      const result = await fetchGradeAsOf(supabase, code, daysAgoStr(weeks * 7));
      return { label: `${weeks}주 전`, grade: result?.grade ?? null, asOfDate: result?.asOfDate ?? null };
    })
  );

  const timeline = [...pastPoints, { label: "현재", grade: currentGrade ?? null, asOfDate: null }];

  const knownRanks = timeline
    .map((p) => GRADE_RANK[p.grade])
    .filter((rank) => rank != null);

  const bigSwing = knownRanks.length >= 2 && Math.max(...knownRanks) - Math.min(...knownRanks) >= BIG_SWING_THRESHOLD;

  return { timeline, bigSwing };
}
