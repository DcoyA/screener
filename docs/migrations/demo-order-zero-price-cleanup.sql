-- docs/migrations/demo-order-zero-price-cleanup.sql
--
-- 모의투자(/demo-trade)에서 시세가 0/결측인 상태로 "가상 매수"가 눌려
-- 0원 체결이 virtual_transactions 에 쌓였을 수 있다. 이 커밋에서 프론트/서버
-- 양쪽에 price > 0 가드를 넣었지만, 이미 들어간 오염 데이터는 이 SQL로
-- 정리한다. 실행은 사용자가 직접 한다(로컬에서 DB 조회 권한 없음).
--
-- 순서대로 실행하고, 1)로 영향 범위를 먼저 확인한 뒤 2)/3)을 돌린다.

-- 1) 오염 행 확인 (삭제 전 반드시 눈으로 본다)
SELECT account_id, count(*) AS bad_rows, min(executed_at) AS first_seen, max(executed_at) AS last_seen
FROM virtual_transactions
WHERE price IS NULL OR price <= 0
GROUP BY account_id
ORDER BY bad_rows DESC;

-- 2) 오염 행 삭제
--    0원 체결은 매수금액 0 / 수량만 늘린 형태라, 보유수량·평단이 왜곡된다.
DELETE FROM virtual_transactions
WHERE price IS NULL OR price <= 0;

-- 3) 영향받은 계좌의 현금/보유를 재계산한다.
--    virtual_holdings 를 별도 테이블로 관리한다면(누적 캐시), 아래처럼
--    거래 이력에서 다시 집계해 덮어쓴다. (execute_virtual_order RPC가
--    현금을 트랜잭션마다 갱신하는 구조라면, 0원 거래는 현금을 안 깎았을
--    가능성이 높으니 현금은 그대로 두고 보유수량만 재집계하면 된다 —
--    실제 스키마에 맞춰 조정할 것.)
--
--    예시(보유수량/매수금액 재집계):
-- WITH agg AS (
--   SELECT account_id, code,
--          sum(CASE WHEN side = 'buy'  THEN quantity ELSE -quantity END) AS net_qty,
--          sum(CASE WHEN side = 'buy'  THEN amount   ELSE 0 END)
--        - sum(CASE WHEN side = 'sell' THEN amount   ELSE 0 END)          AS net_buy_amount
--   FROM virtual_transactions
--   GROUP BY account_id, code
-- )
-- UPDATE virtual_holdings h
-- SET quantity = a.net_qty,
--     buy_amount = GREATEST(a.net_buy_amount, 0)
-- FROM agg a
-- WHERE h.account_id = a.account_id AND h.code = a.code;
-- DELETE FROM virtual_holdings WHERE quantity <= 0;

-- 4) 재발 방지: 컬럼 제약 (스키마 정책상 가능하면)
-- ALTER TABLE virtual_transactions
--   ADD CONSTRAINT virtual_transactions_price_positive CHECK (price > 0);
