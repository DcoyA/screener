-- docs/migrations/send-logs-failure-columns.sql
--
-- send-report-email.mjs가 이제 실패 건수/이메일 목록도 send_logs에 같이
-- 남긴다(전체 실패율 계산 및 사후 추적용). 실행 전 이 컬럼 없이 배포하면
-- recordSendLog()의 insert가 "존재하지 않는 컬럼" 에러로 실패한다 - 순서
-- 중요(이 SQL 먼저, 코드 배포는 그다음).
--
-- 실행은 사용자가 직접 한다. IF NOT EXISTS를 썼으므로 여러 번 실행해도 안전하다.

ALTER TABLE send_logs
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_emails text[] NOT NULL DEFAULT '{}';
