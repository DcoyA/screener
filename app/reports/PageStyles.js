"use client";

// app/reports/page.js가 Supabase 프리미엄 리포트 목록을 서버에서 가져오려면
// async 서버 컴포넌트여야 하는데, styled-jsx(<style jsx>)는 클라이언트
// 컴포넌트에서만 동작한다("styled-jsx cannot be imported from a Server
// Component module" 빌드 에러). 그래서 스타일만 이 작은 클라이언트
// 컴포넌트로 분리했다 - global로 써서 원래 있던 클래스 이름 그대로
// 서버 컴포넌트 쪽 마크업에 적용되게 한다(스코프 해시가 파일마다 달라
// scoped 방식은 여기서 못 씀).
export default function ReportsPageStyles() {
  return (
    <style jsx global>{`
      .container {
        max-width: 1180px;
        margin: 0 auto;
        padding: 32px 24px 80px;
        color: #0f172a;
      }
      .performanceCrossLink {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 20px;
        color: var(--color-primary);
        font-weight: 800;
        text-decoration: none;
      }
      .pageHero {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        margin-bottom: 28px;
        flex-wrap: wrap;
      }
      .badge {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: var(--ruby-100);
        color: var(--ruby-700);
        font-size: 0.82rem;
        font-weight: 800;
        margin: 0 0 18px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 4vw, 3rem);
        letter-spacing: -0.04em;
      }
      .desc {
        margin: 0;
        max-width: 760px;
        color: #475569;
        line-height: 1.8;
        font-size: 1.02rem;
      }
      .updateBox {
        min-width: 180px;
        padding: 16px 18px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
        text-align: right;
      }
      .updateLabel,
      .stockCode,
      .scoreLine {
        color: #64748b;
      }
      .updateLabel {
        display: block;
        margin-bottom: 6px;
        font-size: 0.88rem;
        font-weight: 700;
      }
      .reportList {
        display: grid;
        gap: 20px;
      }
      .reportCard {
        border-radius: 26px;
        padding: 24px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
      }
      .reportHead {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .reportCard h2 {
        margin: 6px 0 10px;
        font-size: 1.8rem;
        letter-spacing: -0.03em;
      }
      .reportDate {
        padding: 12px 14px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-weight: 800;
        color: #334155;
      }
      .summaryText,
      .detailText,
      .bulletList li {
        color: #475569;
        line-height: 1.8;
      }
      .reportSection {
        margin-top: 18px;
      }
      .reportSection h3 {
        margin: 0 0 12px;
        font-size: 1.1rem;
      }
      .miniCardWrap {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
      .miniCard {
        border-radius: 20px;
        padding: 18px;
        background: #f8fbff;
        border: 1px solid #e5e7eb;
      }
      .marketBadge {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--ruby-100);
        color: var(--ruby-700);
        font-size: 0.78rem;
        font-weight: 800;
        margin: 0 0 12px;
      }
      .miniCard h4 {
        margin: 0 0 8px;
        font-size: 1.1rem;
      }
      .miniLink {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-button);
        padding: 10px 14px;
        text-decoration: none;
        font-weight: 800;
        border: 1px solid #dbe3f0;
        margin-top: 12px;
        background: #fff;
        color: #0f172a;
      }
      .bulletList {
        margin: 0;
        padding-left: 20px;
      }
      .premiumSection {
        margin-top: 48px;
        padding-top: 32px;
        border-top: 1px solid #e5e7eb;
      }
      .premiumHeader {
        margin-bottom: 18px;
      }
      .premiumBadge {
        background: var(--color-surface-tint);
        color: var(--color-primary);
      }
      .premiumHeader h2 {
        margin: 0;
        font-size: 1.6rem;
        letter-spacing: -0.03em;
      }
      .latestCard {
        display: block;
        padding: 24px;
        border-radius: var(--radius-card);
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        text-decoration: none;
        color: #0f172a;
        margin-bottom: 20px;
      }
      .latestBadge {
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(75, 63, 255, 0.1);
        color: var(--color-primary);
        font-size: 0.8rem;
        font-weight: 800;
        margin-bottom: 12px;
      }
      .premiumDate {
        margin: 0 0 6px;
        color: #64748b;
        font-weight: 700;
      }
      .premiumTitle {
        margin: 0;
        font-size: 1.3rem;
        letter-spacing: -0.03em;
      }
      .subscribeBanner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 16px 20px;
        border-radius: var(--radius-card);
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        margin-bottom: 14px;
      }
      .subscribeBannerText {
        font-weight: 700;
        color: #475569;
      }
      .subscribeBannerBtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-button);
        padding: 10px 20px;
        font-weight: 800;
        background: var(--color-primary);
        color: #fff;
        text-decoration: none;
      }
      .premiumList {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .premiumItemWrap {
        position: relative;
        border-radius: var(--radius-card);
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        overflow: hidden;
      }
      .premiumItemLink {
        display: flex;
        gap: 14px;
        align-items: center;
        padding: 16px 18px;
        text-decoration: none;
        color: #0f172a;
      }
      .reportDateChip {
        color: #64748b;
        font-weight: 700;
        min-width: 100px;
      }
      .reportDayType {
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--ruby-100);
        color: var(--ruby-700);
        font-size: 0.8rem;
        font-weight: 800;
      }
      .premiumTitleInline {
        font-weight: 700;
      }
      .lockOverlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding: 0 18px;
        background: rgba(247, 245, 252, 0.88);
      }
      .lockLabel {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 800;
        color: #475569;
      }
      @media (max-width: 900px) {
        .miniCardWrap {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 720px) {
        .reports-page .container {
          padding: 24px 18px 64px;
        }
        .pageHero,
        .reportHead {
          flex-direction: column;
        }
        .updateBox {
          width: 100%;
          text-align: left;
        }
      }
    `}</style>
  );
}
