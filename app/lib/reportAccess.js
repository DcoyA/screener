import { verifyReportLinkToken } from "./reportLinkToken";
import { isActiveSubscriber } from "./subscription";

// 프리미엄 리포트 열람 권한 판정의 유일한 진입점 - /reports/[id]를 비롯해
// 리포트 본문을 노출하는 모든 곳은 반드시 이 함수만 거친다.
//
// 두 경로:
//   1) 서명 토큰 - 이메일 웹뷰 링크(수신자는 대부분 비로그인).
//   2) 활성 구독자 - 마이페이지에서 로그인 상태로 들어온 경우(토큰 없음).
//      subscriber는 app/lib/subscription.js의 getSubscriberForSession() 결과.
//      구독은 "가입 시점 무관, 활성이면 지난 리포트 전부 열람"이므로 리포트별
//      수신 여부를 따지지 않는다.
export async function resolveReportAccess({ reportId, token, subscriber = null }) {
  const tokenResult = verifyReportLinkToken(token, reportId);
  if (tokenResult.valid) {
    return { allowed: true, via: "token" };
  }

  // 실제 활성 구독자면 토큰/키 상태와 무관하게 통과시킨다.
  if (isActiveSubscriber(subscriber)) {
    return { allowed: true, via: "subscriber" };
  }

  // secret_missing은 설정 오류이지 "구독 안 함"이 아니다 - 호출 측이
  // 이 reason을 보고 500으로 닫아야 한다(EDITORIAL_PREVIEW_TOKEN과 동일 원칙 -
  // 키가 없다고 전체 공개로 열리면 안 됨).
  return { allowed: false, reason: tokenResult.reason || "no_token" };
}
