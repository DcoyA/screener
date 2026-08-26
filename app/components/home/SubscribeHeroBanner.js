export default function SubscribeHeroBanner({ openModal }) {
  return (
    <section className="subscribeHeroBanner">
      <p className="subscribeHeroEyebrow">PREMIUM MVP WAITLIST</p>
      <h1>주간 프리미엄 리포트 사전등록</h1>
      <p className="subscribeHeroDesc">
        상위 후보 주간 리포트 샘플과 프리미엄 베타 오픈 소식을 가장 먼저 받아보세요.
        <br />
        확정 수익률이 아니라 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조입니다.
      </p>
      <button type="button" className="subscribeHeroBtn" onClick={openModal}>
        구독하기
      </button>

      <style jsx>{`
        .subscribeHeroBanner {
          background: var(--color-primary-dark);
          border-radius: var(--radius-card);
          padding: 40px 32px;
          color: #ffffff;
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
        .subscribeHeroBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: var(--radius-pill);
          padding: 16px 32px;
          font-weight: 800;
          font-size: 1.02rem;
          /* "화면당 오렌지 1개" - 상단 네비 CTA(navSubscribeCta)가 이미
             --color-accent를 쓰고 있어서 여기선 primary로 뺀다. */
          background: var(--color-primary);
          color: #ffffff;
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
