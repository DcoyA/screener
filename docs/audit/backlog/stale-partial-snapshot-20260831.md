# 2026-08-31 부분적재 25건 — 정리 후보 (지금 삭제 금지)

기록일: 2026-09-01. 조사·기록만. 삭제/수정은 STEP 2.5 판정 후 별도로 판단한다.

## 무슨 일

`market_holidays` 테이블 부재로 `ingest-daily-snapshot.mjs` 가 8/31~9/1
전 실행에서 즉시 크래시했다(자세한 건 [P0-pipeline-reliability](../P0-pipeline-reliability.md)
쪽 후속). 9/1 Verify #20 로그에 이런 줄이 남았다:

```
[검증] 직전 데이터 날짜(2026-08-31) 행 수: 25, 오늘 대비 비율: 2000.0%
```

8/31은 월요일(거래일)이라 정상이면 500건이어야 한다. Weekday JSON Update
#78(8/31 14:25, 19분 성공) 이 만든 데이터가 `stock_daily_snapshots` /
`latest_stock_snapshots` 에 **25건만** 반영돼 있다. (#79는 0분짜리 스킵,
#80~82는 21분에 ingest 크래시.) 25건짜리 부분 스냅샷의 정확한 유입 경로는
미확정 — #78 ingest 로그를 다시 확인해야 한다.

## 함의 2가지

1. **Verify 의 직전일 비율 검사는 단방향이다.**
   `verify-today-ingested.mjs` 의 `PREV_DAY_COUNT_RATIO_MIN` 체크는
   `ratio = todayCount / prevCount` 가 하한 미만일 때만 실패한다. 오늘이
   많으면(500/25 = 2000%) 무조건 통과하므로, **직전일의 부분적재를 못 잡는다.**
   상류 부분적재를 잡으려면 "직전 거래일 건수가 기대치(≈500) 대비 급감"도
   같이 봐야 한다.

2. **4주 전 등급 조회가 이 날을 집을 수 있다.**
   `generate-report.mjs` 의 `fetchRelatedStockDetails()` 는
   `stock_daily_snapshots` 를 `.lte("snapshot_date", cutoff).order(desc)` 로
   훑어 cutoff 이하 가장 최근 행을 쓴다. 적재 이력이 28일을 넘기는 9/28경,
   cutoff 가 8/31 근처를 가리키면 **25건짜리 이 날이 기준일로 뽑혀** 대부분
   종목에서 "해당 종목 데이터 없음" (또는 소수 종목만 값) 이 나온다.

## 지금 하지 않는 이유

25건짜리 8/31 행에 다른 로직(백테스트/성과 집계 등)이 의존하는지 미확인.
`history.json` 기반 성과 집계는 이 테이블을 안 쓰지만 전수 확인은 안 했다.
지우기 전에 의존성부터 확인한다.

## 정리 시 후보안

- (a) `delete from stock_daily_snapshots where snapshot_date = '2026-08-31'`
  후 8/31 데이터를 #78 산출물로 재적재 (stocks.json 8/31분이 남아 있으면).
- (b) 그냥 삭제만 (8/31 하루 구멍 감수 — 9/28경 4주전등급 오염만 막으면 됨).
- (c) 4주전등급 조회에 "행 수가 기대치의 N% 미만인 snapshot_date 는 건너뛴다"
  가드를 넣어 부분적재 날짜를 자동 회피 (더 일반적이지만 범위 큼).
