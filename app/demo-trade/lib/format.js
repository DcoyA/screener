export function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatWon(value) {
  return `${Math.round(toNumber(value)).toLocaleString()}원`;
}

export function formatRate(value) {
  const number = toNumber(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export function normalizeSide(side) {
  return String(side || "BUY").toUpperCase();
}

export function getKoreaHourMinuteFromIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}${minute}`;
}

export function candleMinuteValue(candle) {
  const time = String(candle?.time || "");
  if (time.length < 4) return null;
  return time.slice(0, 4);
}
