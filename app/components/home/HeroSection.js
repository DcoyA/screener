import Link from "next/link";
import Image from "next/image";

export default function HeroSection({ updatedAt }) {
  return (
    <section className="hero">
      <div className="heroTop">
        <div className="heroMain">
          <p className="badge">OFFICIAL DATA LIVE</p>
          <h1>종목을 발굴하려면, <br />데이터부터 분석해야 한다</h1>
          <p className="desc">
            메인에서는 데이터 기반으로 접근 방식을 정리합니다.<br />
            단기 / 연간 / 장기 관점을 나눠서, 같은 종목도 지금은 어떻게 봐야 하는지 다르게 보여줍니다.<br />
            종목을 자세히 보고 싶다면 랭킹 페이지에서 확인하세요.
          </p>
          <div className="heroPointRow">
            <span className="heroPoint">단기: 흐름과 거래대금 중심</span>
            <span className="heroPoint">연간: 점수와 실적 안정성 중심</span>
            <span className="heroPoint">장기: 저평가와 재무 구조 중심</span>
          </div>
          <div className="heroActions">
            <Link className="primaryBtn" href="/ranking">
              상위 랭킹 보기
            </Link>
            <Link className="secondaryBtn" href="/reports">
              이번 주 리포트 보기
            </Link>
          </div>
        </div>

        <aside className="updateBox" aria-label="업데이트 날짜">
          <span className="updateLabel">업데이트</span>
          <strong>{updatedAt}</strong>
          <p className="updateDesc">최근 자동 수집 및 분석 반영일</p>
        </aside>

        <div className="heroCharacter" aria-hidden="true">
          <div className="heroCharacterGlow" />
          <Image
            src="/vegeta-style.png"
            alt=""
            fill
            className="heroCharacterImage"
            priority
          />
        </div>
      </div>
    </section>
  );
}
