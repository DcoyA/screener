"use client";

import Image from "next/image";

export default function FloatingKakao({
  url,
  tooltip = "오픈 카톡문의/상당/건의",
}) {
  return (
    <div className="floatingWrap">
      <a
        className="floatingBtn"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={tooltip}
      >
        {/* 아이콘 이미지: public/kakao-icon.png 추천 */}
        <Image
          src="/kakao-icon.png"
          alt="오픈카톡 문의"
          width={56}
          height={56}
          priority
        />
        <span className="tooltip">{tooltip}</span>
      </a>

      <style jsx>{`
        .floatingWrap {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 2000;
        }

        .floatingBtn {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          text-decoration: none;
        }

        .floatingBtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.22);
        }

        .tooltip {
          position: absolute;
          right: 64px;
          bottom: 50%;
          transform: translateY(50%);
          white-space: nowrap;
          background: rgba(15, 23, 42, 0.92);
          color: #fff;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        .floatingBtn:hover .tooltip {
          opacity: 1;
          transform: translateY(50%) translateX(-2px);
        }

        @media (max-width: 640px) {
          .floatingWrap {
            right: 14px;
            bottom: 14px;
          }
          .tooltip {
            display: none; /* 모바일은 hover가 애매해서 숨김(원하면 토글로 바꿔줄게) */
          }
        }
      `}</style>
    </div>
  );
}
