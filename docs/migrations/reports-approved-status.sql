-- docs/migrations/reports-approved-status.sql
--
-- 발송 게이트 분리(사람 승인 없이는 발송 안 함)를 위해 reports.status에
-- 새 값 3개가 필요하다: approved(승인됨, 발송 대기) / needs_revision(수정
-- 필요) / discarded(폐기). 기존엔 draft/sent만 쓰던 것으로 보인다.
--
-- 주의: 이 테이블은 저장소에 체크인된 마이그레이션 없이 Supabase 대시보드에서
-- 직접 만들어진 것으로 보여, 기존 CHECK 제약의 정확한 이름을 코드만으로는
-- 알 수 없다. 아래는 흔한 기본 이름(<table>_<column>_check)을 가정한
-- 최선의 추정이다 - **실행 전 Supabase 대시보드에서 reports 테이블의 실제
-- 제약 이름을 한 번 확인해달라**. 이름이 다르면 DROP 구문만 실제 이름으로
-- 바꿔서 실행하면 된다.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_status_check'
  ) THEN
    ALTER TABLE reports DROP CONSTRAINT reports_status_check;
  END IF;
END $$;

ALTER TABLE reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN ('draft', 'approved', 'needs_revision', 'discarded', 'sent'));
