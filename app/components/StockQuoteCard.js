"use client";

import Link from "next/link";
import { cleanStockName } from "../lib/stockName";
import {
  buildQuoteView,
  formatWon,
  formatSignedWon,
  formatSignedPct,
  formatVolume,
  formatMoney,
} from "../lib/quoteCard";

// 기획서의 삼성전자 카드. name/market/code + snapshot 을 받아
// quoteCard.buildQuoteView 로 검증한 뒤 렌더한다.
// - 가드1: 등락률/전일대비 재계산값만 표시
// - 가드2: 정합성 깨지면 시세 블록 대신 "시세 데이터 확인 중"
// - 가드3: |등락률| > 30% → 액면분할/병합 경고 배지
// - 가드4: 상승 --signal-up / 하락 --signal-down / 보합 --signal-flat (루비색 금지)
export default function StockQuoteCard({ name, market, code, snapshot, showDetailLink = true }) {
  const view = buildQuoteView({ name, market, code, snapshot });
  const arrow = view.direction === "up" ? "▲" : view.direction === "down" ? "▼" : "–";

  return (
    <div className="quoteCard">
      <div className="quoteHead">
        <div className="quoteName">{cleanStockName(view.name) || code}</div>
        <div className="quoteMeta">
          {view.market ? `${view.market} · ${code}` : code}
        </div>
      </div>

      {!view.consistent ? (
        <p className="quoteUnavailable">{view.reason}</p>
      ) : (
        <>
          <div className="quotePriceRow">
            <span className="quotePrice">{formatWon(view.price)}</span>
            <span className={`quoteChange dir-${view.direction}`}>
              {arrow} {formatSignedWon(view.change)} ({formatSignedPct(view.rate)})
            </span>
            {view.splitWarning && (
              <span className="quoteSplitBadge" title="등락률이 30%를 넘어 액면분할·병합 가능성이 있습니다.">
                액면분할·병합 가능성
              </span>
            )}
          </div>

          <dl className="quoteGrid">
            <div><dt>전일종가</dt><dd>{formatWon(view.prevClose)}</dd></div>
            <div><dt>시가</dt><dd>{formatWon(view.open)}</dd></div>
            <div><dt>고가</dt><dd>{formatWon(view.high)}</dd></div>
            <div><dt>저가</dt><dd>{formatWon(view.low)}</dd></div>
            <div><dt>거래량</dt><dd>{formatVolume(view.volume)}</dd></div>
            <div><dt>거래대금</dt><dd>{formatMoney(view.tradeValue)}</dd></div>
          </dl>
        </>
      )}

      {showDetailLink && code && (
        <Link href={`/stock/${code}`} className="quoteDetailLink">
          이 종목 상세 분석 보기 →
        </Link>
      )}

      <style jsx>{`
        .quoteCard {
          border: 1px solid var(--ink-300);
          border-radius: var(--radius-card);
          background: #ffffff;
          box-shadow: var(--shadow-card);
          padding: 22px;
        }
        .quoteHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .quoteName {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--ink-900);
          letter-spacing: -0.02em;
        }
        .quoteMeta {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--ink-600);
        }
        .quoteUnavailable {
          margin: 18px 0 0;
          padding: 18px;
          border-radius: 12px;
          background: var(--page-bg);
          color: var(--ink-600);
          font-weight: 700;
          text-align: center;
        }
        .quotePriceRow {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }
        .quotePrice {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--ink-900);
          letter-spacing: -0.03em;
        }
        .quoteChange {
          font-size: 0.98rem;
          font-weight: 800;
        }
        .quoteChange.dir-up {
          color: var(--signal-up);
        }
        .quoteChange.dir-down {
          color: var(--signal-down);
        }
        .quoteChange.dir-flat {
          color: var(--signal-flat);
        }
        .quoteSplitBadge {
          font-size: 0.75rem;
          font-weight: 800;
          color: #8a5a00;
          background: #fff3d6;
          border: 1px solid #f0c869;
          border-radius: 999px;
          padding: 3px 10px;
        }
        .quoteGrid {
          margin: 18px 0 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px 14px;
        }
        .quoteGrid div {
          border-top: 1px solid var(--ink-300);
          padding-top: 8px;
        }
        .quoteGrid dt {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--ink-600);
          margin-bottom: 3px;
        }
        .quoteGrid dd {
          margin: 0;
          font-size: 0.98rem;
          font-weight: 800;
          color: var(--ink-900);
        }
        .quoteDetailLink {
          display: inline-block;
          margin-top: 18px;
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--ruby-700);
          text-decoration: none;
        }
        .quoteDetailLink:hover {
          text-decoration: underline;
        }
        @media (max-width: 480px) {
          .quoteGrid {
            grid-template-columns: repeat(2, 1fr);
          }
          .quotePrice {
            font-size: 1.6rem;
          }
        }
      `}</style>
    </div>
  );
}
