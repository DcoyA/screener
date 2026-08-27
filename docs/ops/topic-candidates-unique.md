# topic_candidates 유니크 제약 적용 절차

STEP 9에서 추가. 프리미엄 수집(collect) 워크플로를 실패 지점부터 재실행해도
`topic_candidates` 후보 행이 중복 증식하지 않게 하는 유니크 제약을 건다.

- 마이그레이션 SQL: `docs/migrations/20260827-topic-candidates-unique-key.sql`
- 키: `(target_issue_date, day_type, source, title_key)`
- `title_key` = `title` 을 정규화한 **GENERATED STORED** 컬럼 (DB가 단일 소스, JS에 정규화 코드 없음)

## 왜 필요한가

`generate-topic-candidates.mjs` 는 재실행 시 `(target_issue_date, day_type)` 배치가
있으면 스킵하는 가드가 이미 있다. 하지만 그 조회와 insert 사이의 경쟁,
`FORCE=1` 강제 재생성, 부분 실패 후 재시도에서는 중복이 들어갈 수 있다.
유니크 인덱스 + `upsert(..., { ignoreDuplicates: true })` 로 DB에서 원자적으로 막는다.

## 적용 순서 (Supabase SQL Editor)

SQL 파일의 STEP 0 → 5 를 **순서대로, 각 STEP 결과를 확인하며** 실행한다.
파이프라인이 도는 시간대(KST 새벽)는 피한다.

| STEP | 내용 | 게이트 |
|---|---|---|
| 0 | 조회만 (버전 / nullable / day_type 분포 / source NULL 수) | 결과가 SQL 주석의 "기대"와 다르면 멈추고 검토 |
| 1 | `title_key` GENERATED 컬럼 추가 | STEP 0 확인 후. 테이블 재작성 락 발생(행 수 적어 순식간) |
| 2 | 중복 현황 조회 (4-키 group by having count>1) | **서로 다른 이슈가 같은 title_key 로 묶이면 STEP 3 이후 중단**하고 보고 |
| 3 | 중복 행 삭제 (id 큰 것만 남김) | STEP 2가 0건이면 **건너뜀**. 파괴적 - 백업 권장 |
| 4 | `source` NOT NULL 전환 | STEP 0-d 의 `source_null_rows` 가 0일 때만 |
| 5 | 유니크 인덱스 생성 | STEP 3(중복 0) + STEP 4 완료 후 |

## 스크립트 쪽 동작 (이미 반영됨, `generate-topic-candidates.mjs`)

- insert → `upsert(rows, { onConflict: "target_issue_date,day_type,source,title_key", ignoreDuplicates: true })`
  = **DO NOTHING**. 반려/편집된 기존 행을 재제안이 덮어쓰지 않는다.
- 이미 존재해 건너뛴 건수는 로그로 남는다 (`N건은 이미 존재해 건너뜀`).
- **유니크 제약이 아직 없으면**(STEP 5 미실행): upsert 가 `42P10` 으로 실패하고,
  스크립트는 "마이그레이션 필요" 메시지와 함께 **종료 코드 1(치명, 재시도 불가)** 로 죽는다.
  → 즉 SQL 을 적용하기 전에 배포하면 이 스텝이 바로 실패해서 문제를 알려준다.
- `source` 가 빈 후보가 있으면 저장 전에 중단한다(STEP 4 NOT NULL 대비).

## 롤백

```sql
drop index if exists public.topic_candidates_issue_daytype_source_titlekey_uidx;
alter table public.topic_candidates alter column source drop not null;
alter table public.topic_candidates drop column if exists title_key;
```
그리고 `generate-topic-candidates.mjs` 의 `.upsert(...)` 를 `.insert(rows)` 로 되돌린다
(유니크 인덱스가 없으면 `.upsert` 가 42P10 으로 죽으므로).

## 정규화 규칙을 바꾸려면

`title_key` 는 GENERATED 컬럼이라 식을 `ALTER` 로 못 바꾼다.
**컬럼 DROP → 새 식으로 재생성 → 유니크 인덱스 재작성** 이 필요하다.
규칙(구두점 제거 + 공백 1칸 + 트림 + 소문자)은 한 번 정하면 고정한다고 보고 시작한다.
