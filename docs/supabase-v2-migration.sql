-- docs/supabase-v2-migration.sql
--
-- fair-value v2 관련 SQL 마이그레이션.
--
-- 결론부터: **이 SQL을 실행하지 않아도 다음 파이프라인 실행은 실패하지
-- 않습니다.** scripts/ingest-daily-snapshot.mjs의 mapToSnapshotRow()는
-- v2에서 새로 생긴 필드(normalizedNetIncome, sectorCode, modelVersion,
-- targetPriceConservative/Optimistic, display.*, fairValueMeta.* 등)를
-- 개별 컬럼으로 쓰지 않고, stock 객체 전체를 그대로 `raw_data`
-- (JSONB로 추정 — 이번 세션엔 서비스 롤 키가 없어 실제 스키마를 직접
-- 조회하진 못했고, 기존 코드가 raw_data를 "stocks.json 항목과 완전히
-- 같은 모양"으로 다루는 방식을 근거로 추정한 것입니다) 컬럼에 통째로
-- 담습니다. 새 필드는 이미 그 안에 자동으로 실려 있습니다.
--
-- 이 파일은 "실패를 막기 위해 필수"가 아니라, v2 필드를 raw_data JSON을
-- 파싱하지 않고도 SQL에서 바로 필터링/정렬하고 싶어질 경우를 대비한
-- **선택적** 확장입니다(예: `WHERE sector_code = '26'`,
-- `ORDER BY normalized_net_income` 같은 쿼리). 지금 당장 이 컬럼들을
-- 읽는 애플리케이션 코드는 없습니다 — 필요해지면 그때 아래 컬럼들을
-- 채우도록 scripts/ingest-daily-snapshot.mjs의 mapToSnapshotRow()에
-- 매핑을 추가하면 됩니다(이 마이그레이션만 실행하고 그 매핑 코드를
-- 추가하지 않으면 컬럼은 계속 NULL로 남습니다 — 그 자체로는 아무것도
-- 깨지지 않습니다).
--
-- IF NOT EXISTS를 썼으므로 여러 번 실행해도 안전합니다.
-- 대상 테이블: stock_daily_snapshots (scripts/ingest-daily-snapshot.mjs가
-- upsert하는 테이블). latest_stock_snapshots가 이 테이블을 기반으로 한 뷰라면
-- 별도 조치 없이 새 컬럼이 자동으로 노출됩니다 — 뷰가 `SELECT *`가 아니라
-- 컬럼을 명시적으로 나열하는 형태라면, 그 뷰 정의도 함께 갱신해야 아래
-- 컬럼들이 latest_stock_snapshots에서 보입니다(이 저장소 코드만으로는
-- 뷰 정의를 확인할 수 없어 별도 확인이 필요합니다).

ALTER TABLE stock_daily_snapshots
  ADD COLUMN IF NOT EXISTS normalized_net_income   bigint,
  ADD COLUMN IF NOT EXISTS net_income_normalized    boolean,
  ADD COLUMN IF NOT EXISTS normalization_weight     numeric,
  ADD COLUMN IF NOT EXISTS sector_code              text,
  ADD COLUMN IF NOT EXISTS model_version            text,
  ADD COLUMN IF NOT EXISTS target_price_conservative bigint,
  ADD COLUMN IF NOT EXISTS target_price_optimistic  bigint,
  ADD COLUMN IF NOT EXISTS upside_capped            numeric,
  ADD COLUMN IF NOT EXISTS upside_label             text,
  ADD COLUMN IF NOT EXISTS upside_label_reason      text,
  ADD COLUMN IF NOT EXISTS fair_value_sector_tier   text,
  ADD COLUMN IF NOT EXISTS fair_value_sector_sample_size integer,
  ADD COLUMN IF NOT EXISTS fair_value_regression_lambda  numeric,
  ADD COLUMN IF NOT EXISTS fair_value_sector_median_per  numeric;

-- 컬럼 타입은 stock_daily_snapshots의 기존 컬럼(operating_income bigint,
-- total_score numeric 등으로 추정)과 자연스럽게 어울리도록 추론한
-- 값입니다 — 실제 스키마를 직접 조회해 확인한 것은 아니므로, 실행 전에
-- Supabase 대시보드에서 기존 컬럼 타입과 한 번 대조해보시길 권합니다.
