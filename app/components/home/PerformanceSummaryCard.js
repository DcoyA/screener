import Link from "next/link";

function formatSigned(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(digits)}`;
}

// TASK 4-1 블록④(신규). CLAUDE.md 성과/백테스트 규칙: 표본이 짧다는 사실을
// 숨기지 않고, 승률/수익률에는 항상 표본 수를 같이 적는다. 그래서 "3개월"
// 같은 근사치 대신 실제 주간 스냅샷 수(totalSnapshots)를 그대로 쓴다.
export default function PerformanceSummaryCard({ performanceSummary }) {
  const { excessAvg, overallWinRate, totalSnapshots, totalPicks } = performanceSummary || {};
  const excessText = formatSigned(excessAvg);
  const winRateNum = Number(overallWinRate);
  const hasData = Number.isFinite(excessAvg) && Number.isFinite(winRateNum) && totalSnapshots > 0;

  return (
    <section className="perfSummarySection">
      <div className="perfSummaryCard">
        <p className="sectionTitle perfTitle">우리 성적표</p>
        {hasData ? (
          <>
            <p className="perfHeadline">
              최근 {totalSnapshots}주, 시장보다 {excessText}%p
            </p>
            <p className="perfSubline">
              근데 승률은 {winRateNum.toFixed(1)}%예요 (표본 {totalPicks}건)
            </p>
          </>
        ) : (
          <p className="perfHeadline">아직 쌓인 성적이 없어요</p>
        )}
        <Link href="/performance" className="linkBtn">
          전체 성적표 보기 →
        </Link>
      </div>

      <style jsx>{`
        .perfSummarySection {
          margin-top: 40px;
        }
        /* 카드 배경은 흰색으로 고정해 페이지 배경(--page-bg #FDF7F8)과 분리한다.
           예전엔 --bg-perf(=--page-bg 별칭)를 써서 카드가 배경에 묻혔고,
           그건 성적표 라우트용 토큰이라 홈에서 끌어쓸 이유도 없다.
           흰 배경은 홈의 다른 카드(.boardCard/.strategyCard)와도 일치. */
        .perfSummaryCard {
          border-radius: var(--radius-card);
          padding: 24px;
          background: #ffffff;
          border: 1px solid var(--ink-200);
          box-shadow: var(--shadow-card);
        }
        .perfTitle {
          margin: 0 0 10px;
          font-size: var(--font-title);
          font-weight: var(--font-title-weight);
        }
        .perfHeadline {
          margin: 0 0 6px;
          font-size: var(--font-hero);
          font-weight: var(--font-hero-weight);
          letter-spacing: -0.03em;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .perfSubline {
          margin: 0 0 18px;
          color: var(--ink-600);
          font-size: var(--font-body);
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </section>
  );
}
