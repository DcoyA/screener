-- docs/migrations/20260827-topic-candidates-unique-key.sql
--
-- 목적: topic_candidates 에 유니크 제약을 걸어, 프리미엄 수집(collect) 워크플로를
--       실패 지점부터 통째로 재실행해도 후보 행이 증식하지 않게 한다(STEP 9).
--
-- 키 조합: (target_issue_date, day_type, source, title_key)
--   - day_type 포함 이유: FORCE_DAY_TYPE 검증 실행 시 같은 날짜에 서로 다른
--     day_type 배치가 정당하게 공존할 수 있고, generate-topic-candidates.mjs 의
--     기존 스킵 가드도 (target_issue_date, day_type) 를 배치 정체성으로 쓴다.
--   - title 원문 대신 title_key: LLM 생성 제목은 공백/따옴표/말머리 차이로 값이
--     흔들린다. 정규화값을 GENERATED STORED 컬럼으로 만들어 DB를 단일 소스로 둔다
--     (JS 쪽에 정규화 코드를 만들지 않는다 = 드리프트 원천 차단).
--
-- 실행: 사용자가 Supabase SQL Editor에서 STEP 순서대로 직접 실행한다.
--       각 STEP은 "이전 STEP 완료 확인 후" 실행할 것. 파이프라인 실행 시간대는 피한다.
--
-- ⚠ 정규화 규칙(STEP 1의 식)을 나중에 바꾸려면 title_key 컬럼 DROP 후 재생성 +
--   유니크 인덱스 재작성이 필요하다. 규칙은 한 번 정하면 고정한다고 보고 시작한다.
--   롤백 절차는 docs/ops/topic-candidates-unique.md 참고.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0  (조회만, 무해) — 먼저 실행하고 결과를 확인한 뒤 STEP 1로.
--   이 마이그레이션은 아래 가정 위에서 작성됐다. 결과가 다르면 STEP 1 이후를
--   조정해야 하므로 반드시 눈으로 본다.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0-a) Postgres 버전 (NULLS NOT DISTINCT 사용 여부 판단용. 아래 설계는 안 씀)
show server_version;

-- 0-b) 키 컬럼 nullable / 기본값
select column_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'topic_candidates'
   and column_name in ('target_issue_date', 'day_type', 'source', 'title');
--   기대: target_issue_date NOT NULL, day_type NOT NULL, title NOT NULL,
--        source 는 YES(나중에 추가된 컬럼)일 수 있음 → STEP 4에서 NOT NULL 전환.
--   ▸ title 이 nullable(YES)이면: STEP 1의 식을 coalesce(title, '') 로 감싸고,
--     "빈 제목끼리는 같은 title_key 로 뭉쳐진다"는 점을 감수한다(그런 행은 애초에
--     비정상이므로 유니크로 1건만 남는 게 오히려 낫다). 이 경우 STEP 1 주석 참고.

-- 0-c) day_type 실제 저장값 (유한 집합인지 = CHECK 제약이 유효한지 확인)
select day_type, count(*) from public.topic_candidates group by 1 order by 1;
--   기대: mon / tue / thu / fri 뿐. (topic_candidates_day_type_check 제약 존재)

-- 0-d) source NULL 행 수 (STEP 4에서 NOT NULL 걸기 전에 0이어야 함)
select count(*) as source_null_rows
  from public.topic_candidates
 where source is null;
--   ▸ 0이 아니면: STEP 4 실행 전에 그 행들의 source 를 채우거나(정확한 출처를
--     모르면) 삭제해야 한다. 먼저 보고할 것.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1  title_key 생성 컬럼 추가
--   ⚠ GENERATED STORED 컬럼 ADD는 테이블 재작성 + ACCESS EXCLUSIVE 락이다.
--     topic_candidates 는 행 수가 적어 순식간이지만, 프리미엄 파이프라인이
--     도는 시간대(KST 새벽)에는 실행하지 말 것.
--   ⚠ GENERATED 컬럼은 ADD 시점에 기존 전체 행이 자동 계산된다. 별도 백필 UPDATE
--     를 하면 안 된다("cannot insert a non-DEFAULT value into column" 에러).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.topic_candidates
  add column if not exists title_key text
  generated always as (
    lower(
      btrim(
        regexp_replace(
          regexp_replace(coalesce(title, ''), '[[:punct:]]+', '', 'g'),
          '\s+', ' ', 'g'
        )
      )
    )
  ) stored;
--   정규화 = 구두점 제거 → 연속 공백 1칸 → 앞뒤 트림 → 소문자화.
--   (title 이 STEP 0-b에서 NOT NULL로 확인되면 coalesce 는 no-op이고 그대로 둬도 무해)


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2  (조회만, 무해) 중복 현황 — STEP 1 완료 후 실행
--   서로 "다른 이슈"인데 같은 4-키로 묶이는 행이 보이면, 정규화가 과하게
--   뭉개는 것이다. 그 경우 STEP 3 이후를 실행하지 말고 보고할 것
--   (title_key 컬럼을 drop 하고 식을 다시 잡아야 함).
-- ─────────────────────────────────────────────────────────────────────────────

select target_issue_date, day_type, source, title_key, count(*) as dup_count,
       array_agg(id order by id) as ids,
       array_agg(title order by id) as titles
  from public.topic_candidates
 group by target_issue_date, day_type, source, title_key
having count(*) > 1
 order by dup_count desc, target_issue_date desc;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3  (파괴적) 중복 정리 — STEP 2 결과가 0건이면 건너뛴다.
--   같은 4-키 중 id 가장 큰(= 최신) 1건만 남기고 삭제.
--   실행 전 테이블 백업(또는 pg_dump) 권장.
-- ─────────────────────────────────────────────────────────────────────────────

-- 삭제 대상 미리보기 (먼저 실행해서 건수 확인):
-- select count(*) from public.topic_candidates t
--   using public.topic_candidates d
--  where t.target_issue_date = d.target_issue_date
--    and t.day_type = d.day_type
--    and t.source is not distinct from d.source
--    and t.title_key = d.title_key
--    and t.id < d.id;

delete from public.topic_candidates t
  using public.topic_candidates d
 where t.target_issue_date = d.target_issue_date
   and t.day_type = d.day_type
   and t.source is not distinct from d.source
   and t.title_key = d.title_key
   and t.id < d.id;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4  source 를 NOT NULL 로 — STEP 0-d 결과가 0일 때만 실행.
--   4개 키 컬럼이 모두 NOT NULL 이어야 유니크 인덱스가 NULL 구멍 없이 동작한다
--   (그래서 NULLS NOT DISTINCT / PG15 의존이 필요 없다).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.topic_candidates
  alter column source set not null;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5  유니크 인덱스 — STEP 3(중복 0건 확인) + STEP 4 완료 후.
--   ON CONFLICT 는 제약이든 유니크 인덱스든 동일하게 동작한다.
--   IF NOT EXISTS 라 재실행해도 안전.
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists topic_candidates_issue_daytype_source_titlekey_uidx
  on public.topic_candidates (target_issue_date, day_type, source, title_key);


-- ─────────────────────────────────────────────────────────────────────────────
-- 롤백
--   drop index if exists public.topic_candidates_issue_daytype_source_titlekey_uidx;
--   alter table public.topic_candidates alter column source drop not null;
--   alter table public.topic_candidates drop column if exists title_key;
--   (generate-topic-candidates.mjs 의 .upsert 를 .insert 로 되돌려야 42P10이 안 난다)
-- ─────────────────────────────────────────────────────────────────────────────
