// 표기 규칙 회귀 검사 (CI: weekly-json-update.yml / prebuild).
//
// "함수 출력"이 아니라 "화면에 실제로 렌더되는 문자열"을 검사한다:
//  1) buildStrategyCards()  - 홈 전략 슬롯 카드 (reason/desc/title 등 전체)
//  2) buildOneLineReason / buildWarningLine  - 스크리너 카드 "왜 이 리스트에
//     있나" / "무엇을 조심해야 하나" 빌더 (전 종목 × 전 뷰 × 전 리스크)
//  3) formatUpsideDisplay()  - 스크리너/실전투자/내 종목 지표박스 경로
//
// 실패 조건:
//  - "상승여력 <숫자>%" 에서 절대값이 60을 넘는 값 (CLAUDE.md 표기 상한 위반)
//  - "부채비율 +..." (비율에 증감 부호가 붙음)

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { formatUpsideDisplay } from "../../app/lib/formatUpside.js";
import { buildStrategyCards } from "../../app/lib/homeData.js";
import { buildOneLineReason, buildWarningLine } from "../../app/lib/screenerReason.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stocksPath = path.join(__dirname, "..", "..", "app", "data", "stocks.json");
const stocks = JSON.parse(readFileSync(stocksPath, "utf-8"));

const VIEWS = ["total", "undervalue", "upside", "short", "annual", "long"];
const RISKS = ["all", "highDebt", "lowLiquidity", "unstableEarnings"];

// 검사 대상 문자열을 전부 모은다.
const rendered = [];

function collect(value) {
  if (typeof value === "string") rendered.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
}

// 1) 홈 전략 슬롯 - 반환값 전체를 flatten (stock 객체는 순환/무관 필드가 많아 제외)
for (const card of buildStrategyCards(stocks)) {
  const { stock, ...rest } = card;
  collect(rest);
}

// 2) 스크리너 카드 reason 빌더 - 전 종목 × 전 뷰 × 전 리스크
for (const stock of stocks) {
  for (const view of VIEWS) {
    rendered.push(buildOneLineReason(stock, view));
    for (const risk of RISKS) rendered.push(buildWarningLine(stock, view, risk));
  }
  // 3) 지표박스 경로 - "상승여력 " 접두어를 붙여 같은 정규식으로 스캔되게 한다
  rendered.push(`상승여력 ${formatUpsideDisplay(stock)}`);
}

const blob = rendered.filter((s) => typeof s === "string").join("\n");

let violations = 0;

// --- 상승여력 캡(±60%) ---
for (const m of blob.matchAll(/상승여력\s*([+-]?\d+(?:\.\d+)?)%/g)) {
  const shown = Number(m[1]);
  if (Math.abs(shown) > 60) {
    console.error(`[표기 회귀] 상승여력 캡 초과: "${m[0]}"`);
    violations += 1;
  }
}

// --- 부채비율에 증감 부호 ---
for (const m of blob.matchAll(/부채비율\s*\+[^\s]*/g)) {
  console.error(`[표기 회귀] 부채비율에 "+" 부호: "${m[0]}"`);
  violations += 1;
}

if (violations > 0) {
  console.error(`[표기 회귀] 총 ${violations}건 위반 - 배포를 중단합니다`);
  process.exit(1);
}

console.log(
  `[표기 회귀] ${stocks.length}종목 × ${VIEWS.length}뷰 렌더 문자열 ${rendered.length}건 전수 검사 통과`
);
