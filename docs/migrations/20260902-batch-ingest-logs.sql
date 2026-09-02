-- docs/migrations/20260902-batch-ingest-logs.sql
--
-- scripts/ingest-daily-snapshot.mjs 가 8/16부터 참조해 온 batch_ingest_logs
-- 테이블이 실제로는 만들어진 적이 없다. 확인:
--   - 프로브(scripts/diagnose/probe-tables.mjs): 404 / PGRST205
--   - pg_class 에 relname='batch_ingest_logs' 행 없음
-- market_holidays 와 같은 케이스다. 이번엔 insert 가 { error } 를 검사하지
-- 않고 삼켜서(ingest-daily-snapshot.mjs:154, :163) 두 주 넘게 가려져 있었다
-- (그 swallow 자체는 STEP D 에서 고친다).
--
-- 실행은 사용자가 직접 한다. IF NOT EXISTS 라 여러 번 실행해도 안전하다.
--
-- 스키마는 추정하지 않고 코드에서 확정:
--   쓰기: ingest-daily-snapshot.mjs
--     :154 (성공) insert 키 = snapshot_date, status, total_rows, started_at, finished_at
--     :163 (실패) insert 키 = snapshot_date, status, error_message, started_at, finished_at
--     -> 두 페이로드의 합집합. total_rows 는 성공만, error_message 는 실패만 채우므로
--        둘 다 nullable. status 는 'success' | 'failed'.
--   읽기: verify-today-ingested.mjs:58
--     select status, total_rows, finished_at
--     where snapshot_date = $1  order by finished_at desc  limit 1
--     -> (snapshot_date, finished_at desc) 복합 인덱스. 재실행 시 같은 날짜에
--        여러 행이 정당하게 생기므로 snapshot_date 에 unique 를 걸지 않는다
--        (읽기가 finished_at 최신 1건을 고르는 이유가 그것).
--
-- NOT NULL / CHECK 가 코드와 충돌하지 않는지 확인함 (:154/:163 의 insert 가
-- 에러를 삼키므로 제약 위반 = 조용한 손실이 됨. swallow 는 STEP D 에서 고침):
--   - status: ingest-daily-snapshot.mjs 에서만 쓰고 값은 "success"(:156) /
--     "failed"(:165) 두 개뿐. 세 번째 분기 없음 -> CHECK 안전.
--   - started_at: `const startedAt = new Date().toISOString()` 가 runIngest()
--     의 try 밖 첫 줄. 동기 호출이라 throw 불가 -> catch 도달 시점엔 항상
--     대입돼 있음. finished_at 도 insert 시점 new Date() -> NOT NULL 안전.
--   - 휴장일 early return 은 아예 행을 안 남긴다(정상 - verify 가 그 전에 스킵).

CREATE TABLE IF NOT EXISTS public.batch_ingest_logs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date  date NOT NULL,
  status         text NOT NULL CHECK (status IN ('success', 'failed')),
  total_rows     integer,
  error_message  text,
  started_at     timestamptz NOT NULL,
  finished_at    timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS batch_ingest_logs_date_finished_idx
  ON public.batch_ingest_logs (snapshot_date, finished_at DESC);

-- 신규 테이블 초기값으로 RLS 를 켠다(정책은 두지 않음). 이 저장소의 내부
-- 테이블 패턴(stock_price_daily: relrowsecurity=true + 정책 0개)을 따른다.
-- error_message 에 내부 오류 원문이 들어가고, 읽는 곳은 verify(service_role)
-- 하나뿐이다. service_role 은 RLS 를 우회하므로 적재/검증 모두 영향 없다.
-- (기존 테이블 GRANT/RLS 는 건드리지 않음.)
ALTER TABLE public.batch_ingest_logs ENABLE ROW LEVEL SECURITY;

-- 검증 쿼리 (적용 후):
--   select to_regclass('public.batch_ingest_logs');   -- non-null 이어야
--   select count(*) from public.batch_ingest_logs;    -- 최초엔 0
--   select relname, relrowsecurity from pg_class where relname='batch_ingest_logs';  -- true
