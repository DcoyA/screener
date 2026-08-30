"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cleanStockName } from "../../lib/stockName";
import {
  fetchQuoteSnapshot,
  buildQuoteView,
  formatWon,
  formatSignedWon,
  formatSignedPct,
  formatVolume,
  formatMoney,
} from "../../lib/quoteCard";
import GradeBadge from "../GradeBadge";
import { getUnifiedGrade } from "../../lib/grade";
import { formatScoreRank, scoreColor } from "../../lib/scoreStats";
import { formatUpsideDisplay } from "../../lib/formatUpside";
import {
  getFairValueStatus,
  isFairValueOk,
  fairValueStatusLabel,
  formatPriceBand,
} from "../../lib/fairValue";

const QUOTE_TIMEOUT_MS = 10000;

// 상세 페이지(app/stock/[code]) formatRatio와 동일: 유한값이면 소수1자리 %, 아니면 "-".
function formatRatio(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(1)}%`;
}

// PER/PBR: 양수면 "N배". 적자(≤0)면 상세 페이지 문구("적자 상태라 …")에 준해 "적자",
// 결측이면 "-". 빈칸/0을 내보내지 않는다.
function formatMultiple(value, digits) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  if (num <= 0) return "적자";
  return `${num.toFixed(digits)}배`;
}

// 홈 검색 영역이 무입력일 때 띄우는 예시 카드. 검색하면 무엇이 나오는지 미리 보여준다.
// - 해석(점수·등급·PER·PBR·부채비율·적정가·상승여력)은 stocks.json + 상세 페이지와
//   동일한 공유 함수로 계산한다(getUnifiedGrade / scoreStats / formatUpside / fairValue).
//   홈 전용 재계산 없음 → /stock/[code]와 숫자가 어긋나지 않는다.
// - 시세는 라이브(fetchQuoteSnapshot). 정합성·액면분할 경고는 buildQuoteView가 처리.
// - 위계: 해석을 크게, 시세를 작게. 시세는 어디서나 보지만 해석은 우리만 준다.
export default function SearchPreviewCard({ stock }) {
  const [quoteState, setQuoteState] = useState("loading"); // loading | ready | error
  const [snapshot, setSnapshot] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!stock?.code) return undefined;
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);

    setQuoteState("loading");
    fetchQuoteSnapshot(stock.code, { signal: controller.signal })
      .then((data) => {
        setSnapshot(data.snapshot);
        setQuoteState("ready");
      })
      .catch(() => setQuoteState("error"))
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [stock?.code]);

  if (!stock) return null;

  const grade = getUnifiedGrade(stock);
  const score = stock?.finalPickMeta?.finalScore;
  const fvOk = isFairValueOk(stock);
  const fvStatus = getFairValueStatus(stock);
  const m = stock.metrics || {};

  const bandText = fvOk
    ? formatPriceBand(m.targetPriceConservative ?? m.targetPrice, m.targetPriceOptimistic ?? m.targetPrice)
    : fairValueStatusLabel(fvStatus);
  const upsideText = fvOk ? formatUpsideDisplay(stock) : "산출 보류";

  const view =
    quoteState === "ready"
      ? buildQuoteView({ name: stock.name, market: stock.market, code: stock.code, snapshot })
      : null;
  const arrow = view?.direction === "up" ? "▲" : view?.direction === "down" ? "▼" : "–";

  return (
    <div className="previewCard">
      <div className="previewHead">
        <div>
          <p className="previewEyebrow">이렇게 분석해 드려요</p>
          <div className="previewName">{cleanStockName(stock.name)}</div>
          <div className="previewMeta">{stock.market ? `${stock.market} · ${stock.code}` : stock.code}</div>
        </div>
        <Link href={`/stock/${stock.code}`} className="previewDetailBtn">
          상세보기
        </Link>
      </div>

      {/* 해석 - 크게 */}
      <div className="previewInsight">
        <GradeBadge grade={grade} />
        <p className="previewScore" style={{ color: scoreColor(score) }}>
          종합판단점수 {formatScoreRank(score)}
        </p>
        <div className="previewValueRow">
          <div className="previewValueBox">
            <span>적정가 추정(보수~낙관)</span>
            <strong>{bandText}</strong>
          </div>
          <div className="previewValueBox">
            <span>상승여력</span>
            <strong>{upsideText}</strong>
          </div>
        </div>
        <div className="previewChips">
          <span className="previewChip">PER {formatMultiple(m.per, 1)}</span>
          <span className="previewChip">PBR {formatMultiple(m.pbr, 2)}</span>
          <span className="previewChip">부채비율 {formatRatio(m.debtRatio)}</span>
        </div>
      </div>

      {/* 시세 - 작게 */}
      <div className="previewQuote">
        {quoteState === "loading" && <p className="previewQuoteMsg">시세 불러오는 중…</p>}
        {quoteState === "error" && <p className="previewQuoteMsg">시세 데이터 확인 중</p>}
        {quoteState === "ready" && view && !view.consistent && (
          <p className="previewQuoteMsg">{view.reason}</p>
        )}
        {quoteState === "ready" && view && view.consistent && (
          <>
            <div className="previewQuoteTop">
              <span className="previewQuotePrice">{formatWon(view.price)}</span>
              <span className={`previewQuoteChange dir-${view.direction}`}>
                {arrow} {formatSignedWon(view.change)} ({formatSignedPct(view.rate)})
              </span>
              {view.splitWarning && <span className="previewSplitBadge">액면분할·병합 가능성</span>}
            </div>
            <dl className="previewQuoteGrid">
              <div><dt>전일</dt><dd>{formatWon(view.prevClose)}</dd></div>
              <div><dt>시가</dt><dd>{formatWon(view.open)}</dd></div>
              <div><dt>고가</dt><dd>{formatWon(view.high)}</dd></div>
              <div><dt>저가</dt><dd>{formatWon(view.low)}</dd></div>
              <div><dt>거래량</dt><dd>{formatVolume(view.volume)}</dd></div>
              <div><dt>거래대금</dt><dd>{formatMoney(view.tradeValue)}</dd></div>
            </dl>
          </>
        )}
      </div>

      <style jsx>{`
        .previewCard {
          margin-top: 16px;
          max-width: 640px;
          border: 1px solid var(--ink-300);
          border-radius: var(--radius-card);
          background: #fff;
          box-shadow: var(--shadow-card);
          padding: 22px;
        }
        .previewHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .previewEyebrow {
          margin: 0 0 6px;
          font-size: var(--font-caption);
          font-weight: 800;
          color: var(--ruby-700);
        }
        .previewName {
          font-size: var(--font-title);
          font-weight: 800;
          color: var(--ink-900);
          letter-spacing: -0.02em;
        }
        .previewMeta {
          margin-top: 2px;
          font-size: var(--font-caption);
          font-weight: 700;
          color: var(--ink-600);
          font-variant-numeric: tabular-nums;
        }
        .previewDetailBtn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          padding: 9px 16px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--ruby-700);
          background: #fff;
          color: var(--ruby-700);
          font-weight: 800;
          font-size: var(--font-caption);
          text-decoration: none;
        }
        .previewDetailBtn:hover {
          background: var(--ruby-50);
        }

        /* ── 해석: 크게 ─────────────────────────────── */
        .previewInsight {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .previewScore {
          margin: 0;
          font-size: var(--font-title);
          font-weight: 800;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .previewValueRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .previewValueBox {
          border: 1px solid var(--ink-200);
          border-radius: 14px;
          padding: 12px 14px;
          background: var(--ruby-50);
        }
        .previewValueBox span {
          display: block;
          margin-bottom: 4px;
          font-size: var(--font-caption);
          font-weight: 700;
          color: var(--ink-600);
        }
        .previewValueBox strong {
          font-size: var(--font-body);
          font-weight: 800;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .previewChips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .previewChip {
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          background: var(--ruby-100);
          color: var(--ruby-700);
          font-size: var(--font-body);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        /* ── 시세: 작게 ─────────────────────────────── */
        .previewQuote {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid var(--ink-200);
        }
        .previewQuoteMsg {
          margin: 0;
          font-size: var(--font-caption);
          font-weight: 700;
          color: var(--ink-600);
        }
        .previewQuoteTop {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }
        .previewQuotePrice {
          font-size: var(--font-body);
          font-weight: 800;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .previewQuoteChange {
          font-size: var(--font-caption);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .previewQuoteChange.dir-up {
          color: var(--signal-up);
        }
        .previewQuoteChange.dir-down {
          color: var(--signal-down);
        }
        .previewQuoteChange.dir-flat {
          color: var(--signal-flat);
        }
        .previewSplitBadge {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--warn-600);
          background: var(--warn-bg);
          border-radius: 999px;
          padding: 3px 9px;
        }
        .previewQuoteGrid {
          margin: 10px 0 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px 12px;
        }
        .previewQuoteGrid div {
          display: flex;
          justify-content: space-between;
          gap: 6px;
        }
        .previewQuoteGrid dt {
          font-size: var(--font-caption);
          font-weight: 700;
          color: var(--ink-600);
        }
        .previewQuoteGrid dd {
          margin: 0;
          font-size: var(--font-caption);
          font-weight: 800;
          color: var(--ink-600);
          font-variant-numeric: tabular-nums;
        }
        @media (max-width: 480px) {
          .previewValueRow {
            grid-template-columns: 1fr;
          }
          .previewQuoteGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
