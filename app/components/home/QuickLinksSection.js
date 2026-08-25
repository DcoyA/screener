import Link from "next/link";

// 상단 네비를 홈/스크리너/리포트/마이 4개로 줄이면서 밀려난 항목들을 여기로 옮겼다.
export default function QuickLinksSection() {
  return (
    <section className="quickLinksSection">
      <div className="quickLinksCard">
        <h2>서비스 바로가기</h2>
        <div className="quickLinksGrid">
          <Link href="/demo-trade" className="quickLinkItem">
            <strong>💰 모의투자</strong>
            <span>가상 자금으로 미리 연습</span>
          </Link>
          <Link href="/alternative" className="quickLinkItem">
            <strong>📦 ETF</strong>
            <span>대안투자 후보 살펴보기</span>
          </Link>
          <Link href="/search?tab=risk" className="quickLinkItem">
            <strong>⚠️ 리스크 체크</strong>
            <span>주의 종목과 체크포인트</span>
          </Link>
          <Link href="/notice" className="quickLinkItem">
            <strong>📢 이용가이드</strong>
            <span>사이트 사용법과 공지</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
