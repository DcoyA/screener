# 프리미엄 리포트 열람 권한 - 결제 도입 시 필요한 것

지금(TASK 7, 디자인·IA 개편) 구현한 건 서명 토큰 경로 하나뿐이다.
`app/lib/reportAccess.js`의 `resolveReportAccess()`가 열람 권한 판정의
유일한 진입점이고, 결제가 붙으면 이 함수 내부만 바꾸면 되도록 설계했다.
이 문서는 그때 필요한 것들을 미리 적어둔다.

## 1. entitlements 테이블

지금 `report_subscribers`는 결제 없는 이메일 사전등록 리스트다. 여기에
"구독자 여부"를 박아 넣지 않은 이유: 나중에 유료 결제가 붙으면 무료
대기자와 유료 구독자를 구분할 자리가 없어져서, 그 시점에 열람 권한 판정을
다시 뜯어내야 하고 그때는 이미 여러 페이지가 잘못된 판정에 의존하고
있을 것이기 때문이다.

결제 도입 시 별도 테이블을 새로 만든다(가칭 `entitlements`):

```sql
CREATE TABLE entitlements (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  plan         text NOT NULL,              -- 'monthly' | 'yearly' 등
  valid_from   timestamptz NOT NULL,
  valid_until  timestamptz NOT NULL,
  source       text NOT NULL,              -- 'stripe' | 'manual' | ... (결제 수단/경로)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entitlements_user_id_idx ON entitlements (user_id);
```

`resolveReportAccess({ reportId, token, session })`에서 `session`이 있으면
`entitlements`를 `valid_from <= now() <= valid_until`로 조회해
`{ allowed: true, via: "entitlement" }`를 반환하는 분기를 추가한다.

## 2. 카카오 로그인 이메일의 함정

로그인 기반 판정을 만들 때 이메일 문자열 단순 비교로 처리하면 안 된다.

- 카카오는 이메일 미제공/미인증 동의가 가능해서 `email`이 `null`로 올 수
  있다 - 이 경우 이메일 기반 판정 자체가 불가능하다.
- 대소문자 차이(`A@B.com` vs `a@b.com`).
- Gmail의 점(`.`)과 플러스 별칭(`+tag`) - `a.b+premium@gmail.com`과
  `ab@gmail.com`이 같은 편지함으로 간다.

→ 결제 도입 시 `entitlements.user_id`를 `auth.users.id`(uuid)로 직접
연결해서 이메일 문자열 대조 자체를 피하는 게 맞다(카카오 로그인 시점의
`user.id`가 곧 entitlement 조회 키).

## 3. 기존 무료 대기자(report_subscribers) 이관

`report_subscribers`(현재 활성 구독자 - 결제 없는 이메일 리스트)를 유료
전환 시 어떻게 다룰지 결정 필요:
- 단순 유지(무료 리스트 그대로 두고 유료는 별도 채널로 신규 모집), 또는
- 유료 전환 프로모션 대상 리스트로 활용(예: 첫 달 할인 쿠폰 발송 등).

이건 상품/마케팅 판단이 필요한 부분이라 코드 결정 사항은 아니다 - 결제
도입 논의 시점에 따로 정할 것.

## 4. 지금 구현된 것 (참고)

- `app/lib/reportLinkToken.js`: HMAC-SHA256(reportId+만료시각) 서명 토큰.
  DB 조회 없이 검증 가능, 유효기간 30일.
- `app/lib/reportAccess.js`: `resolveReportAccess({ reportId, token, session })`.
  지금은 토큰 경로만 있고 `session`은 받아만 두고 안 씀(위 1번 붙일 자리).
- `app/reports/[id]/page.js`: 토큰 없으면 첫 섹션 2~3줄 미리보기 + 잠금
  화면(클라이언트 블러 아님 - 서버에서 본문 자체를 안 내려보냄).
- `REPORT_LINK_SECRET` 환경변수가 없으면 토큰 검증이 전부 실패로
  처리되어(fail-closed) 전체 공개가 되지 않는다. 발송 스크립트
  (`send-report-email.mjs`)도 이 키가 없으면 발송 자체를 막는다(구독자도
  못 여는 링크가 나가는 것을 방지).
