import stocksData from "../data/stocks.json";
import risks from "../data/risks.json";
import { cleanStockName } from "../lib/stockName";
import MeClient from "./MeClient";

// STEP 8: 예전엔 이 파일이 "use client" 였고 관심종목 소수를 보여주면서
// stocks.json(2.4MB) 전체를 클라이언트 번들에 실었다. 이제 서버에서 읽고
// 관심종목 패널이 실제로 쓰는 필드만 추려 내린다.
// stocks.json/risks.json 은 파이프라인 커밋 → Vercel 재배포로 갱신되므로
// revalidate 훅은 불필요하지만 지시대로 1시간 안전망을 둔다.
export const revalidate = 3600;

// risks.json: code → level 조회 맵
const riskLevelByCode = new Map(
  (Array.isArray(risks) ? risks : []).map((r) => [String(r.code), r.level])
);

// 관심종목 패널(MeClient WishlistPanel)이 실제로 읽는 필드만.
//  - name: 정제해서 내린다(raw "XX보통주"가 클라이언트로 안 넘어감)
//  - riskLevel: risks.json level 우선, 없으면 raw.riskMeta.level, 그것도 없으면 "-"
//  - metrics: isFairValueOk / formatUpsideDisplay 가 참조하는 closePrice/targetPrice/upside
//  - fairValueStatus + fairValueMeta.status: isFairValueOk 판정
function slimStock(s) {
  return {
    code: String(s.code),
    name: cleanStockName(s.name),
    market: s.market || "",
    sector: s.sector || "",
    metrics: {
      closePrice: s.metrics?.closePrice ?? null,
      targetPrice: s.metrics?.targetPrice ?? null,
      upside: s.metrics?.upside ?? null,
    },
    fairValueStatus: s.fairValueStatus ?? null,
    fairValueMeta: { status: s.fairValueMeta?.status ?? null },
    riskLevel: riskLevelByCode.get(String(s.code)) || s.riskMeta?.level || "-",
  };
}

export default function MePage() {
  const stocks = (Array.isArray(stocksData) ? stocksData : []).map(slimStock);
  return <MeClient stocks={stocks} />;
}
