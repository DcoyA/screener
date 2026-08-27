// 종목검색 결과 카드(기획서 삼성전자 카드)용 순수 로직.
//
// 기획서 목업의 더미 숫자가 산술적으로 모순이라(저장 등락률과 현재가/전일종가가
// 안 맞고, 저가 > 시가인 행도 있음) 화면에 그대로 내보내면 신뢰가 깨진다.
// 그래서 시세 소스가 준 값을 그대로 믿지 않고 여기서 재계산·검증한다.
//
// React 의존성 없음. scripts/test/check-quote-card-guards.mjs 가 픽스처로 검증한다.

import { normalizeStockName } from "./stockName.js";
import { formatKrwCompact } from "./formatMoney.js";

function toNum(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

// 정합성 검사에 쓰는 "핵심 4종"(현재가·전일종가·시가·고가·저가)은 모두 양수여야 한다.
function isPositive(num) {
  return typeof num === "number" && Number.isFinite(num) && num > 0;
}

export const SPLIT_WARNING_THRESHOLD = 30; // 등락률 절대값(%) 이 값 초과 시 액면분할/병합 의심
export const QUOTE_UNAVAILABLE_TEXT = "시세 데이터 확인 중";

// snapshot: { price, prevClose, open, high, low, volume, tradeValue } (숫자 or null)
export function buildQuoteView({ name, market, code, snapshot } = {}) {
  const s = snapshot || {};
  const price = toNum(s.price);
  const prevClose = toNum(s.prevClose);
  const open = toNum(s.open);
  const high = toNum(s.high);
  const low = toNum(s.low);
  const volume = toNum(s.volume);
  const tradeValue = toNum(s.tradeValue);

  const header = {
    name: normalizeStockName(name || ""),
    market: market || "",
    code: code || "",
  };

  // 가드 2: 저가 <= 시가 <= 고가, 저가 <= 현재가 <= 고가.
  // 핵심 값 중 하나라도 결측/비양수거나 부등식이 깨지면 시세 블록을 렌더하지 않는다.
  const corePresent =
    isPositive(price) && isPositive(prevClose) && isPositive(open) && isPositive(high) && isPositive(low);
  const consistent =
    corePresent && low <= open && open <= high && low <= price && price <= high;

  if (!consistent) {
    return {
      ...header,
      consistent: false,
      reason: QUOTE_UNAVAILABLE_TEXT,
    };
  }

  // 가드 1: 등락률은 저장값을 믿지 말고 (현재가 - 전일종가) / 전일종가 로 재계산.
  //         금액(전일대비)도 같은 이유로 현재가 - 전일종가 로 재계산한다.
  const change = price - prevClose;
  const rate = (change / prevClose) * 100;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";

  // 가드 3: 등락률 절대값 30% 초과 → 액면분할/병합 가능성 경고.
  const splitWarning = Math.abs(rate) > SPLIT_WARNING_THRESHOLD;

  return {
    ...header,
    consistent: true,
    reason: null,
    price,
    prevClose,
    open,
    high,
    low,
    volume, // null 이면 화면에서 "–"
    tradeValue, // null 이면 화면에서 "–" (네이버 폴백엔 거래대금이 없다)
    change,
    rate,
    direction,
    splitWarning,
  };
}

// ── 표기 헬퍼 ────────────────────────────────────────────────
export function formatWon(value) {
  const num = toNum(value);
  if (num === null) return "–";
  return `${Math.round(num).toLocaleString("ko-KR")}원`;
}

export function formatSignedWon(value) {
  const num = toNum(value);
  if (num === null) return "–";
  const sign = num > 0 ? "+" : num < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(num)).toLocaleString("ko-KR")}원`;
}

export function formatSignedPct(value) {
  const num = toNum(value);
  if (num === null) return "–";
  const sign = num > 0 ? "+" : num < 0 ? "−" : "";
  return `${sign}${Math.abs(num).toFixed(2)}%`;
}

export function formatVolume(value) {
  const num = toNum(value);
  if (num === null) return "–";
  return `${Math.round(num).toLocaleString("ko-KR")}주`;
}

// 억원 단위 소수점 1자리는 공용 formatKrwCompact(app/lib/formatMoney.js)에 있다.
// 이 카드는 결측을 "–"(en-dash)로 표기하므로 공용 함수의 "-" 만 매핑한다.
export function formatMoney(value) {
  if (toNum(value) === null) return "–";
  const s = formatKrwCompact(value);
  return s === "-" ? "–" : s;
}

// ── 시세 조회 ────────────────────────────────────────────────
// /api/kis/quote 응답에서 카드에 필요한 snapshot 만 뽑는다.
// 운영은 KIS, 로컬/폴백은 네이버(거래대금 없음 → null).
export async function fetchQuoteSnapshot(code, { signal } = {}) {
  const res = await fetch(`/api/kis/quote?code=${encodeURIComponent(code)}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "시세를 불러오지 못했습니다.");
  }
  const snap = data.snapshot || {};
  return {
    name: data.name || "",
    source: data.source || "",
    snapshot: {
      price: snap.price ?? data.price ?? null,
      prevClose: snap.prevClose ?? null,
      open: snap.open ?? null,
      high: snap.high ?? null,
      low: snap.low ?? null,
      volume: snap.volume ?? null,
      tradeValue: snap.tradeValue ?? null,
    },
  };
}
