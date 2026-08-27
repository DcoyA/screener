import stocksData from "../data/stocks.json";
import { cleanStockName } from "./stockName";

// 종목 코드 ↔ 정제된 이름/시장 조회용 경량 인덱스 (STEP 8).
//
// stocks.json 전체(2.4MB)를 여러 클라이언트 화면이 각자 import 하던 걸
// 막기 위한 단일 소스. name 은 반드시 cleanStockName 을 경유하므로
// 소비자가 raw name("XX보통주")을 만질 일이 없다.
//
// ⚠ 이 파일은 stocks.json 을 import 한다. **서버 컴포넌트에서만** import 하고,
// 클라이언트에는 필요한 부분만 props 로 내려라. (클라이언트에서 직접 import 하면
// stocks.json 이 다시 번들에 실린다 - 애초에 없애려던 문제)

const rawList = Array.isArray(stocksData) ? stocksData : [];

export const STOCK_INDEX = rawList.map((s) => ({
  code: String(s.code),
  name: cleanStockName(s.name),
  market: s.market || "",
}));

const BY_CODE = new Map(STOCK_INDEX.map((s) => [s.code, s]));

// 코드로 정제된 이름/시장을 찾는다. 없으면 null.
export function lookupStock(code) {
  return BY_CODE.get(String(code)) || null;
}

// 코드에 대응하는 정제된 이름. 인덱스에 없으면 fallback 이름을 정제해서 돌려준다
// (관심종목 테이블에 저장된 raw name 같은 것).
export function resolveStockName(code, fallbackName = "") {
  const hit = BY_CODE.get(String(code));
  return hit ? hit.name : cleanStockName(fallbackName);
}
