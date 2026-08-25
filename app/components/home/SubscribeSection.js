// 항상 보이는 구독 카드는 SubscribeHeroBanner(홈 최상단, 오렌지 CTA)가 대신하고,
// 이 컴포넌트는 그 배너 버튼이 여는 신청 모달만 담당한다.
export default function SubscribeSection({
  isModalOpen,
  email,
  setEmail,
  isSubmitted,
  isSubmitting,
  submitError,
  closeModal,
  handleSubscribe,
}) {
  return (
    <>
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
