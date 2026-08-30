-- docs/migrations/20260828-report-subscribers-user-id.sql
--
-- 목적: report_subscribers 행을 auth.users 계정과 nullable FK(user_id)로 잇는다.
--   지금은 "이 로그인 사용자가 구독자인가?"를 이메일 문자열 매칭으로만 판정할 수
--   있는데(카카오 이메일 ≠ 신청 이메일이면 깨짐), 이 컬럼이 있으면 계정 기준으로
--   판정할 수 있고 나중에 결제/entitlement의 토대가 된다.
--
-- 쓰는 곳(마이페이지 확장, 별도 스프린트):
--   - /me "리포트 히스토리": 활성 구독자에게만 status='sent' 리포트 전체를 노출.
--     (누가 받았는지는 안 남긴다 - 3주차 가입자도 1·2주차 리포트를 봐야 한다.)
--   - /me "프리미엄 구독 현황": 구독 여부/최근 수신일/구독취소 링크.
--   - app/lib/reportAccess.js 의 session 분기(현재 파일 내 TODO)가 이 값을 읽는다.
--
-- 지속 반영: 로그인 콜백(app/auth/callback/route.js)이 로그인 때마다
--   email 일치하고 user_id 가 비어 있는 구독행에 user_id 를 채운다(스프린트 2).
--   이 SQL 은 그 이전 가입자를 위한 1회성 백필까지 포함한다.
--
-- 실행: 사용자가 Supabase SQL Editor에서 STEP 순서대로 직접 실행. 각 STEP은
--   이전 STEP 결과를 눈으로 확인한 뒤 다음으로. 순수 추가(ADD COLUMN IF NOT
--   EXISTS)라 파이프라인·기존 앱 동작에 영향 없음 - 컬럼이 없으면 앱은 기존처럼
--   이메일 매칭으로 폴백한다.
--
-- 롤백: STEP 1~3 역순. 인덱스 DROP → 컬럼 DROP. 데이터 유실은 user_id 매핑뿐이고
--   로그인 시 다시 채워진다.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0  (조회만, 무해) — 먼저 실행하고 결과를 확인.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0-a) report_subscribers 현재 컬럼 (user_id 가 이미 있으면 STEP 1 건너뛴다)
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'report_subscribers'
 order by ordinal_position;

-- 0-b) 행 수 / 상태 분포
select status, count(*) from report_subscribers group by status;

-- 0-c) 이메일이 auth.users 와 매칭되는 구독행 수 (STEP 3 백필 커버리지 예상)
select
  count(*)                                             as subscribers_total,
  count(*) filter (where u.id is not null)             as matchable_by_email,
  count(*) filter (where u.id is null)                 as no_matching_account
from report_subscribers rs
left join auth.users u on lower(u.email) = lower(rs.email);

-- 0-d) email 이 report_subscribers 안에서 유니크한지 (STEP 2의 user_id unique 전제)
select rs.email, count(*)
  from report_subscribers rs
 group by rs.email
having count(*) > 1;
--   ▸ 결과가 0행이어야 한다. 1행 이상이면 먼저 중복 이메일을 정리하고
--     (status='unsubscribed' 쪽을 삭제하거나 병합) STEP 2의 UNIQUE INDEX를
--     일반 INDEX로 낮춘다.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — user_id 컬럼 추가 (nullable FK).
--   ON DELETE SET NULL: 계정 탈퇴(스프린트 5) 시 구독행은 남기고 링크만 끊는다.
--   이메일 구독은 계정과 별개다(탈퇴 UI가 "구독은 따로 해지" 안내를 한다).
-- ─────────────────────────────────────────────────────────────────────────────

alter table report_subscribers
  add column if not exists user_id uuid references auth.users(id) on delete set null;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — 인덱스.
--   user_id 조회(로그인 사용자 → 구독행)와 email 조회(기존 subscribe/unsubscribe)
--   둘 다 자주 쓰인다.
-- ─────────────────────────────────────────────────────────────────────────────

-- user_id 는 채워졌을 때 계정당 1행이어야 한다(STEP 0-d 통과 전제).
create unique index if not exists report_subscribers_user_id_key
  on report_subscribers (user_id)
  where user_id is not null;

-- 기존 이메일 조회 경로도 인덱스로. (이미 있으면 IF NOT EXISTS 로 무시됨)
create index if not exists report_subscribers_email_idx
  on report_subscribers (lower(email));


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — 1회성 백필: 이메일이 정확히 일치하는 auth.users 로 user_id 채우기.
--   대소문자 무시. 이미 채워진 행(user_id is not null)은 건드리지 않는다.
--   여기서 못 채운 행은 해당 사용자가 다음에 로그인할 때 콜백이 채운다.
-- ─────────────────────────────────────────────────────────────────────────────

update report_subscribers rs
   set user_id = u.id
  from auth.users u
 where lower(u.email) = lower(rs.email)
   and rs.user_id is null;

-- 검증: 백필 후 상태
select
  count(*)                                   as total,
  count(*) filter (where user_id is not null) as linked,
  count(*) filter (where user_id is null)     as unlinked
from report_subscribers;
