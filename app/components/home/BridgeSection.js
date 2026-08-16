export default function BridgeSection() {
  return (
    <section className="bridgeSection">
      <div className="bridgeCard">
        <div className="bridgeHeader">
          <div>
            <p className="bridgeBadge">FREE → PREMIUM</p>
            <h2>무료에서 검증하고, 프리미엄에서 행동합니다</h2>
            <p className="bridgeDesc">
              무료 페이지는 “왜 추천 / 왜 제외 / 실제 결과”를 검증하는 영역입니다.
              프리미엄은 그 위에 <strong>행동 가능한 주간 시나리오</strong>를 얹는 구조로 준비 중입니다.
            </p>
          </div>
        </div>
        <div className="bridgeGrid">
          <div className="bridgeItem">
            <span className="bridgeItemLabel">무료에서 보는 것</span>
            <ul>
              <li>종합/저평가/상승여력 랭킹</li>
              <li>리스크 체크 포인트</li>
              <li>상세페이지 해석</li>
              <li>성과/백테스트 공개</li>
            </ul>
          </div>
          <div className="bridgeItem premium">
            <span className="bridgeItemLabel">프리미엄에서 추가될 것</span>
            <ul>
              <li>단기 · 중기 · 장기 시나리오</li>
              <li>왜 지금 보는지 / 무엇이 틀리면 철회할지</li>
              <li>핵심 후보 정리 + 후속 추적</li>
              <li>주간 프리미엄 리포트</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
