"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cleanStockName } from "../../lib/stockName";
import { percentileOf } from "../../lib/scoreStats";
import { getWishlist, getCurrentUser } from "../../lib/wishlist";

const PREVIEW_ROWS = 5;

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

// 스크리너 기본 정렬과 동일: topRankEligible 먼저, 그다음 totalScore 내림차순.
// (정렬 키는 내부값 totalScore를 쓰되, 표시 점수는 finalScore.)
function sortForDailyTop(stocks) {
  return [...stocks].sort((a, b) => {
    const ea = a?.rankMeta?.topRankEligible ? 1 : 0;
    const eb = b?.rankMeta?.topRankEligible ? 1 : 0;
    if (eb !== ea) return eb - ea;
    return Number(b?.totalScore ?? 0) - Number(a?.totalScore ?? 0);
  });
}

function ScoreCell({ score }) {
  const n = Number(score);
  if (!Number.isFinite(n)) return <span className="boardScore">-</span>;
  const pct = percentileOf(n);
  return (
    <span className="boardScore">
      <b>{Math.round(n)}점</b>
      {pct !== null ? <small>상위 {pct}%</small> : null}
    </span>
  );
}

function StockRow({ rank, code, name, market, price, score, onClick }) {
  return (
    <button type="button" className="boardRow" onClick={onClick}>
      {rank ? <span className="boardRank">{rank}</span> : null}
      <span className="boardNameCell">
        <span className="boardName">{cleanStockName(name)}</span>
        <span className="boardMeta">
          {market ? `${market} · ` : ""}
          {code}
        </span>
      </span>
      <span className="boardPrice">{formatPrice(price)}</span>
      {score !== undefined ? <ScoreCell score={score} /> : null}
    </button>
  );
}

function DailyTopColumn({ stocks }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const top = useMemo(() => sortForDailyTop(stocks).slice(0, 10), [stocks]);
  const rows = expanded ? top : top.slice(0, PREVIEW_ROWS);

  return (
    <div className="boardCard">
      <h2 className="boardTitle">데일리 Top 10</h2>
      <div className="boardHeadRow">
        <span>종목</span>
        <span>현재가</span>
        <span>종합판단점수</span>
      </div>
      <div className="boardList">
        {rows.map((s, i) => (
          <StockRow
            key={s.code}
            rank={i + 1}
            code={s.code}
            name={s.name}
            market={s.market}
            price={s?.metrics?.closePrice}
            score={s?.finalPickMeta?.finalScore}
            onClick={() => router.push(`/stock/${s.code}`)}
          />
        ))}
      </div>
      {!expanded && top.length > PREVIEW_ROWS ? (
        <button type="button" className="boardMore" onClick={() => setExpanded(true)}>
          더 보기 ({PREVIEW_ROWS}/{top.length})
        </button>
      ) : null}
    </div>
  );
}

function WatchlistColumn({ stocks }) {
  const router = useRouter();
  const stockMap = useMemo(() => new Map(stocks.map((s) => [String(s.code), s])), [stocks]);
  const [state, setState] = useState("loading"); // loading | anon | empty | ready
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await getCurrentUser();
      if (!alive) return;
      if (!user) {
        setState("anon");
        return;
      }
      const list = await getWishlist();
      if (!alive) return;
      setItems(list || []);
      setState((list || []).length ? "ready" : "empty");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rows = expanded ? items : items.slice(0, PREVIEW_ROWS);

  let body;
  if (state === "loading") {
    body = <p className="boardEmpty">불러오는 중…</p>;
  } else if (state === "anon") {
    body = (
      <div className="boardEmptyBox">
        <p>관심종목을 저장하면 여기서 한눈에 봅니다.</p>
        <Link href="/me" className="boardEmptyLink">
          로그인하기
        </Link>
      </div>
    );
  } else if (state === "empty") {
    body = (
      <div className="boardEmptyBox">
        <p>아직 담은 관심종목이 없어요.</p>
        <Link href="/screener?tab=ranking" className="boardEmptyLink">
          종목 찾아보기
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <div className="boardHeadRow twoCol">
          <span>종목</span>
          <span>현재가</span>
        </div>
        <div className="boardList">
          {rows.map((entry) => {
            const s = stockMap.get(String(entry.code));
            return (
              <StockRow
                key={entry.code}
                code={entry.code}
                name={s?.name || entry.name || entry.code}
                market={s?.market}
                price={s?.metrics?.closePrice}
                onClick={() => router.push(`/stock/${entry.code}`)}
              />
            );
          })}
        </div>
        {!expanded && items.length > PREVIEW_ROWS ? (
          <button type="button" className="boardMore" onClick={() => setExpanded(true)}>
            더 보기 ({PREVIEW_ROWS}/{items.length})
          </button>
        ) : null}
      </>
    );
  }

  // 비로그인/0건이면 대부분 비어 있을 영역이라 접어둔다(기본 닫힘).
  const collapsible = state === "anon" || state === "empty";

  if (collapsible) {
    return (
      <details className="boardCard watchlistCard collapsible">
        <summary className="boardTitle boardSummary">내 관심종목</summary>
        {body}
      </details>
    );
  }

  return (
    <div className="boardCard watchlistCard">
      <h2 className="boardTitle">내 관심종목</h2>
      {body}
    </div>
  );
}

export default function HomeBoardSection({ stocks = [] }) {
  return (
    <section className="homeBoard">
      <DailyTopColumn stocks={stocks} />
      <WatchlistColumn stocks={stocks} />

      {/* global: .board* 클래스는 자식 컴포넌트(DailyTopColumn/StockRow/ScoreCell)가
          렌더하므로 scoped(jsx)로는 스타일이 안 먹는다. */}
      <style jsx global>{`
        .homeBoard {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }
        .boardCard {
          border: 1px solid var(--ink-300);
          border-radius: var(--radius-card);
          background: #fff;
          padding: 20px;
        }
        .boardTitle {
          margin: 0 0 14px;
          font-size: var(--font-title);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ink-900);
        }
        .boardSummary {
          cursor: pointer;
          list-style: revert;
          margin: 0;
        }
        details.collapsible[open] .boardSummary {
          margin-bottom: 14px;
        }
        .boardHeadRow {
          display: grid;
          grid-template-columns: 1fr auto 88px;
          gap: 10px;
          padding: 0 8px 8px;
          border-bottom: 1px solid var(--ink-100);
          color: var(--ink-600);
          font-size: var(--font-caption);
          font-weight: 700;
        }
        .boardHeadRow.twoCol {
          grid-template-columns: 1fr auto;
        }
        .boardHeadRow span:not(:first-child) {
          text-align: right;
        }
        .boardList {
          display: flex;
          flex-direction: column;
        }
        .boardRow {
          display: grid;
          grid-template-columns: 22px 1fr auto 88px;
          gap: 10px;
          align-items: center;
          width: 100%;
          padding: 12px 8px;
          border: 0;
          border-bottom: 1px solid var(--ink-100);
          background: transparent;
          text-align: left;
          cursor: pointer;
          font: inherit;
          /* 행 안의 순위·현재가·점수 등 모든 숫자를 고정폭으로 - 세로로 자릿수 정렬 */
          font-variant-numeric: tabular-nums;
        }
        .boardRow:hover {
          background: var(--ruby-50);
        }
        .watchlistCard .boardRow {
          grid-template-columns: 1fr auto;
        }
        .boardRank {
          font-weight: 900;
          color: var(--ruby-600);
          font-size: var(--font-body);
        }
        .boardNameCell {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        /* 종목명은 라벨 - 숫자(현재가/점수)와 같은 body 크기지만 무게를 낮춰 구분 */
        .boardName {
          font-weight: 700;
          color: var(--ink-900);
          font-size: var(--font-body);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .boardMeta {
          color: var(--ink-600);
          font-size: var(--font-caption);
          font-weight: 700;
        }
        /* 현재가는 이 행의 주인공 - 크기는 body로 통일하고 무게(800)·우측정렬·고정폭으로 세운다 */
        .boardPrice {
          text-align: right;
          font-weight: 800;
          color: var(--ink-900);
          font-size: var(--font-body);
          white-space: nowrap;
        }
        .boardScore {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1.2;
          color: var(--ink-600);
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .boardScore b {
          font-size: var(--font-body);
          font-weight: 800;
          color: var(--ink-900);
        }
        .boardScore small {
          font-size: var(--font-caption);
          font-weight: 700;
        }
        .boardMore {
          margin-top: 12px;
          width: 100%;
          padding: 10px;
          border: 1px solid var(--gold-500);
          border-radius: 12px;
          background: #fff;
          font-weight: 800;
          color: var(--ruby-700);
          cursor: pointer;
        }
        .boardEmpty {
          margin: 0;
          padding: 24px 8px;
          color: var(--ink-600);
        }
        .boardEmptyBox {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          padding: 24px 8px;
        }
        .boardEmptyBox p {
          margin: 0;
          color: var(--ink-600);
          line-height: 1.6;
        }
        .boardEmptyLink {
          display: inline-flex;
          align-items: center;
          padding: 10px 16px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--ruby-700);
          color: var(--ruby-700);
          font-weight: 800;
          font-size: var(--font-body);
          text-decoration: none;
        }
        @media (max-width: 768px) {
          .homeBoard {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
