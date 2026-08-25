"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Image from "next/image";
import MainNav from "../MainNav";
import HeroSection from "./HeroSection";
import SubscribeSection from "./SubscribeSection";
import StrategySection from "./StrategySection";
import AvoidSection from "./AvoidSection";
import BridgeSection from "./BridgeSection";
import QuickLinksSection from "./QuickLinksSection";
import NoticePreview from "./NoticePreview";
import { buildStrategyCards, buildAvoidSummary } from "../../lib/homeData";
import PortfolioSummaryCard from "./PortfolioSummaryCard";

export default function HomeClient({ stocks, notices }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const latestNotice = [...notices].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const strategyCards = useMemo(() => buildStrategyCards(stocks), []);
  const avoidSummary = useMemo(() => buildAvoidSummary(stocks), []);
  const updatedAt = stocks[0]?.updatedAt || "-";

  const openModal = () => {
    setIsModalOpen(true);
    setIsSubmitted(false);
    setSubmitError("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEmail("");
    setIsSubmitted(false);
    setIsSubmitting(false);
    setSubmitError("");
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setSubmitError(data?.error || "신청 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      setIsSubmitted(true);
      setEmail("");
    } catch (err) {
      setSubmitError("신청 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="container">
        <header className="topBar">
          <Link href="/" className="brandArea">
            <Image
              src="/logo.png"
              alt="우량주 스카우터 로고"
              width={32}
              height={32}
              className="brandLogo"
            />
            <span className="brandTitle">우량주 스카우터</span>
          </Link>
          <MainNav className="mainNav" />
        </header>

        <HeroSection updatedAt={updatedAt} stocks={stocks} />
        <PortfolioSummaryCard />

        <SubscribeSection
          isModalOpen={isModalOpen}
          email={email}
          setEmail={setEmail}
          isSubmitted={isSubmitted}
          isSubmitting={isSubmitting}
          submitError={submitError}
          openModal={openModal}
          closeModal={closeModal}
          handleSubscribe={handleSubscribe}
        />

        <StrategySection strategyCards={strategyCards} />

        <AvoidSection avoidSummary={avoidSummary} />

        <BridgeSection />

        <QuickLinksSection />

        <NoticePreview latestNotice={latestNotice} />
      </main>

      <footer className="footer">
        <div className="footerInner">
          <p>HELLO MEDIA · All rights reserved.</p>
          <a href="mailto:iamborghini5757@gmail.com">iamborghini5757@gmail.com</a>
        </div>
      </footer>

      <style jsx global>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          color: #0f172a;
        }
        .topBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }
        .brandArea {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .brandLogo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }
        .brandTitle {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .hero {
          position: relative;
          overflow: hidden;
          padding: 20px 0 8px;
        }
        .hero::before {
          content: "";
          position: absolute;
          right: -40px;
          top: 10px;
          width: 340px;
          height: 340px;
          background: radial-gradient(circle, rgba(0, 255, 100, 0.16), transparent 68%);
          filter: blur(42px);
          pointer-events: none;
          z-index: 0;
        }
        .heroTop {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          flex-wrap: wrap;
          min-height: 420px;
          z-index: 1;
        }
        .heroMain {
          position: relative;
          z-index: 2;
          flex: 1 1 720px;
          min-width: 0;
          max-width: 760px;
        }
        .heroCharacter {
          position: absolute;
          right: -10px;
          bottom: -20px;
          width: min(42vw, 520px);
          height: min(42vw, 520px);
          max-width: 520px;
          max-height: 520px;
          opacity: 1;
          pointer-events: none;
          transition: opacity 0.5s ease, transform 0.2s ease;
          z-index: 1;
          overflow: hidden;
        }
        .hero:hover .heroCharacter {
          opacity: 0.5;
          transform: translateY(-4px);
        }
        .heroCharacterGlow {
          position: absolute;
          inset: 16% 18% 18% 18%;
          background: radial-gradient(circle, rgba(120, 255, 160, 0.22), transparent 72%);
          filter: blur(24px);
          z-index: 0;
        }
        .heroCharacterImage {
          object-fit: contain;
          object-position: left bottom;
        }
        .badge,
        .subscribeEyebrow,
        .modalBadge,
        .bridgeBadge,
        .strategyBadge,
        .noticePreviewBadge {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          margin: 0 0 18px;
        }
        h1 {
          font-size: clamp(2.2rem, 5vw, 3.5rem);
          line-height: 1.1;
          letter-spacing: -0.04em;
          margin: 0 0 16px;
        }
        .desc {
          max-width: 920px;
          font-size: 1.08rem;
          line-height: 1.9;
          color: #475569;
          margin: 0;
        }
        .desc strong,
        .bridgeDesc strong,
        .subscribeDesc strong {
          color: #0f172a;
        }
        .heroPointRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .heroPoint {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 0.86rem;
          font-weight: 700;
        }
        .updateBox {
          position: relative;
          z-index: 2;
          min-width: 200px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
          text-align: right;
        }
        .updateLabel {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .updateBox strong {
          display: block;
          font-size: 1.15rem;
          color: #0f172a;
        }
        .updateDesc {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
        }
        .heroActions,
        .modalActions,
        .subscribeActions {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 28px;
        }
        .primaryBtn,
        .secondaryBtn,
        .linkBtn,
        .ghostBtn,
        .miniActionLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 14px 18px;
          font-weight: 800;
          text-decoration: none;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.98rem;
        }
        .primaryBtn {
          background: #0f172a;
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        }
        .primaryBtn:hover {
          background: #111827;
        }
        .primaryBtn:disabled,
        .ghostBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }
        .secondaryBtn,
        .ghostBtn,
        .linkBtn,
        .miniActionLink {
          background: #ffffff;
          color: #0f172a;
          border-color: #dbe3f0;
        }
        .secondaryBtn:hover,
        .ghostBtn:hover,
        .linkBtn:hover,
        .miniActionLink:hover {
          background: #f8fafc;
        }
        .sectionHeaderRow {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin: 56px 0 22px;
          flex-wrap: wrap;
        }
        .searchBarForm {
          margin-top: 24px;
          max-width: 640px;
        }
        .searchBarWrap {
          position: relative;
        }
        .searchBarInput {
          width: 100%;
          height: 58px;
          border-radius: 16px;
          border: 1px solid #cbd5e1;
          padding: 0 110px 0 20px;
          font-size: 1.02rem;
          outline: none;
          box-sizing: border-box;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
        }
        .searchBarInput:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
        }
        .searchBarBtn {
          position: absolute;
          right: 8px;
          top: 8px;
          height: 42px;
          padding: 0 20px;
          border-radius: 12px;
          border: none;
          background: #0f172a;
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .searchBarBtn:hover {
          background: #111827;
        }
        .searchDropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
          overflow: hidden;
          z-index: 20;
        }
        .searchResultList {
          list-style: none;
          margin: 0;
          padding: 6px;
          max-height: 320px;
          overflow-y: auto;
        }
        .searchResultItem {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          font-size: 0.95rem;
          transition: background 0.15s ease;
        }
        .searchResultItem:hover {
          background: #f8fafc;
        }
        .searchResultName {
          font-weight: 800;
          color: #0f172a;
        }
        .searchResultCode {
          color: #64748b;
          font-size: 0.85rem;
        }
        .searchResultMarket {
          margin-left: auto;
          display: inline-flex;
          padding: 4px 10px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.75rem;
          font-weight: 800;
        }
        .searchNoResult {
          margin: 0;
          padding: 18px;
          color: #64748b;
          font-size: 0.92rem;
          text-align: center;
        }
        @media (max-width: 640px) {
          .searchBarInput {
            padding-right: 90px;
            height: 54px;
          }
          .searchBarBtn {
            height: 38px;
            padding: 0 14px;
            font-size: 0.9rem;
          }
        }
        .compactHeader {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .sectionTitle {
          margin: 0 0 8px;
          font-size: 2rem;
          letter-spacing: -0.03em;
        }
        .sectionDesc,
        .strategyDesc {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
        }
        .strategySection,
        .avoidSection,
        .bridgeSection,
        .subscribeSection,
        .quickLinksSection {
          margin-top: 40px;
        }
        .strategyGrid,
        .bridgeGrid,
        .quickLinksGrid,
        .avoidGrid {
          display: grid;
          gap: 18px;
        }
        .strategyGrid,
        .bridgeGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .avoidGrid,
        .quickLinksGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .strategyCard,
        .avoidCard,
        .bridgeCard,
        .quickLinksCard,
        .subscribeCard,
        .noticePreviewWrap {
          border-radius: 28px;
          border: 1px solid #e5e7eb;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .strategyCard,
        .avoidCard,
        .bridgeCard,
        .quickLinksCard,
        .subscribeCard {
          padding: 24px;
        }
        .strategyHeader,
        .noticePreviewTopLine {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .strategyStockTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-top: 18px;
          margin-bottom: 12px;
        }
        .strategyStockTop h4 {
          margin: 0 0 6px;
          font-size: 1.35rem;
          letter-spacing: -0.03em;
        }
        .scoreChip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 12px;
          background: #0f172a;
          color: #fff;
          font-size: 0.82rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .stockCode,
        .noticePreviewDate {
          color: #64748b;
          font-size: 0.88rem;
        }
        .candidatePriceMeta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .candidatePriceItem {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 12px;
          background: #f8fafc;
        }
        .candidatePriceLabel {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 700;
        }
        .priceLine,
        .targetLine {
          display: block;
          margin: 0;
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .priceLine {
          color: #0ea5e9;
        }
        .targetLine {
          color: #0f172a;
        }
        .upsideLine {
          margin: 0 0 10px;
          font-weight: 900;
        }
        .upsidePositive {
          color: #0ea5e9;
        }
        .upsideNegative,
        .upsideNeutral {
          color: #64748b;
        }
        .reasonBox {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          background: #f8fbff;
          margin-bottom: 12px;
        }
        .reasonLabel {
          display: block;
          margin-bottom: 8px;
          color: #0f172a;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .reasonBox p,
        .emptyStateBox p,
        .bridgeDesc,
        .subscribeDesc,
        .modalDesc,
        .noticePreviewText,
        .summaryText,
        .bridgeItem ul,
        .quickLinkItem span,
        .avoidItem p {
          margin: 0;
          color: #475569;
          line-height: 1.8;
        }
        .summaryText.short {
          min-height: auto;
          margin: 10px 0 18px;
          word-break: keep-all;
        }
        .emptyStateBox {
          margin-top: 18px;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 18px;
          background: #ffffff;
        }
        .avoidItem {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 18px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-decoration: none;
          transition: all 0.18s ease;
        }
        .avoidItem.clickable:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          background: #fbfdff;
        }
        .avoidItem strong {
          font-size: 1rem;
          color: #0f172a;
        }
        .avoidItem span {
          color: #b45309;
          font-weight: 800;
          font-size: 0.9rem;
        }
        .bridgeCard h2,
        .quickLinksCard h2,
        .subscribeCard h2,
        .noticePreviewBody h2 {
          margin: 0 0 16px;
          font-size: 1.6rem;
          letter-spacing: -0.03em;
        }
        .bridgeItem {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 20px;
          background: #ffffff;
        }
        .bridgeItem.premium {
          background: #f8fbff;
        }
        .bridgeItemLabel {
          display: block;
          margin-bottom: 12px;
          color: #0f172a;
          font-weight: 900;
        }
        .quickLinkItem {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-decoration: none;
          padding: 20px;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          color: #0f172a;
        }
        .quickLinkItem strong {
          font-size: 1.05rem;
        }
        .noticePreviewSection {
          margin: 28px 0 34px;
        }
        .noticePreviewWrap {
          padding: 22px;
        }
        .noticePreviewCard {
          display: block;
          text-decoration: none;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 22px 24px;
          background: #ffffff;
          color: #0f172a;
        }
        .noticePreviewDate {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 120px;
          padding: 12px 16px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-weight: 800;
          text-align: center;
        }
        .footer {
          border-top: 1px solid #e5e7eb;
          background: #ffffff;
        }
        .footerInner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 24px 44px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          color: #64748b;
        }
        .footerInner p {
          margin: 0;
        }
        .footerInner a {
          color: #0f172a;
          text-decoration: none;
          font-weight: 700;
        }
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }
        .modalCard {
          position: relative;
          width: min(100%, 560px);
          background: #ffffff;
          border-radius: 28px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.25);
        }
        .modalCard h3 {
          margin: 0 0 12px;
          font-size: 1.7rem;
          letter-spacing: -0.03em;
        }
        .closeBtn {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: none;
          background: #f1f5f9;
          font-size: 1.5rem;
          cursor: pointer;
        }
        .subscribeForm {
          margin-top: 22px;
        }
        .subscribeForm input {
          width: 100%;
          height: 54px;
          border-radius: 14px;
          border: 1px solid #cbd5e1;
          padding: 0 16px;
          font-size: 1rem;
          outline: none;
          box-sizing: border-box;
        }
        .subscribeForm input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
        }
        .errorText {
          margin: 12px 0 0;
          color: #dc2626;
          font-size: 0.92rem;
          font-weight: 600;
        }
        .singleAction {
          justify-content: flex-start;
        }
        @media (max-width: 1100px) {
          .strategyGrid,
          .bridgeGrid,
          .quickLinksGrid,
          .avoidGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .strategyGrid,
          .bridgeGrid,
          .quickLinksGrid,
          .avoidGrid {
            grid-template-columns: 1fr;
          }
          .heroTop {
            flex-direction: column;
            justify-content: flex-start;
            align-items: stretch;
            min-height: 0;
            gap: 16px;
          }
          .heroMain {
            max-width: 100%;
            flex: none;
          }
          .updateBox {
            width: 100%;
            text-align: left;
            min-width: 0;
          }
          .heroCharacter {
            display: block;
            position: relative;
            right: auto;
            bottom: auto;
            width: min(72vw, 360px);
            height: min(72vw, 360px);
            margin: 0 auto;
            opacity: 0.95;
          }
          .hero::before {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .container {
            padding: 24px 18px 64px;
          }
          .topBar {
            align-items: flex-start;
            margin-bottom: 28px;
          }
          .hero {
            padding: 12px 0 8px;
          }
          .heroTop {
            gap: 12px;
          }
          .heroCharacter {
            width: min(78vw, 320px);
            height: min(78vw, 320px);
            margin-top: 4px;
          }
          .heroCharacterGlow {
            display: none;
          }
          .desc {
            font-size: 1rem;
            line-height: 1.8;
          }
          .heroActions {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            gap: 10px;
            margin-top: 20px;
            width: 100%;
          }
          .modalActions,
          .subscribeActions {
            flex-direction: column;
          }
          .heroActions .primaryBtn,
          .heroActions .secondaryBtn {
            width: calc(50% - 5px);
            min-width: 0;
            padding: 14px 10px;
            font-size: 0.95rem;
            white-space: nowrap;
          }
          .ghostBtn,
          .linkBtn,
          .miniActionLink,
          .primaryBtn,
          .secondaryBtn {
            width: 100%;
          }
          .strategyCard,
          .avoidCard,
          .bridgeCard,
          .quickLinksCard,
          .subscribeCard,
          .modalCard,
          .noticePreviewWrap {
            padding: 22px;
          }
          .candidatePriceMeta {
            grid-template-columns: 1fr;
          }
          .strategyStockTop,
          .noticePreviewTopLine {
            flex-direction: column;
            align-items: flex-start;
          }
          .noticePreviewDate {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
