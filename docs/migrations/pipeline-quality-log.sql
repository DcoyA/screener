-- docs/migrations/pipeline-quality-log.sql
--
-- scripts/validate_pipeline_output.py (데이터 품질 게이트) 2단계(WARN/BLOCK)
-- 재설계용 신규 테이블. 매 파이프라인 실행마다 지표별로 한 행씩 기록해서,
-- 다음 실행이 "직전 실행 대비 변화량(델타)"을 계산할 수 있게 한다.
--
-- 실행은 사용자가 직접 한다 (스크립트가 자동으로 이 파일을 실행하지 않음).
-- IF NOT EXISTS를 썼으므로 여러 번 실행해도 안전하다.
--
-- 베이스라인 조회 규칙(validate_pipeline_output.py 쪽 구현과 반드시 짝을 맞춰야 함):
--   "직전 성공 실행"이란 verdict='block'인 지표가 하나도 없었던 가장 최근
--   run_date를 말한다. BLOCK된 실행은 감사(audit) 목적으로 이 테이블에
--   그대로 기록은 남기지만, 다음 실행의 베이스라인으로는 쓰지 않는다
--   (BLOCK 상황의 수치를 정상 기준선으로 삼으면 다음 델타 비교가 오염된다).

CREATE TABLE IF NOT EXISTS public.pipeline_quality_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_date      date NOT NULL,
  metric_name   text NOT NULL,
  metric_value  numeric,
  verdict       text NOT NULL CHECK (verdict IN ('pass', 'warn', 'block')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipeline_quality_log_run_date_idx
  ON public.pipeline_quality_log (run_date DESC);

CREATE INDEX IF NOT EXISTS pipeline_quality_log_metric_name_idx
  ON public.pipeline_quality_log (metric_name);

-- 같은 날 같은 지표를 중복 실행(백업 cron, 수동 재시도 등)으로 여러 번
-- 기록하면 "직전 실행"의 정의가 모호해진다. run_date+metric_name 유니크
-- 제약을 걸고, 스크립트 쪽에서 upsert(on conflict)로 최신 값만 남긴다.
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_quality_log_run_date_metric_uidx
  ON public.pipeline_quality_log (run_date, metric_name);
