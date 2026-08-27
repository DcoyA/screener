// 표기 규칙 회귀 검사 (CI: weekly-json-update.yml / prebuild).
//
// "함수 출력"이 아니라 "화면에 실제로 렌더되는 문자열"을 검사한다:
//  1) buildStrategyCards()  - 홈 전략 슬롯 카드 (reason/desc/title 등 전체)
//  2) buildOneLineReason / buildWarningLine  - 스크리너 카드 reason 빌더
//  3) formatUpsideDisplay()  - 스크리너/실전투자/내 종목 지표박스 경로
//  4) normalizeStockName(name)  - 전 종목명
//
// 실패 조건:
//  - "상승여력 <숫자>%" 절대값 60 초과 (CLAUDE.md 표기 상한 위반)
//  - "부채비율 +..." (비율에 증감 부호)
//  - 정제 후에도 종목명이 /(보통주|우선주)$/ 로 끝남
//  - app/**/*.js 에서 raw ".name" 을 JSX 텍스트로 직접 렌더(normalizeStockName/
//    cleanStockName 미경유)하는 라인이 allowlist 밖에 존재

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { formatUpsideDisplay } from "../../app/lib/formatUpside.js";
import { buildStrategyCards } from "../../app/lib/homeData.js";
import { buildOneLineReason, buildWarningLine } from "../../app/lib/screenerReason.js";
import { normalizeStockName } from "../../app/lib/stockName.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const stocksPath = path.join(repoRoot, "app", "data", "stocks.json");
const stocks = JSON.parse(readFileSync(stocksPath, "utf-8"));

const VIEWS = ["total", "undervalue", "upside", "short", "annual", "long"];
const RISKS = ["all", "highDebt", "lowLiquidity", "unstableEarnings"];

const rendered = [];
function collect(value) {
  if (typeof value === "string") rendered.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
}

for (const card of buildStrategyCards(stocks)) {
  const { stock, ...rest } = card;
  collect(rest);
}
for (const stock of stocks) {
  for (const view of VIEWS) {
    rendered.push(buildOneLineReason(stock, view));
    for (const risk of RISKS) rendered.push(buildWarningLine(stock, view, risk));
  }
  rendered.push(`상승여력 ${formatUpsideDisplay(stock)}`);
  rendered.push(`종목 ${normalizeStockName(stock.name)}`);
}

const blob = rendered.filter((s) => typeof s === "string").join("\n");
let violations = 0;

// --- 상승여력 캡(±60%) ---
for (const m of blob.matchAll(/상승여력\s*([+-]?\d+(?:\.\d+)?)%/g)) {
  if (Math.abs(Number(m[1])) > 60) {
    console.error(`[표기 회귀] 상승여력 캡 초과: "${m[0]}"`);
    violations += 1;
  }
}

// --- 부채비율에 증감 부호 ---
for (const m of blob.matchAll(/부채비율\s*\+[^\s]*/g)) {
  console.error(`[표기 회귀] 부채비율에 "+" 부호: "${m[0]}"`);
  violations += 1;
}

// --- 종목명 "보통주/우선주" 접미사 (정제 후 렌더 문자열 기준) ---
for (const stock of stocks) {
  const shown = normalizeStockName(stock.name);
  if (/(보통주|우선주)$/.test(shown)) {
    console.error(`[표기 회귀] 종목명 접미사 미정제: "${stock.name}" -> "${shown}"`);
    violations += 1;
  }
}

// --- app/**/*.js: raw ".name" 을 JSX 텍스트로 직접 렌더하는 경로 탐지 ---
// 정당하게 raw name을 쓰는 라인(검색 normalize/정렬, name= prop, href/URL,
// benchmarkName 등)은 아래 allowlist로 명시적으로 통과시킨다.
const RAW_NAME_ALLOW = [
  /\bname=\{/, // <WishlistButton name={stock.name} /> 등 prop 전달
  /encodeURIComponent|href=/, // URL 파라미터
  /benchmarkName|sectorName|corp_name|nickname|user_metadata|tagName|hostName|fileName/,
  /\.(includes|filter|map|sort|localeCompare|find|some|every|toLowerCase)\(/, // 검색/정렬 로직
  /\bnormalize\(|String\(\s*\w+\?\.\bname|String\(\s*\w+\.name/, // 검색 정규화
  /t\.name === |\.name === |quote\.name|fetchQuote\(/, // 매칭/데이터 전달(렌더 아님)
  /key=\{/,
];
function listJsFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      out.push(...listJsFiles(full));
    } else if (ent.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}
// `{ ... x.name ... }` 형태이면서 바로 앞이 `>` 또는 공백/텍스트(= 프롭이 아님)인 경우.
const RAW_NAME_RENDER = /(?:>|\s)\{\s*[^{}=]*?\b[\w.?]+\.name\b[^{}]*\}/;
const SAFE_WRAP = /(normalizeStockName|cleanStockName)\s*\(/;

for (const file of listJsFiles(path.join(repoRoot, "app"))) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    const m = line.match(RAW_NAME_RENDER);
    if (!m) return;
    if (SAFE_WRAP.test(m[0])) return;
    if (RAW_NAME_ALLOW.some((re) => re.test(line))) return;
    console.error(`[표기 회귀] raw 종목명 직접 렌더 의심: ${rel}:${i + 1}  ${line.trim().slice(0, 120)}`);
    violations += 1;
  });
}

if (violations > 0) {
  console.error(`[표기 회귀] 총 ${violations}건 위반 - 배포를 중단합니다`);
  process.exit(1);
}

console.log(
  `[표기 회귀] ${stocks.length}종목 렌더 문자열 ${rendered.length}건 + 종목명 정제 + app/ raw name 스캔 전수 통과`
);
