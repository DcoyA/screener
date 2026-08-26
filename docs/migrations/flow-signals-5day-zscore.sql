-- docs/migrations/flow-signals-5day-zscore.sql
--
-- scripts/premium/collect_flow_signals.py가 이제 1일치 수급(foreign_net_buy/
-- inst_net_buy, 하위호환 유지)뿐 아니라 5일 누적/20일 z-score도 함께 upsert한다.
-- 이 컬럼들이 없으면 스크립트의 upsert가 "존재하지 않는 컬럼" 에러로 실패한다
-- - 즉 이 마이그레이션은 스크립트 재배포 전에 먼저 실행돼야 한다(순서 중요).
--
-- 실행은 사용자가 직접 한다. IF NOT EXISTS를 썼으므로 여러 번 실행해도 안전하다.
-- 대상 테이블: flow_signals (PK로 추정되는 (code, date) 유니크 제약 위에
-- on_conflict="code,date"로 upsert하고 있음 - 기존 제약은 그대로 둔다).

ALTER TABLE flow_signals
  ADD COLUMN IF NOT EXISTS foreign_net_5d      numeric,
  ADD COLUMN IF NOT EXISTS inst_net_5d         numeric,
  ADD COLUMN IF NOT EXISTS foreign_zscore_20d  numeric;

-- foreign_net_buy/inst_net_buy(1일치, 기존 컬럼)는 변경 없이 그대로 유지 -
-- 기존에 이 값을 읽는 코드(리포트 생성 등)가 있다면 계속 동작한다.
