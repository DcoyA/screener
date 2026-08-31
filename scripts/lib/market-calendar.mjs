// KRX 거래일 판정 - 적재(ingest-daily-snapshot.mjs)와 감시(verify-today-ingested.mjs)가
// 같은 규칙을 쓰도록 공용화한다. 예전엔 휴장일 체크가 적재 쪽에만 있어서, 감시가
// 휴장일/주말마다 "스냅샷 0건"을 거짓 실패로 잡았다.

const KST_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// KST 기준 날짜 문자열 (YYYY-MM-DD).
export function kstDateStr(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(d);
}

// KST 기준 오늘에서 days 일 뺀 날짜 문자열 (YYYY-MM-DD). 실행 시각/러너 타임존과
// 무관하게 "달력상 며칠 전"만 계산한다 - UTC 기반 계산은 UTC 자정 근처에 하루
// 밀린다. 비교 대상(예: reports.issue_date)이 KST 로 기록될 때 기준을 맞추는 용도.
export function kstDaysAgoStr(days, d = new Date()) {
  const base = new Date(`${kstDateStr(d)}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().slice(0, 10);
}

// KST 기준 요일. 0=일 ... 6=토.
export function kstWeekday(d = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(d);
  return KST_WEEKDAY.indexOf(name);
}

export function isWeekendKst(d = new Date()) {
  const w = kstWeekday(d);
  return w === 0 || w === 6;
}

// market_holidays 테이블에 해당 날짜가 등록돼 있으면 true.
// 조회 자체가 실패하면(네트워크/권한) throw 한다 - 호출부가 조회 실패를
// "휴장일"로 오인해 검증을 건너뛰면 진짜 장애를 놓치기 때문.
export async function isMarketHoliday(supabase, dateStr) {
  const { data, error } = await supabase
    .from("market_holidays")
    .select("holiday_date")
    .eq("holiday_date", dateStr)
    .maybeSingle();
  if (error) {
    throw new Error(`market_holidays 조회 실패: ${error.message}`);
  }
  return !!data;
}
