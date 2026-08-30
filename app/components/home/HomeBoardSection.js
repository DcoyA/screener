"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cleanStockName } from "../../lib/stockName";
import { percentileOf } from "../../lib/scoreStats";
import { getWishlist, getCurrentUser } from "../../lib/wishlist";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { SkeletonLines } from "../Skeleton";

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

  // "＋ 종목 추가": 홈에 이미 있는 검색 바(HeroSection, 이 카드 바로 아래)로
  // 스크롤 + 포커스. 별도 검색 UI를 카드 안에 복제하지 않는다.
  const scrollToSearch = () => {
    const input = document.getElementById("homeSearchInput");
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  };

  const loginWithKakao = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
  };

  let body;
  if (state === "loading") {
    body = (
      <div style={{ padding: "8px" }}>
        <SkeletonLines count={2} gap={12} lastWidth="72%" />
      </div>
    );
  } else if (state === "anon") {
    body = (
      <div className="boardEmptyBox">
        <p className="boardEmptyTitle">관심종목을 등록하세요</p>
        <p className="boardEmptyDesc">로그인하면 담은 종목을 기기 간에 동기화해서 볼 수 있어요.</p>
        <button type="button" className="boardEmptyLink" onClick={loginWithKakao}>
          카카오로 로그인
        </button>
      </div>
    );
  } else if (state === "empty") {
    body = (
      <div className="boardEmptyBox">
        <p className="boardEmptyTitle">관심종목을 등록하세요</p>
        <p className="boardEmptyDesc">데일리 Top10이나 종목 상세에서 ☆ 를 누르면 여기에 모여요.</p>
        <button type="button" className="boardEmptyLink" onClick={scrollToSearch}>
          ＋ 종목 추가
        </button>
        <Link href="/screener?tab=ranking" className="boardEmptyLinkSub">
          데일리 Top10 보기
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

  // 빈 상태(anon/empty)도 접지 않고 항상 펼쳐서, 무엇을 해야 하는지 카드
  // 안에서 바로 보이게 한다.
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
        .boardEmptyBox {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          padding: 20px 8px;
        }
        .boardEmptyTitle {
          margin: 0;
          font-size: var(--font-body);
          font-weight: 800;
          color: var(--ink-900);
        }
        .boardEmptyDesc {
          margin: 0 0 4px;
          font-size: var(--font-caption);
          color: var(--ink-600);
          line-height: 1.6;
        }
        .boardEmptyLink {
          display: inline-flex;
          align-items: center;
          padding: 10px 16px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--ruby-700);
          background: #fff;
          color: var(--ruby-700);
          font-family: inherit;
          font-weight: 800;
          font-size: var(--font-body);
          line-height: 1;
          text-decoration: none;
          cursor: pointer;
        }
        .boardEmptyLinkSub {
          font-size: var(--font-caption);
          font-weight: 700;
          color: var(--ink-600);
          text-decoration: underline;
          text-underline-offset: 2px;
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
