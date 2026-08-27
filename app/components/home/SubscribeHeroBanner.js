export default function SubscribeHeroBanner({ openModal }) {
  return (
    <section className="subscribeHeroBanner rubySurface">
      <p className="subscribeHeroEyebrow">PREMIUM MVP WAITLIST</p>
      <h1>주간 프리미엄 리포트 사전등록</h1>
      <p className="subscribeHeroDesc">
        상위 후보 주간 리포트 샘플과 프리미엄 베타 오픈 소식을 가장 먼저 받아보세요.
        <br />
        확정 수익률이 아니라 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조입니다.
      </p>
      <button type="button" className="subscribeHeroBtn rubyCta" onClick={openModal}>
        구독하기
      </button>

      <style jsx>{`
        /* 배경(펄 레이어)·글자색은 전역 .rubySurface가 담당한다. */
        .subscribeHeroBanner {
          border-radius: var(--radius-card);
          padding: 40px 32px;
        }
        .subscribeHeroEyebrow {
          display: inline-flex;
          padding: 8px 14px;
          border-radius: var(--radius-pill);
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          margin: 0 0 16px;
        }
        h1 {
          margin: 0 0 14px;
          font-size: clamp(1.6rem, 4vw, 2.4rem);
          letter-spacing: -0.03em;
          line-height: 1.25;
        }
        .subscribeHeroDesc {
          margin: 0 0 26px;
          max-width: 640px;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.8;
        }
        /* 색/펄 테두리/hover는 전역 .rubyCta가 담당한다. 여기선 레이아웃만. */
        .subscribeHeroBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 16px 32px;
          font-size: 1.02rem;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .subscribeHeroBanner {
            padding: 32px 22px;
          }
        }
      `}</style>
    </section>
  );
}
