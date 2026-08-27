// 종목검색 결과 카드(STEP 7) 가드 회귀 검사.
//
// 기획서 목업의 삼성전자 카드 더미가 산술적으로 모순이라(저장 등락률 ≠ 현재가/전일종가,
// 저가 > 시가인 행 등) 그대로 렌더하면 안 된다. buildQuoteView 가:
//  1) 등락률/전일대비를 (현재가 - 전일종가)/전일종가 로 재계산하는지
//  2) 저가<=시가<=고가, 저가<=현재가<=고가 가 깨지면 "시세 데이터 확인 중"으로 대체하는지
//  3) |등락률| > 30% 면 splitWarning 을 켜는지
//  4) 종목명을 정제하는지
// 를 픽스처로 검증한다. 라이브 API 호출 없음.

import {
  buildQuoteView,
  formatMoney,
  formatVolume,
  formatSignedPct,
  formatSignedWon,
  QUOTE_UNAVAILABLE_TEXT,
} from "../../app/lib/quoteCard.js";

let failed = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    console.error(`  FAIL ${label}`);
    failed += 1;
  }
}

// ── 가드 1: 등락률/전일대비 재계산 (저장값 무시) ──────────────
{
  // 목업식 모순: 저장 rate/change 를 999로 줘도 무시하고 가격에서 재계산해야 한다.
  const v = buildQuoteView({
    name: "삼성전자보통주",
    market: "KOSPI",
    code: "005930",
    snapshot: { price: 12000, prevClose: 10000, open: 10500, high: 12500, low: 9800, rate: 999, change: 999999 },
  });
  check("가드1 rate = (12000-10000)/10000*100 = 20", Math.abs(v.rate - 20) < 1e-9);
  check("가드1 change = 2000", v.change === 2000);
  check("가드1 direction up", v.direction === "up");
  check("가드4 종목명 정제 '삼성전자'", v.name === "삼성전자");
  check("consistent true", v.consistent === true && v.reason === null);
}

// ── 가드 2: 정합성 깨지면 placeholder ────────────────────────
{
  const lowGtOpen = buildQuoteView({
    name: "테스트", market: "KOSPI", code: "000001",
    snapshot: { price: 100, prevClose: 100, open: 90, high: 120, low: 100 }, // low(100) > open(90)
  });
  check("가드2 저가>시가 → consistent false", lowGtOpen.consistent === false);
  check("가드2 저가>시가 → reason 문구", lowGtOpen.reason === QUOTE_UNAVAILABLE_TEXT);
  check("가드2 placeholder 여도 헤더(name/market/code)는 유지", lowGtOpen.name === "테스트" && lowGtOpen.code === "000001");

  const priceGtHigh = buildQuoteView({
    name: "테스트", market: "KOSPI", code: "000002",
    snapshot: { price: 200, prevClose: 150, open: 150, high: 180, low: 140 }, // price(200) > high(180)
  });
  check("가드2 현재가>고가 → consistent false", priceGtHigh.consistent === false);

  const missingOpen = buildQuoteView({
    name: "테스트", market: "KOSDAQ", code: "000003",
    snapshot: { price: 100, prevClose: 100, open: null, high: 120, low: 90 },
  });
  check("가드2 시가 결측 → consistent false", missingOpen.consistent === false);

  const zeroPrev = buildQuoteView({
    name: "테스트", market: "KOSDAQ", code: "000004",
    snapshot: { price: 100, prevClose: 0, open: 95, high: 110, low: 90 },
  });
  check("가드2 전일종가 0 → consistent false (0 나눗셈 방지)", zeroPrev.consistent === false);
}

// ── 가드 3: 액면분할/병합 경고 ──────────────────────────────
{
  const split = buildQuoteView({
    name: "테스트", market: "KOSPI", code: "000010",
    snapshot: { price: 20000, prevClose: 10000, open: 10000, high: 20000, low: 10000 }, // +100%
  });
  check("가드3 등락률 100% → splitWarning true", split.consistent === true && split.splitWarning === true);

  const normal = buildQuoteView({
    name: "테스트", market: "KOSPI", code: "000011",
    snapshot: { price: 10500, prevClose: 10000, open: 10100, high: 10600, low: 10000 }, // +5%
  });
  check("가드3 등락률 5% → splitWarning false", normal.splitWarning === false);

  const downBig = buildQuoteView({
    name: "테스트", market: "KOSPI", code: "000012",
    snapshot: { price: 6000, prevClose: 10000, open: 9000, high: 9000, low: 6000 }, // -40%
  });
  check("가드3 등락률 -40% → splitWarning true, direction down", downBig.splitWarning === true && downBig.direction === "down");
}

// ── 보합 ────────────────────────────────────────────────────
{
  const flat = buildQuoteView({
    name: "테스트", market: "KOSPI", code: "000020",
    snapshot: { price: 10000, prevClose: 10000, open: 9900, high: 10100, low: 9800 },
  });
  check("보합 direction flat", flat.direction === "flat");
  check("보합 splitWarning false", flat.splitWarning === false);
}

// ── 포맷 헬퍼 ───────────────────────────────────────────────
{
  check("formatMoney 6.8조원", formatMoney(6_849_786_602_450) === "6.8조원");
  check("formatMoney 억 단위", formatMoney(543_000_000_000) === "5,430억원");
  check("formatMoney null → –", formatMoney(null) === "–");
  check("formatVolume null → –", formatVolume(null) === "–");
  check("formatVolume 주 표기", formatVolume(19532523) === "19,532,523주");
  check("formatSignedPct 음수 유니코드 마이너스", formatSignedPct(-1.72) === "−1.72%");
  check("formatSignedWon 양수 +", formatSignedWon(4500) === "+4,500원");
}

if (failed > 0) {
  console.error(`\n종목검색 카드 가드 검사 실패: ${failed}건`);
  process.exit(1);
}
console.log("\n종목검색 카드 가드 검사 통과");
