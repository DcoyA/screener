-- docs/migrations/topic-candidates-source-meta.sql
--
-- 슬랙 다중 선택 체크박스(TASK 6)가 후보 라벨에 출처 태그와 배지를
-- 보여주려면(예: "[시장이슈] ... 신뢰도 high", "[수급] ... z=2.8") 그
-- 정보가 DB에 있어야 하는데, generate-topic-candidates.mjs는 지금까지
-- source를 스크립트 내부 변수로만 쓰고 topic_candidates에 저장하지
-- 않았다. source(출처 카테고리)와 meta(출처별 배지 데이터, jsonb)를
-- 추가한다.
--
-- 실행은 사용자가 직접 한다. IF NOT EXISTS를 썼으므로 여러 번 실행해도 안전하다.

ALTER TABLE topic_candidates
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
