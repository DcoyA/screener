import history from "../data/history.json";
import stocks from "../data/stocks.json";
import PerformanceClient from "./PerformanceClient";

// STEP 8: 예전엔 이 파일이 "use client" 였고 stocks.json(2.4MB)·history.json 을
// 클라이언트 번들에 그대로 실었다(= /performance 첫 로드 JS가 2MB+). 이제
// 서버 컴포넌트로 두고, buildPerformanceData 가 실제로 읽는 필드만 추려
// 클라이언트에 내린다. 집계 로직과 렌더는 PerformanceClient 로 그대로 옮겼다.
//
// stocks.json / history.json 은 파이프라인이 저장소에 커밋 → Vercel 재배포로
// 갱신되므로 별도 revalidate 훅은 불필요하지만, 지시대로 1시간 안전망을 둔다.
export const revalidate = 3600;

// buildPerformanceData(app/lib/performanceSummary.js)가 종목당 읽는 필드 중
// PerformanceClient 가 실제로 화면에 렌더하는 것만 남긴다.
//   - summary        → "현재 요약: ..." 로 렌더 (유지)
//   - totalScore     → "현재 총점" 으로 렌더 (유지)
//   - metrics.closePrice / targetPrice → 현재가·현재 상승여력 계산 (유지)
//   - rankMeta / undervalueMeta → 후보/제외 배지 (유지)
// buildPerformanceData 가 값을 읽긴 하지만 어디에도 렌더되지 않는 필드
// (risk → currentRisk, description → currentDescription, valueScore →
//  currentValueScore)는 뺀다. 골든 테스트(렌더 HTML 비교)로 동일함을 확인.
function slimStock(s) {
  return {
    code: s.code,
    summary: s.summary ?? "",
    totalScore: s.totalScore ?? null,
    metrics: {
      closePrice: s.metrics?.closePrice ?? null,
      targetPrice: s.metrics?.targetPrice ?? null,
    },
    rankMeta: {
      topRankEligible: s.rankMeta?.topRankEligible ?? null,
      flags: s.rankMeta?.flags ?? [],
      penalty: s.rankMeta?.penalty ?? 0,
    },
    undervalueMeta: {
      eligible: s.undervalueMeta?.eligible ?? null,
      flags: s.undervalueMeta?.flags ?? [],
    },
  };
}

export default function PerformancePage() {
  const slimStocks = stocks.map(slimStock);
  return <PerformanceClient history={history} stocks={slimStocks} />;
}
