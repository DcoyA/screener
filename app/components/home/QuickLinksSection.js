import Link from "next/link";

export default function QuickLinksSection() {
  return (
    <section className="quickLinksSection">
      <div className="quickLinksCard">
        <h2>서비스 바로가기</h2>
        <div className="quickLinksGrid">
          <Link href="/notice" className="quickLinkItem">
            <strong>📢 공지</strong>
            <span>사이트 업데이트 안내</span>
          </Link>
          <Link href="/performance" className="quickLinkItem">
            <strong>📈 성과/백테스트</strong>
            <span>추천종목 실제 투자결과</span>
          </Link>
          <Link href="/search?tab=ranking" className="quickLinkItem">
            <strong>🏆 랭킹</strong>
            <span>AI 점수 기준 상위 종목 보기</span>
          </Link>
          <Link href="/search?tab=risk" className="quickLinkItem">
            <strong>⚠️ 리스크</strong>
            <span>주의 종목과 체크포인트 확인</span>
          </Link>
          <Link href="/reports" className="quickLinkItem">
            <strong>📝 리포트</strong>
            <span>주간 요약과 핵심 후보 정리</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
