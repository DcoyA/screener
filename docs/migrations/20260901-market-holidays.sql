-- docs/migrations/20260901-market-holidays.sql
--
-- scripts/lib/market-calendar.mjs 의 isMarketHoliday() 가 읽는 테이블.
--   select holiday_date from market_holidays where holiday_date = $1  (maybeSingle)
-- 이 테이블은 코드에 8/16부터 참조돼 있었으나 실제로 만들어진 적이 없었다.
-- 조회 에러를 삼키던(const { data } = ...) 예전 구현이 그 사실을 감췄고,
-- fbf04a3 에서 조회 에러를 throw 로 바꾸자 적재/검증 잡이 전부
-- "Could not find the table 'public.market_holidays'" 로 실패했다.
--
-- 실행은 사용자가 직접 한다 (스크립트가 자동으로 실행하지 않음).
-- create table if not exists + on conflict do nothing 이라 여러 번 실행해도 안전하다.
--
-- 데이터 규칙:
--   - "평일 휴장일"만 담는다. 토/일은 scripts/lib/market-calendar.mjs 의
--     isWeekendKst()(= kstWeekday())가 이미 처리하므로 넣지 않는다.
--   - KRX 휴장일 = 법정공휴일 + 대체공휴일 + 임시공휴일(선거일) + 근로자의 날
--     + 연말 휴장일. 근로자의 날/연말 휴장은 법정공휴일이 아니지만 증시는 닫는다.
--   - 대체공휴일 산정과 연말 폐장 여부는 공식 자료(공휴일 목록 + KRX 시장운영
--     일정)로 대조해서 넣었다. 확정 못 한 날짜는 넣지 않고 아래 TODO로 남긴다.

create table if not exists public.market_holidays (
  holiday_date date primary key,
  name         text,
  source       text not null default 'manual',
  created_at   timestamptz not null default now()
);

-- 2026년 평일 휴장일 (출처: publicholidays.co.kr / daouoffice HR / jangjeon.kr KRX 휴장 목록 교차 확인)
insert into public.market_holidays (holiday_date, name, source) values
  ('2026-01-01', '신정',                              'krx-2026'),
  ('2026-02-16', '설날 연휴',                          'krx-2026'),
  ('2026-02-17', '설날',                              'krx-2026'),
  ('2026-02-18', '설날 연휴',                          'krx-2026'),
  ('2026-03-02', '삼일절 대체공휴일 (3/1 일요일)',       'krx-2026'),
  ('2026-05-01', '근로자의 날 (증시 휴장, 법정공휴일 아님)', 'krx-2026'),
  ('2026-05-05', '어린이날',                           'krx-2026'),
  ('2026-05-25', '부처님오신날 대체공휴일 (5/24 일요일)', 'krx-2026'),
  ('2026-06-03', '제9회 전국동시지방선거 (임시공휴일)',   'krx-2026'),
  ('2026-07-17', '제헌절 (2026년 공휴일 재지정)',        'krx-2026'),
  ('2026-08-17', '광복절 대체공휴일 (8/15 토요일)',      'krx-2026'),
  ('2026-09-24', '추석 연휴',                          'krx-2026'),
  ('2026-09-25', '추석',                              'krx-2026'),
  ('2026-10-05', '개천절 대체공휴일 (10/3 토요일)',      'krx-2026'),
  ('2026-10-09', '한글날',                             'krx-2026'),
  ('2026-12-25', '성탄절',                             'krx-2026'),
  ('2026-12-31', '연말 휴장 (증시 폐장, 법정공휴일 아님)', 'krx-2026')
on conflict (holiday_date) do nothing;

-- TODO 확인필요 — 넣지 않았다. 확정되면 위 insert 에 한 줄 추가:
--   2026-09-28 (월) 추석 대체공휴일. 추석 연휴 3일째(9/26)가 토요일이라
--   대체공휴일 법상 9/28(월)이 지정될 가능성이 높으나, 조회한 어느 공식/증시
--   달력에도 아직 명시돼 있지 않다. 지정 확인 후 추가할 것.
--   (누락 시 영향: 9/28 하루만 verify 가 거짓 실패하고 ingest 가 스킵 안 됨.
--    빈 값보다 틀린 값이 위험하므로 확인 전엔 넣지 않는다.)

-- 검증 쿼리 (적용 후):
--   select count(*), min(holiday_date), max(holiday_date) from public.market_holidays;
--     기대: 17 / 2026-01-01 / 2026-12-31
--   select * from public.market_holidays order by holiday_date;
