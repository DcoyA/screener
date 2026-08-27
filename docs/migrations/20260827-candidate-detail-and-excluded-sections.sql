-- docs/migrations/20260827-candidate-detail-and-excluded-sections.sql
--
-- STEP 10:
--  A. 후보 선택 화면에 상세(요약/관련종목/출처)를 노출하려면 그 값이 DB에 있어야 한다.
--     topic_candidates 에 summary(text) / sources(jsonb) 추가.
--     market_issues 에 sources(jsonb) 추가 - 이슈별 근거 기사 [{url,title}].
--  B. 생성된 리포트에서 특정 섹션을 빼고 발송하기 위해 reports.excluded_sections(int[]).
--     원본 content_json 은 절대 수정하지 않고 제외 인덱스만 별도 컬럼에 둔다.
--
-- 실행: 사용자가 Supabase SQL Editor 에서. 각 블록에 IF NOT EXISTS 를 써서 재실행 안전.
--       파이프라인 실행 시간대는 피한다.


-- ─────────────────────────────────────────────────────────────
-- STEP 0  (조회만, 무해) 현재 상태 확인
-- ─────────────────────────────────────────────────────────────
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('topic_candidates', 'market_issues', 'reports')
   and column_name in ('summary', 'sources', 'source_url', 'excluded_sections', 'rationale', 'related_codes')
 order by table_name, column_name;
--   기대: topic_candidates.summary/sources 없음, market_issues.sources 없음,
--        reports.excluded_sections 없음. (있으면 아래 ADD 는 IF NOT EXISTS 라 무해)


-- ─────────────────────────────────────────────────────────────
-- STEP 1  A. 후보 상세용 컬럼
-- ─────────────────────────────────────────────────────────────

-- topic_candidates: 요약 + 출처. summary 는 nullable(수집 실패/미제공 후보가 있음).
-- sources 는 후보가 전부 신규 생성이라 NULL 상태가 필요 없어 기본 '[]'.
--   형태: [{ "url": "...", "title": "..." }]
alter table public.topic_candidates
  add column if not exists summary text,
  add column if not exists sources jsonb not null default '[]'::jsonb;

-- market_issues: 이슈별 근거 기사. scan_market_issues.mjs 가 LLM 이 반환한
-- source_indices 로 [{url,title}] 를 채운다.
--   nullable 유지 - NULL = 이 컬럼 도입 이전 행, [] = 자동 귀속 실패, [{...}] = 성공.
--   이 3-state 를 UI 문구가 구분한다. NOT NULL 을 걸면 기존 행이 전부 위반된다.
alter table public.market_issues
  add column if not exists sources jsonb;


-- ─────────────────────────────────────────────────────────────
-- STEP 2  B. 리포트 섹션 제외
-- ─────────────────────────────────────────────────────────────

-- 제외할 섹션의 "원본 content_json.sections 배열 기준 0-based 인덱스" 목록.
-- 빈 배열 = 전체 발송. content_json 은 불변이라 인덱스가 안정적이다.
alter table public.reports
  add column if not exists excluded_sections int[] not null default '{}'::int[];


-- ─────────────────────────────────────────────────────────────
-- 롤백
--   alter table public.topic_candidates drop column if exists summary, drop column if exists sources;
--   alter table public.market_issues drop column if exists sources;
--   alter table public.reports drop column if exists excluded_sections;
--   (스크립트/렌더러 쪽 코드도 함께 되돌려야 함)
-- ─────────────────────────────────────────────────────────────
