export default function SubscribeSection({
  isModalOpen,
  email,
  setEmail,
  isSubmitted,
  isSubmitting,
  submitError,
  openModal,
  closeModal,
  handleSubscribe,
}) {
  return (
    <>
      <section className="subscribeSection">
        <div className="subscribeCard">
          <p className="subscribeEyebrow">PREMIUM MVP WAITLIST</p>
          <h2>주간 프리미엄 리포트 사전등록</h2>
          <p className="subscribeDesc">
            현재는 무료 공개 구간을 먼저 완성하면서, 프리미엄 MVP를 함께 준비하고 있습니다.
            <br />
            사전등록하면 <strong>상위 후보 주간 리포트 샘플</strong>과
            <strong> 프리미엄 베타 오픈 소식</strong>을 먼저 받아볼 수 있습니다.
            <br />
            (프리미엄은 확정 수익률 안내가 아니라, 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조입니다.)
          </p>
          <div className="subscribeActions">
            <a
              href="/sample-report.html"
              target="_blank"
              rel="noopener noreferrer"
              className="secondaryBtn"
            >
              샘플 리포트 보기
            </a>
            <button type="button" className="primaryBtn" onClick={openModal}>
              리포트 구독하기
            </button>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="closeBtn"
              onClick={closeModal}
              aria-label="팝업 닫기"
            >
              ×
            </button>
            {!isSubmitted ? (
              <>
                <p className="modalBadge">리포트 구독하기</p>
                <h3>주간 프리미엄 리포트 오픈 알림 신청</h3>
                <p className="modalDesc">
                  사전등록하면 무료 샘플 리포트 안내와 프리미엄 MVP 베타 오픈 소식을 먼저 보내드립니다.
                  프리미엄은 확정 수익이 아니라 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조로 준비 중입니다.
                </p>
                <form className="subscribeForm" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소를 입력해주세요"
                    required
                  />
                  {submitError ? <p className="errorText">{submitError}</p> : null}
                  <div className="modalActions">
                    <button type="button" className="ghostBtn" onClick={closeModal}>
                      닫기
                    </button>
                    <button type="submit" className="primaryBtn" disabled={isSubmitting}>
                      {isSubmitting ? "저장 중..." : "리포트 구독하기"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="successBox">
                <p className="modalBadge">신청 완료</p>
                <h3>접수가 완료되었습니다</h3>
                <p className="modalDesc">
                  프리미엄 MVP 관련 소식과 샘플 리포트 안내를 이메일로 보내드릴게요.
                </p>
                <div className="modalActions singleAction">
                  <button type="button" className="primaryBtn" onClick={closeModal}>
                    확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
