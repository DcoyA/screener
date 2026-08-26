"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWon(value) {
  return `${Math.round(toNumber(value)).toLocaleString()}원`;
}

function normalizeSide(side) {
  return String(side || "BUY").toUpperCase();
}

// 주문 내역을 순매수 기준으로 정리해 보유 종목 수와 투입 원금(매수 원가)을 계산한다.
function summarizeHoldings(orders) {
  const map = {};

  orders.forEach((order) => {
    const code = String(order.code || "").trim();
    const side = normalizeSide(order.side);
    const qty = toNumber(order.quantity);
    const price = toNumber(order.price);
    const amount = toNumber(order.amount) || price * qty;
    if (!code || !qty || !price) return;

    if (!map[code]) map[code] = { quantity: 0, buyAmount: 0 };

    if (side === "BUY") {
      map[code].quantity += qty;
      map[code].buyAmount += amount;
    } else {
      const avgPrice = map[code].quantity > 0 ? map[code].buyAmount / map[code].quantity : 0;
      map[code].quantity -= qty;
      map[code].buyAmount -= avgPrice * qty;
      if (map[code].quantity <= 0) {
        map[code].quantity = 0;
        map[code].buyAmount = 0;
      }
    }
  });

  const holdings = Object.values(map).filter((item) => item.quantity > 0);
  const holdingsCount = holdings.length;
  const totalBuyAmount = holdings.reduce((sum, item) => sum + item.buyAmount, 0);

  return { holdingsCount, totalBuyAmount };
}

export default function PortfolioSummaryCard() {
  const [status, setStatus] = useState("loading"); // loading | guest | ready | error
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let isMounted = true;

    async function loadSummary(user) {
      if (!user) {
        if (isMounted) setStatus("guest");
        return;
      }

      try {
        // 세션 기반: accountId/pin 링크 없이 로그인 사용자의 가상계좌를 직접 조회(없으면 생성)한다.
        const accountRes = await fetch("/api/demo/account/ensure");
        const accountData = await accountRes.json();
        if (!accountData.ok) {
          if (isMounted) setStatus("error");
          return;
        }

        const orderRes = await fetch("/api/demo/order/list");
        const orderData = await orderRes.json();
        const orders = orderData.ok ? orderData.orders || [] : [];
        const { holdingsCount, totalBuyAmount } = summarizeHoldings(orders);

        if (!isMounted) return;
        setSummary({
          cash: toNumber(accountData.account?.cash),
          holdingsCount,
          totalBuyAmount,
        });
        setStatus("ready");
      } catch (error) {
        console.error("포트폴리오 요약 조회 실패", error);
        if (isMounted) setStatus("error");
      }
    }

    supabase.auth.getUser().then(({ data }) => loadSummary(data.user || null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSummary(session?.user || null);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // TASK 4-2(디자인·IA 개편): 로그인 여부를 비동기로 확인하는 동안 항상
  // "불러오는 중..." 문구가 한 박자 노출됐다 사라졌는데, 비로그인 사용자가
  // 대부분이라 매번 의미 없는 로딩 문구만 보고 지나가는 셈이었다. 로딩
  // 중에는 아무것도 렌더링하지 않는다.
  if (status === "loading") {
    return null;
  }

  // TASK 4(디자인·IA 개편, 재검토): 첫 방문자는 정의상 항상 guest 상태다.
  // 계좌가 없는 사람에게 "계좌 요약" 카드를 보여주는 건 빈 껍데기라, 홈에서는
  // 아예 렌더하지 않는다(모의투자 진입은 QuickLinksSection이 이미 담당).
  if (status === "guest") {
    return null;
  }

  if (status === "error" || !summary) {
    return (
      <section className="portfolioCard">
        <p className="portfolioErrorText">가상계좌 정보를 불러오지 못했습니다.</p>
        <Link href="/demo-trade" className="portfolioGoBtn">
          가상계좌 페이지에서 확인하기
        </Link>
        <style jsx>{portfolioStyles}</style>
      </section>
    );
  }

  const totalAsset = summary.cash + summary.totalBuyAmount;

  return (
    <section className="portfolioCard">
      <div className="portfolioTopRow">
        <p className="portfolioEyebrow">내 가상계좌</p>
        <Link href="/demo-trade" className="portfolioGoBtn">
          가상계좌로 이동
        </Link>
      </div>

      <div className="portfolioStatsRow">
        <div className="portfolioStatItem">
          <span className="portfolioStatLabel">보유 현금</span>
          <strong className="portfolioStatValue">{formatWon(summary.cash)}</strong>
        </div>
        <div className="portfolioStatItem">
          <span className="portfolioStatLabel">보유 종목 수</span>
          <strong className="portfolioStatValue">{summary.holdingsCount.toLocaleString()}개</strong>
        </div>
        <div className="portfolioStatItem">
          <span className="portfolioStatLabel">총자산(추정)</span>
          <strong className="portfolioStatValue">{formatWon(totalAsset)}</strong>
        </div>
      </div>

      <p className="portfolioNote">
        총자산은 매수 원가 기준 추정치입니다. 실시간 평가손익은 가상계좌 페이지에서 확인하세요.
      </p>

      <style jsx>{portfolioStyles}</style>
    </section>
  );
}

const portfolioStyles = `
  .portfolioCard {
    border: 1px solid #e5e7eb;
    border-radius: 24px;
    padding: 24px 26px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
    margin-top: 24px;
  }
  .portfolioEyebrow {
    margin: 0 0 8px;
    display: inline-flex;
    padding: 6px 12px;
    border-radius: 999px;
    background: #eef2ff;
    color: #4f46e5;
    font-size: 0.78rem;
    font-weight: 800;
  }
  .portfolioTopRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }
  .portfolioGoBtn {
    font-size: 0.85rem;
    font-weight: 800;
    color: #4f46e5;
    text-decoration: none;
  }
  .portfolioGoBtn:hover {
    text-decoration: underline;
  }
  .portfolioStatsRow {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .portfolioStatItem {
    background: #ffffff;
    border: 1px solid #eef2f7;
    border-radius: 16px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .portfolioStatLabel {
    color: #64748b;
    font-size: 0.8rem;
    font-weight: 700;
  }
  .portfolioStatValue {
    font-size: 1.1rem;
    letter-spacing: -0.02em;
    color: #0f172a;
  }
  .portfolioNote {
    margin: 14px 0 0;
    color: #94a3b8;
    font-size: 0.78rem;
  }
  .portfolioErrorText {
    margin: 0 0 12px;
    color: #ef4444;
    font-weight: 700;
  }
  @media (max-width: 640px) {
    .portfolioStatsRow {
      grid-template-columns: 1fr;
    }
  }
`;
