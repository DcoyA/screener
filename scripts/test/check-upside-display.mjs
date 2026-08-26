import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { formatUpside, UPSIDE_CAP, UPSIDE_FLOOR } from "../../app/lib/formatUpside.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stocksPath = path.join(__dirname, "..", "..", "app", "data", "stocks.json");

const stocks = JSON.parse(readFileSync(stocksPath, "utf-8"));

let violations = 0;

for (const stock of stocks) {
  const { display, raw } = formatUpside(stock?.metrics?.closePrice, stock?.metrics?.targetPrice);
  const numberMatch = display.match(/^([+-]?\d+(?:\.\d+)?)%$/);

  if (numberMatch) {
    const shown = Number(numberMatch[1]);
    if (shown > UPSIDE_CAP || shown < UPSIDE_FLOOR) {
      console.error(
        `[상승여력 회귀] ${stock.code} ${stock.name}: 화면 표기값 ${display} (raw=${raw})가 상한/하한(${UPSIDE_CAP}%/${UPSIDE_FLOOR}%)을 벗어났습니다`
      );
      violations += 1;
    }
  }
}

if (violations > 0) {
  console.error(`[상승여력 회귀] 총 ${violations}건 위반`);
  process.exit(1);
}

console.log(`[상승여력 회귀] ${stocks.length}종목 전수 검사 통과`);
