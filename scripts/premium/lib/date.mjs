const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const KST_WEEKDAY_NAME = ["일", "월", "화", "수", "목", "금", "토"];

function toKstDate() {
  return new Date(Date.now() + KST_OFFSET_MS);
}

export function kstTodayStr() {
  return toKstDate().toISOString().slice(0, 10);
}

export function kstWeekday() {
  return toKstDate().getUTCDay(); // 0=일 ... 6=토
}
