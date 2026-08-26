// stocks.json의 기준일(updatedAt)을 오늘(KST)과 비교해 신선도 상태를 계산한다.
// "오늘"은 페이지가 언제 빌드/배포됐는지가 아니라 지금 이 순간의 실제 KST여야
// 하므로, 이 모듈의 계산은 항상 호출 시점의 Date.now()를 기준으로 한다
// (배치 시점에 값을 굳혀서 쓰지 않는다 - 주말처럼 재배포가 없는 구간에도
// 정확해야 하기 때문).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toKstDate(date) {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

export function kstTodayStr(now = new Date()) {
  return toKstDate(now).toISOString().slice(0, 10);
}

function parseDateOnlyUTC(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}

function isWeekendUTC(date) {
  const day = date.getUTCDay(); // 0=일 ... 6=토
  return day === 0 || day === 6;
}

// fromStr(제외) 다음날부터 toStr(포함)까지의 평일 수.
function countBusinessDaysBetween(fromStr, toStr) {
  let cursor = parseDateOnlyUTC(fromStr);
  const end = parseDateOnlyUTC(toStr);
  let count = 0;
  while (cursor.getTime() < end.getTime()) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (!isWeekendUTC(cursor)) count++;
  }
  return count;
}

// dateStr(YYYY-MM-DD) 다음 평일을 "MM-DD"로.
function nextWeekdayLabel(dateStr) {
  let cursor = parseDateOnlyUTC(dateStr);
  do {
    cursor = new Date(cursor.getTime() + DAY_MS);
  } while (isWeekendUTC(cursor));
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

// 전 종목이 같은 updatedAt을 갖는 게 정상이지만, 혹시 일부만 갱신되다 만
// 경우를 대비해 가장 최신 값을 기준일로 쓴다("YYYY-MM-DD"는 문자열 비교로
// 최신 판별 가능).
export function getStocksBasisDate(stocks) {
  if (!Array.isArray(stocks) || stocks.length === 0) return null;
  let latest = null;
  for (const s of stocks) {
    if (s?.updatedAt && (!latest || s.updatedAt > latest)) latest = s.updatedAt;
  }
  return latest;
}

/**
 * @param {string} basisDateStr stocks.json의 기준일("YYYY-MM-DD")
 * @param {Date} [now]
 * @returns {{basisDate:string, isStale:boolean, isDelayed:boolean,
 *   businessDaysBehind:number, nextUpdateLabel:string, level:"ok"|"stale"|"delayed"}}
 */
export function getDataFreshness(basisDateStr, now = new Date()) {
  const today = kstTodayStr(now);
  const isStale = basisDateStr !== today;
  const businessDaysBehind = isStale ? countBusinessDaysBetween(basisDateStr, today) : 0;
  const isDelayed = businessDaysBehind >= 2;

  let level = "ok";
  if (isDelayed) level = "delayed";
  else if (isStale) level = "stale";

  return {
    basisDate: basisDateStr,
    isStale,
    isDelayed,
    businessDaysBehind,
    nextUpdateLabel: `${nextWeekdayLabel(basisDateStr)} 09:07`,
    level,
  };
}
