// TASK 4-1 블록①. market_state.json의 header.summary는
// scripts/generate_market_state.py가 매일 새로 만드는 문장이라(오늘 왜
// 이 시황인지 근거가 있는 문구), 홈에서 새로 지어내지 않고 그대로 큰
// 글씨로 보여준다. 코스피 지수·외국인 순매수 같은 실제 시황 숫자는
// 파이프라인에 아직 없어서(TASK 4 조사 결과), 문서 예시("코스피 6,770
// (+0.4%)")를 그대로 흉내내지 않는다 - 없는 숫자를 지어내는 것보다는
// 이미 검증된 문장을 쓰는 게 CLAUDE.md 원칙에 맞는다.
export default function TodayHeadline({ marketState }) {
  const summary = marketState?.header?.summary;

  return (
    <section className="todayHeadline">
      <p className="todayEyebrow">오늘 시장</p>
      <h1 className="todayBigText">{summary || "오늘 시황을 준비하고 있어요."}</h1>

      <style jsx>{`
        .todayHeadline {
          margin-bottom: 8px;
        }
        .todayEyebrow {
          margin: 0 0 10px;
          color: #94a3b8;
          font-size: var(--font-caption);
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .todayBigText {
          margin: 0;
          font-size: clamp(1.6rem, 3.4vw, var(--font-display));
          font-weight: var(--font-display-weight);
          line-height: var(--line-tight);
          letter-spacing: -0.03em;
          color: #0f172a;
        }
      `}</style>
    </section>
  );
}
