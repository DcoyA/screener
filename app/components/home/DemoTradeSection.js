"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { toNumber } from "../../demo-trade/lib/format";
import { summarizePositions, totalsFromPositions, holdingCodesFromOrders } from "../../demo-trade/lib/portfolio";

// 소셜 프루프는 참여자가 이 수 미만이면 오히려 역효과라 숨긴다.
const SOCIAL_PROOF_MIN = 5;
// 코드에서 확인한 초기 지급액(app/api/demo/account/ensure). CTA 문구에 그대로 쓴다.
const STARTING_CASH = 100000000;

function eok(n) {
  return `${Math.round(n / 100000000)}억`;
}

// 계좌 규모(1억 안팎) 표기: "1억 320만원" / "1억원" / "9,850만원".
function formatAsset(won) {
  const n = Math.round(toNumber(won));
  if (n < 10000) return `${n.toLocaleString("ko-KR")}원`;
  const e = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  if (e > 0) return man > 0 ? `${e}억 ${man.toLocaleString("ko-KR")}만원` : `${e}억원`;
  return `${man.toLocaleString("ko-KR")}만원`;
}

function formatPct(value) {
  const n = toNumber(value);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}%`;
}

function toneClass(value) {
  const n = toNumber(value);
  return n > 0 ? "up" : n < 0 ? "down" : "flat";
}

// CTA는 <Link>(컴포넌트)라 styled-jsx scope 클래스가 안 붙는다 → 인라인 스타일.
// 아웃라인형(루비 테두리 + 흰 배경 + 루비 텍스트): 헤더의 채움형 프리미엄 구독
// CTA(.rubyCta)보다 한 단계 낮은 위계.
const CTA_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  padding: "12px 20px",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--ruby-700)",
  background: "#fff",
  color: "var(--ruby-700)",
  fontWeight: 800,
  fontSize: "var(--font-body)",
  textDecoration: "none",
};

// 홈 헤더 바로 아래 가상투자 유도 섹션. 프레이밍: "우리 점수를 믿지 말고 직접 검증".
// - 미참여(비로그인 포함): 제안형 헤드라인 + 진입장벽 제거 + CTA 1개(아웃라인, 헤더
//   프리미엄 구독 CTA보다 낮은 위계).
// - 참여 중: 영업 문구를 걷어내고 내 수익률 / 총 평가금액을 크게. CTA는 "터미널 열기".
//   평가금액·수익률은 보유종목 실시간 시세로 계산(모의투자 페이지와 동일한
//   순매수 집계: app/demo-trade/lib/portfolio.js). KOSPI 대비는 집계 데이터가 없어 뺀다.
export default function DemoTradeSection() {
  const [phase, setPhase] = useState("pitch"); // pitch | active
  const [metrics, setMetrics] = useState(null); // { profitRate, totalAsset, ready }
  const [socialProof, setSocialProof] = useState(null); // number | null

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const supabase = createSupabaseBrowserClient();

    fetch("/api/demo/stats")
      .then((r) => r.json())
      .then((d) => {
        if (aliveRef.current && d?.ok && Number(d.activeAccounts) >= SOCIAL_PROOF_MIN) {
          setSocialProof(Number(d.activeAccounts));
        }
      })
      .catch(() => {});

    async function resolvePhase(user) {
      if (!user) {
        if (aliveRef.current) {
          setPhase("pitch");
          setMetrics(null);
        }
        return;
      }
      try {
        const statusRes = await fetch("/api/demo/account/status");
        const status = await statusRes.json();
        if (!aliveRef.current) return;
        if (!status?.ok || !status.hasAccount) {
          setPhase("pitch");
          setMetrics(null);
          return;
        }

        setPhase("active");
        setMetrics({ profitRate: 0, totalAsset: toNumber(status.account?.cash), ready: false });

        const orderRes = await fetch("/api/demo/order/list");
        const orderData = await orderRes.json();
        if (!aliveRef.current) return;
        const orders = orderData?.ok ? orderData.orders || [] : [];

        const codes = holdingCodesFromOrders(orders);
        const priceMap = {};
        for (const code of codes) {
          try {
            const q = await fetch(`/api/kis/quote?code=${encodeURIComponent(code)}`);
            const qd = await q.json();
            if (qd?.ok && qd.price) priceMap[code] = toNumber(qd.price);
          } catch {
            /* 시세 실패한 종목은 평균단가로 폴백(summarizePositions) */
          }
          if (!aliveRef.current) return;
        }

        const positions = summarizePositions(orders, priceMap);
        const totals = totalsFromPositions(positions, status.account?.cash);
        if (!aliveRef.current) return;
        setMetrics({ profitRate: totals.profitRate, totalAsset: totals.totalAsset, ready: true });
      } catch {
        if (aliveRef.current) {
          setPhase("pitch");
          setMetrics(null);
        }
      }
    }

    supabase.auth.getUser().then(({ data }) => resolvePhase(data.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      resolvePhase(session?.user || null);
    });

    return () => {
      aliveRef.current = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 조건부 내용을 별도 변수로 빼면 styled-jsx가 scope 클래스를 안 붙여
  // 스타일이 안 먹는다 - 반드시 return의 JSX 트리 안에서 분기한다.
  return (
    <section className="demoSection">
      {phase === "active" ? (
        <>
          <p className="demoEyebrow">내 가상투자</p>
          <div className="demoStatRow">
            <div className="demoStatBox">
              <span className="demoStatLabel">내 수익률 (매수원가 대비)</span>
              <strong className={`demoStatValue tone-${toneClass(metrics?.profitRate)}`}>
                {metrics?.ready ? formatPct(metrics?.profitRate) : "계산 중…"}
              </strong>
            </div>
            <div className="demoStatBox">
              <span className="demoStatLabel">총 평가금액</span>
              <strong className="demoStatValue">{formatAsset(metrics?.totalAsset)}</strong>
            </div>
          </div>
          <Link href="/demo-trade" style={CTA_STYLE}>
            터미널 열기 →
          </Link>
        </>
      ) : (
        <>
          <p className="demoEyebrow">가상투자</p>
          <h2 className="demoHeadline">우리 점수, 진짜 맞는지 직접 확인해보세요</h2>
          <p className="demoSubhead">가상머니로 사고팔면 실제 시세로 성과가 매겨집니다. 손실은 없습니다.</p>
          <p className="demoBarriers">실제 돈 안 들어감 · 로그인하면 바로 시작 · 언제든 초기화</p>
          <Link href="/demo-trade" style={CTA_STYLE}>
            가상머니 {eok(STARTING_CASH)}원으로 시작하기 →
          </Link>
          {socialProof ? (
            <p className="demoSocial">
              지금 {socialProof.toLocaleString("ko-KR")}명이 우리 점수를 직접 검증하고 있어요.
            </p>
          ) : null}
        </>
      )}

      <style jsx>{`
        .demoSection {
          margin-bottom: 28px;
          border: 1px solid var(--ink-300);
          border-radius: var(--radius-card);
          background: #fff;
          box-shadow: var(--shadow-card);
          padding: 24px 26px;
        }
        .demoEyebrow {
          margin: 0 0 8px;
          font-size: var(--font-caption);
          font-weight: 800;
          color: var(--ruby-700);
        }
        .demoHeadline {
          margin: 0 0 8px;
          font-size: var(--font-hero);
          font-weight: var(--font-hero-weight);
          letter-spacing: -0.03em;
          color: var(--ink-900);
        }
        .demoSubhead {
          margin: 0 0 12px;
          font-size: var(--font-body);
          color: var(--ink-600);
          line-height: 1.6;
        }
        .demoBarriers {
          margin: 0 0 16px;
          font-size: var(--font-caption);
          font-weight: 700;
          color: var(--ink-600);
        }
        .demoSocial {
          margin: 14px 0 0;
          font-size: var(--font-caption);
          color: var(--ink-600);
          font-variant-numeric: tabular-nums;
        }
        .demoStatRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 4px 0 16px;
        }
        .demoStatBox {
          border: 1px solid var(--ink-200);
          border-radius: 14px;
          padding: 14px 16px;
          background: var(--ruby-50);
        }
        .demoStatLabel {
          display: block;
          margin-bottom: 6px;
          font-size: var(--font-caption);
          font-weight: 700;
          color: var(--ink-600);
        }
        .demoStatValue {
          font-size: var(--font-hero);
          font-weight: var(--font-hero-weight);
          letter-spacing: -0.03em;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .demoStatValue.tone-up {
          color: var(--signal-up);
        }
        .demoStatValue.tone-down {
          color: var(--signal-down);
        }
        @media (max-width: 640px) {
          .demoStatRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
