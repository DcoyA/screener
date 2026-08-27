import { createClient } from "@supabase/supabase-js";
import { kstTodayStr, kstWeekday, KST_WEEKDAY_NAME } from "./lib/date.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_CANDIDATES = 4;
const MIN_CANDIDATES = 3;
const DEDUP_WINDOW_DAYS = 42; // 6주
const DAY_BONUS = 40;

const KST_DAY_TYPE = { 1: "mon", 2: "tue", 4: "thu", 5: "fri" }; // topic_candidates_day_type_check 허용값
const VALID_DAY_TYPES = new Set(Object.values(KST_DAY_TYPE));

function daysAgoStr(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysFromNowStr(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 검증/테스트용으로 day_type을 강제 지정할 수 있게 함
// (CLI 인자 우선, 없으면 FORCE_DAY_TYPE 환경변수). 둘 다 없으면 실제 KST 요일로 판정한다.
function resolveDayType() {
  const forced = process.argv[2] || process.env.FORCE_DAY_TYPE;
  if (forced) {
    if (!VALID_DAY_TYPES.has(forced)) {
      console.error(`알 수 없는 day_type 강제 지정 값: ${forced} (mon/tue/thu/fri 중 하나여야 함)`);
      process.exit(1);
    }
    return { dayType: forced, isForced: true };
  }
  const weekday = kstWeekday();
  return { dayType: KST_DAY_TYPE[weekday] || null, isForced: false, weekday };
}

async function fetchRecentMarketIssues() {
  const since = daysAgoStr(2); // 최근 3일(오늘 포함)
  const { data, error } = await supabase
    .from("market_issues")
    .select("*")
    .gte("issue_date", since);

  if (error) {
    console.error("market_issues 조회 실패:", error);
    return [];
  }
  console.log(`[market_issues] ${data.length}건 조회`);
  return data;
}

async function fetchRecentDisclosureEvents() {
  const since = daysAgoStr(2); // 최근 3일(오늘 포함)
  const { data, error } = await supabase
    .from("disclosure_events")
    .select("*")
    .gte("disclosure_date", since);

  if (error) {
    console.error("disclosure_events 조회 실패:", error);
    return [];
  }
  console.log(`[disclosure_events] ${data.length}건 조회`);
  return data;
}

async function fetchUpcomingHighImportanceEvents() {
  const from = daysAgoStr(0);
  const to = daysFromNowStr(7);
  const { data, error } = await supabase
    .from("economic_calendar")
    .select("*")
    .eq("importance", "high")
    .gte("event_date", from)
    .lte("event_date", to);

  if (error) {
    console.error("economic_calendar 조회 실패(테이블 부재일 수 있음, 0건으로 처리):", error);
    return [];
  }
  console.log(`[economic_calendar] ${data.length}건 조회`);
  return data;
}

async function fetchRecentFlowSignals() {
  const since = daysAgoStr(1); // 최근 1~2일치
  const { data, error } = await supabase
    .from("flow_signals")
    .select("*")
    .gte("date", since);

  if (error) {
    console.error("flow_signals 조회 실패:", error);
    return [];
  }
  console.log(`[flow_signals] ${data.length}건 조회`);
  return data;
}

// 최근 6주(DEDUP_WINDOW_DAYS) 내 승인(selected)된 후보의 종목/섹터를 모아 중복 소재 회피에 사용
async function fetchRecentSelectedCodesAndSectors(today) {
  const since = daysAgoStr(DEDUP_WINDOW_DAYS);
  const { data, error } = await supabase
    .from("topic_candidates")
    .select("related_codes, related_sectors")
    .eq("status", "selected")
    .gte("target_issue_date", since)
    .lte("target_issue_date", today);

  if (error) {
    console.error("최근 6주 selected 후보 조회 실패(중복 회피 스킵):", error);
    return { codes: new Set(), sectors: new Set() };
  }

  const codes = new Set();
  const sectors = new Set();
  for (const row of data) {
    for (const c of row.related_codes || []) codes.add(c);
    for (const s of row.related_sectors || []) sectors.add(s);
  }
  console.log(`[중복회피] 최근 ${DEDUP_WINDOW_DAYS}일 selected 종목 ${codes.size}개, 섹터 ${sectors.size}개 수집`);
  return { codes, sectors };
}

// 목요일 "후속 전개" 판단용: 지난주(7~13일 전) selected 후보의 종목/섹터
async function fetchLastWeekSelectedCodesAndSectors() {
  const from = daysAgoStr(13);
  const to = daysAgoStr(7);
  const { data, error } = await supabase
    .from("topic_candidates")
    .select("related_codes, related_sectors")
    .eq("status", "selected")
    .gte("target_issue_date", from)
    .lte("target_issue_date", to);

  if (error) {
    console.error("지난주 selected 후보 조회 실패(후속 전개 가중치 스킵):", error);
    return { codes: new Set(), sectors: new Set() };
  }

  const codes = new Set();
  const sectors = new Set();
  for (const row of data) {
    for (const c of row.related_codes || []) codes.add(c);
    for (const s of row.related_sectors || []) sectors.add(s);
  }
  console.log(`[후속전개] 지난주 selected 종목 ${codes.size}개, 섹터 ${sectors.size}개 수집`);
  return { codes, sectors };
}

function itemOverlaps(item, codes, sectors) {
  const itemCodes = item.related_codes || [];
  const itemSectors = item.related_sectors || [];
  return itemCodes.some((c) => codes.has(c)) || itemSectors.some((s) => sectors.has(s));
}

function scoreEconomicCalendarItems(items) {
  const today = daysAgoStr(0);
  return items.map((item) => {
    const daysUntil = Math.round(
      (new Date(item.event_date) - new Date(today)) / (1000 * 60 * 60 * 24)
    );
    const urgencyBonus = Math.max(0, 7 - daysUntil) * 5; // 임박할수록 가중치 ↑
    return {
      source: "economic_calendar",
      score: 60 + urgencyBonus,
      title: (item.title || item.event_name || "주요 경제 일정").slice(0, 60),
      rationale: `${item.event_date} 예정된 high 중요도 일정 (D-${daysUntil}).${
        item.description ? ` ${item.description}` : ""
      }`,
      related_codes: [],
      related_sectors: item.related_sectors || [],
      meta: { daysUntil },
    };
  });
}

function scoreMarketIssueItems(items) {
  const confidenceWeight = { high: 90, mid: 60, low: 30 };
  return items.map((item) => {
    const base = confidenceWeight[item.confidence] || 30;
    const directionBonus = item.direction && item.direction !== "neutral" ? 5 : 0;
    return {
      source: "market_issues",
      score: base + directionBonus,
      title: (item.title || "시장 이슈").slice(0, 60),
      rationale: `${item.issue_date} 감지된 이슈 (confidence=${item.confidence}, direction=${item.direction}). ${
        item.summary || ""
      }`.trim(),
      related_codes: item.impacted_codes || [],
      related_sectors: item.impacted_sectors || [],
      meta: { confidence: item.confidence, direction: item.direction },
    };
  });
}

function scoreDisclosureEventItems(items) {
  const typeWeight = { major_holder: 80, executive_ownership: 60 };
  return items.map((item) => {
    const base = typeWeight[item.type] || 40;
    return {
      source: "disclosure_events",
      score: base,
      title: `${item.code} 공시: ${(item.summary || item.type || "").slice(0, 40)}`,
      rationale: `${item.disclosure_date} ${item.code} 종목의 ${item.type} 공시. ${item.summary || ""}`.trim(),
      related_codes: item.code ? [item.code] : [],
      related_sectors: [],
      meta: { disclosureType: item.type },
    };
  });
}

function scoreFlowSignalItems(items) {
  const TOP_N = 5; // 상위 스코어링에만 태우고, 최종 선정은 아래 공통 로직에서 결정
  const withMagnitude = items.map((item) => {
    const foreign = Number(item.foreign_net_buy) || 0;
    const inst = Number(item.inst_net_buy) || 0;
    const shortChange = Math.abs(Number(item.short_balance_change_pct) || 0);
    const magnitude = Math.abs(foreign) + Math.abs(inst);
    return { item, foreign, inst, shortChange, magnitude };
  });

  withMagnitude.sort((a, b) => b.magnitude + b.shortChange - (a.magnitude + a.shortChange));

  return withMagnitude.slice(0, TOP_N).map(({ item, foreign, inst, shortChange }) => ({
    source: "flow_signals",
    score: 40 + Math.min(40, (Math.abs(foreign) + Math.abs(inst)) / 1e8) + Math.min(10, shortChange),
    title: `${item.code} 수급 변동`,
    rationale: `${item.date} 기준 외국인 순매수 ${foreign.toLocaleString()}, 기관 순매수 ${inst.toLocaleString()}, 공매도잔고 변동 ${shortChange}%.`,
    related_codes: item.code ? [item.code] : [],
    related_sectors: [],
    meta: { zscore: item.foreign_zscore_20d ?? null },
  }));
}

// 요일별 소재 우선순위를 점수에 반영한다.
// mon: market_issues(confidence 높은 순) / tue: flow_signals(수급 급변동 순) /
// thu: 지난주 selected와 겹치는 market_issues/disclosure_events("후속 전개")
function applyDayTypeWeight(items, dayType, lastWeekSelected) {
  return items.map((item) => {
    if (dayType === "mon" && item.source === "market_issues") {
      return { ...item, score: item.score + DAY_BONUS };
    }
    if (dayType === "tue" && item.source === "flow_signals") {
      return { ...item, score: item.score + DAY_BONUS };
    }
    if (
      dayType === "thu" &&
      (item.source === "market_issues" || item.source === "disclosure_events") &&
      itemOverlaps(item, lastWeekSelected.codes, lastWeekSelected.sectors)
    ) {
      return { ...item, score: item.score + DAY_BONUS + 10, rationale: `[후속 전개] ${item.rationale}` };
    }
    return item;
  });
}

// 6주 내 selected와 겹치는 종목/섹터는 우선 완전 배제하되,
// 배제 결과 후보가 MIN_CANDIDATES 미만이 되면 점수 높은 순으로 다시 채운다.
function selectWithDedup(scoredItems, recentSelected) {
  const sorted = [...scoredItems].sort((a, b) => b.score - a.score);
  const nonOverlapping = sorted.filter((item) => !itemOverlaps(item, recentSelected.codes, recentSelected.sectors));
  const overlapping = sorted.filter((item) => itemOverlaps(item, recentSelected.codes, recentSelected.sectors));

  let selected = nonOverlapping.slice(0, MAX_CANDIDATES);
  if (selected.length < MIN_CANDIDATES) {
    const need = MIN_CANDIDATES - selected.length;
    console.log(`[중복회피] 배제 후 ${selected.length}건뿐이라 다음 우선순위 ${need}건을 6주 중복 허용하고 채웁니다`);
    selected = selected.concat(overlapping.slice(0, need));
  }
  return selected;
}

// 소재뱅크(evergreen_topics/literacy_topics)가 비어있으면 기본 소재를 시딩한다.
async function ensureTopicBankSeeded(table, seeds) {
  const { count, error: countError } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (countError) {
    console.error(`${table} 건수 확인 실패:`, countError);
    return;
  }
  if (count > 0) return;

  const rows = seeds.map((s) => ({ topic_title: s.topic_title, category: s.category, last_used_at: null }));
  const { error: insertError } = await supabase.from(table).insert(rows);
  if (insertError) {
    console.error(`${table} 시드 삽입 실패:`, insertError);
    return;
  }
  console.log(`[소재뱅크] ${table} ${rows.length}건 시드 삽입 완료`);
}

const EVERGREEN_SEEDS = [
  { topic_title: "분산투자가 수익률을 지켜주는 이유", category: "장기투자" },
  { topic_title: "복리 효과는 왜 시간이 지날수록 커지는가", category: "장기투자" },
  { topic_title: "PER과 PBR, 무엇을 먼저 봐야 할까", category: "투자상식" },
  { topic_title: "배당수익률만 보고 투자하면 안 되는 이유", category: "투자상식" },
  { topic_title: "경기 사이클과 섹터 순환의 관계", category: "장기투자" },
  { topic_title: "부채비율이 높은 기업을 피해야 하는 이유", category: "투자상식" },
  { topic_title: "우량주와 성장주, 포트폴리오 비중은 어떻게", category: "장기투자" },
  { topic_title: "시가총액과 유동성이 매매에 미치는 영향", category: "투자상식" },
  { topic_title: "장기 보유 관점에서 본 리밸런싱의 의미", category: "장기투자" },
  { topic_title: "ROE로 기업의 자본 효율성을 읽는 법", category: "투자상식" },
  { topic_title: "환율 변동이 수출주에 미치는 구조적 영향", category: "장기투자" },
  { topic_title: "현금흐름표를 봐야 하는 이유", category: "투자상식" },
];

const LITERACY_SEEDS = [
  { topic_title: "손절 기준을 미리 정해야 하는 이유", category: "투자자교육" },
  { topic_title: "확정 수익률이라는 말을 믿으면 안 되는 이유", category: "투자자교육" },
  { topic_title: "레버리지 상품의 구조적 위험", category: "투자자교육" },
  { topic_title: "공시를 읽을 때 가장 먼저 볼 항목", category: "투자자교육" },
  { topic_title: "테마주에 뒤늦게 진입할 때 생기는 손실 패턴", category: "투자자교육" },
  { topic_title: "분기 실적 발표 전후 변동성 대응법", category: "투자자교육" },
  { topic_title: "유상증자 공시가 주가에 미치는 영향", category: "투자자교육" },
  { topic_title: "단일 종목 집중투자의 리스크", category: "투자자교육" },
  { topic_title: "루머와 확인된 공시를 구분하는 법", category: "투자자교육" },
  { topic_title: "매매일지를 써야 하는 이유", category: "투자자교육" },
  { topic_title: "투자 커뮤니티 정보를 검증 없이 따르면 안 되는 이유", category: "투자자교육" },
  { topic_title: "세금(양도소득세/배당소득세) 기초 이해", category: "투자자교육" },
];

async function fetchRotationCandidates(table, sourceLabel, categoryLabel) {
  const { data, error } = await supabase
    .from(table)
    .select("id, topic_title, category, last_used_at")
    .order("last_used_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error(`${table} 조회 실패:`, error);
    return [];
  }

  return data.map((row) => ({
    source: sourceLabel,
    score: 35,
    title: row.topic_title,
    rationale: `${categoryLabel} 소재뱅크 로테이션 (last_used_at=${row.last_used_at || "없음(최우선)"})`,
    related_codes: [],
    related_sectors: [],
    meta: { category: row.category },
    _topicBankRow: { table, id: row.id },
  }));
}

// 금요일: economic_calendar(high) 우선 채택, 남는 슬롯은 소재뱅크 로테이션으로 채운다.
async function selectFridayCandidates(calendarItems, evergreenPool, literacyPool, recentSelected) {
  const sortedCalendar = [...calendarItems].sort((a, b) => b.score - a.score);
  const nonOverlappingCalendar = sortedCalendar.filter(
    (item) => !itemOverlaps(item, recentSelected.codes, recentSelected.sectors)
  );
  const overlappingCalendar = sortedCalendar.filter((item) =>
    itemOverlaps(item, recentSelected.codes, recentSelected.sectors)
  );

  let selected = nonOverlappingCalendar.slice(0, MAX_CANDIDATES);

  if (selected.length < MAX_CANDIDATES) {
    const remainingSlots = MAX_CANDIDATES - selected.length;
    const rotationPool = [];
    const maxLen = Math.max(evergreenPool.length, literacyPool.length);
    for (let i = 0; i < maxLen; i++) {
      if (evergreenPool[i]) rotationPool.push(evergreenPool[i]);
      if (literacyPool[i]) rotationPool.push(literacyPool[i]);
    }
    selected = selected.concat(rotationPool.slice(0, remainingSlots));
  }

  if (selected.length < MIN_CANDIDATES) {
    const need = MIN_CANDIDATES - selected.length;
    console.log(`[금요일] ${selected.length}건뿐이라 6주 중복을 허용한 캘린더 일정 ${need}건을 추가합니다`);
    selected = selected.concat(overlappingCalendar.slice(0, need));
  }

  return selected;
}

// 후보로 노출된 소재뱅크 항목은 승인 여부와 무관하게 즉시 last_used_at을 갱신한다.
// 이유: 로테이션의 목적은 "같은 소재가 반복 노출되는 것"을 막는 것이지 "승인된 소재만 회전"시키는
// 것이 아니다. 에디터가 거부하더라도 이미 후보로 한 번 소비된 소재이므로 다음 로테이션에서는
// 뒤로 미뤄야 같은 소재가 계속 후보로만 반복 노출되는 것을 막을 수 있다.
async function markTopicBankItemsAsUsed(selectedCandidates) {
  const now = new Date().toISOString();
  for (const c of selectedCandidates) {
    if (!c._topicBankRow) continue;
    const { table, id } = c._topicBankRow;
    const { error } = await supabase.from(table).update({ last_used_at: now }).eq("id", id);
    if (error) {
      console.error(`${table}(id=${id}) last_used_at 갱신 실패:`, error);
    } else {
      console.log(`[소재뱅크] ${table}(id=${id}) last_used_at 갱신 완료`);
    }
  }
}

async function main() {
  const { dayType, isForced, weekday } = resolveDayType();

  if (!dayType) {
    console.log(`[생성] 오늘(${KST_WEEKDAY_NAME[weekday]}요일)은 리포트 생성 대상 요일이 아니므로 스킵합니다`);
    return;
  }
  if (isForced) {
    console.log(`[생성] day_type을 '${dayType}'(으)로 강제 지정하여 실행합니다`);
  }

  const today = kstTodayStr(); // notify-editor.mjs가 조회하는 target_issue_date와 동일한 KST 기준이어야 함

  const { data: existing, error: existingError } = await supabase
    .from("topic_candidates")
    .select("id")
    .eq("target_issue_date", today)
    .eq("day_type", dayType);

  if (existingError) {
    console.error("topic_candidates 기존 행 조회 실패:", existingError);
    process.exit(1);
  }

  if (existing.length > 0 && process.env.FORCE !== "1") {
    // 멱등성 가드(STEP 9): collect 워크플로를 실패 지점부터 통째로 재실행해도
    // 이 단계는 오늘자 배치가 있으면 그냥 빠진다. FORCE=1로 강제 재생성 가능.
    console.log(`[생성] 오늘(${today}, day_type=${dayType})은 이미 후보가 ${existing.length}건 존재하므로 신규 생성을 스킵합니다 (강제 재생성: FORCE=1)`);
    return;
  }
  if (existing.length > 0) {
    console.log(`[생성] FORCE=1 - 오늘자 후보 ${existing.length}건이 있지만 강제로 재생성합니다 (유니크 제약이 중복 삽입을 막습니다)`);
  }

  const [marketIssues, disclosureEvents, calendarEvents, flowSignals, recentSelected] = await Promise.all([
    fetchRecentMarketIssues(),
    fetchRecentDisclosureEvents(),
    fetchUpcomingHighImportanceEvents(),
    fetchRecentFlowSignals(),
    fetchRecentSelectedCodesAndSectors(today),
  ]);

  let finalCandidates;

  if (dayType === "fri") {
    await ensureTopicBankSeeded("evergreen_topics", EVERGREEN_SEEDS);
    await ensureTopicBankSeeded("literacy_topics", LITERACY_SEEDS);

    const [calendarScored, evergreenPool, literacyPool] = await Promise.all([
      Promise.resolve(scoreEconomicCalendarItems(calendarEvents)),
      fetchRotationCandidates("evergreen_topics", "evergreen_topics", "투자 상식/장기투자"),
      fetchRotationCandidates("literacy_topics", "literacy_topics", "투자자 교육"),
    ]);

    finalCandidates = await selectFridayCandidates(calendarScored, evergreenPool, literacyPool, recentSelected);
  } else {
    const lastWeekSelected =
      dayType === "thu" ? await fetchLastWeekSelectedCodesAndSectors() : { codes: new Set(), sectors: new Set() };

    const scoredItems = applyDayTypeWeight(
      [
        ...scoreEconomicCalendarItems(calendarEvents),
        ...scoreMarketIssueItems(marketIssues),
        ...scoreDisclosureEventItems(disclosureEvents),
        ...scoreFlowSignalItems(flowSignals),
      ],
      dayType,
      lastWeekSelected
    );

    if (scoredItems.length === 0) {
      console.log("후보로 삼을 데이터가 없습니다.");
      return;
    }

    finalCandidates = selectWithDedup(scoredItems, recentSelected);
  }

  if (finalCandidates.length === 0) {
    console.log("후보로 삼을 데이터가 없습니다.");
    return;
  }

  console.log(`[생성] ${finalCandidates.length}건 후보 선정 (day_type=${dayType})`);

  const rows = finalCandidates.map((c, idx) => ({
    target_issue_date: today,
    day_type: dayType,
    candidate_no: idx,
    title: c.title,
    rationale: c.rationale,
    related_codes: c.related_codes || [],
    related_sectors: c.related_sectors || [],
    status: "proposed",
    source: c.source,
    meta: c.meta || {},
  }));
  // title_key 는 DB GENERATED 컬럼이라 페이로드에 넣지 않는다(넣으면 에러).

  // 유니크 키 (target_issue_date, day_type, source, title_key) 중 source 는
  // 스크립트가 채워야 한다. 비어 있으면 STEP 4의 NOT NULL 제약에 걸리므로 먼저 막는다.
  const missingSource = rows.filter((r) => !r.source);
  if (missingSource.length > 0) {
    console.error(`[생성] source 가 비어 있는 후보 ${missingSource.length}건 - 저장 중단`);
    console.error(missingSource.map((r) => `  - ${r.title}`).join("\n"));
    process.exit(1);
  }

  // 멱등성(STEP 9): 재실행 시 이미 있는 (date, day_type, source, title_key) 는
  // 건너뛴다(DO NOTHING). 반려/편집된 기존 행을 재제안이 덮어쓰지 않게 하기 위함.
  const { data: inserted, error } = await supabase
    .from("topic_candidates")
    .upsert(rows, { onConflict: "target_issue_date,day_type,source,title_key", ignoreDuplicates: true })
    .select("id");
  if (error) {
    if (error.code === "42P10") {
      console.error("[생성] topic_candidates 유니크 제약(target_issue_date, day_type, source, title_key) 미적용 - 마이그레이션 필요");
      console.error("      docs/migrations/20260827-topic-candidates-unique-key.sql 을 먼저 실행하세요.");
      process.exit(1); // 치명적 - 재시도 불가
    }
    console.error("topic_candidates 저장 실패 (원문):");
    console.error(`code: ${error.code}`);
    console.error(`message: ${error.message}`);
    console.error(`details: ${error.details}`);
    console.error(`hint: ${error.hint}`);
    process.exit(1);
  }

  const insertedCount = Array.isArray(inserted) ? inserted.length : 0;
  const skippedCount = rows.length - insertedCount;
  if (skippedCount > 0) {
    console.log(`[생성] ${skippedCount}건은 이미 존재해 건너뜀(중복 키)`);
  }

  await markTopicBankItemsAsUsed(finalCandidates);

  console.log(`[생성] 후보 ${rows.length}건 중 신규 ${insertedCount}건 저장 완료`);
}

main();
