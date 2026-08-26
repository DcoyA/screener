import { verifyReportLinkToken } from "./reportLinkToken";

// 프리미엄 리포트 열람 권한 판정의 유일한 진입점 - /reports/[id]를 비롯해
// 리포트 본문을 노출하는 모든 곳은 반드시 이 함수만 거친다. 결제 도입 시
// 이 함수 내부만 교체하면 된다(docs/audit/backlog/report-entitlement.md 참고).
//
// 지금은 서명 토큰 경로만 있다 - 이메일 수신자는 대부분 비로그인 상태라
// 토큰이 필수 경로이고, 로그인 기반 판정은 report_subscribers가 결제
// 없는 이메일 리스트일 뿐 계정과 연결되지 않아 아직 만들지 않았다.
export async function resolveReportAccess({ reportId, token, session }) {
  const tokenResult = verifyReportLinkToken(token, reportId);
  if (tokenResult.valid) {
    return { allowed: true, via: "token" };
  }

  // secret_missing은 설정 오류이지 "구독 안 함"이 아니다 - 호출 측이
  // 이 reason을 보고 500으로 닫아야 한다(EDITORIAL_PREVIEW_TOKEN과 동일 원칙 -
  // 키가 없다고 전체 공개로 열리면 안 됨).
  return { allowed: false, reason: tokenResult.reason || "no_token" };

  // TODO(결제 도입 후): session이 있으면 entitlements 테이블을 조회해서
  // { allowed: true, via: "entitlement" } 분기를 여기에 추가한다.
}
