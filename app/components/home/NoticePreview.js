import Link from "next/link";
import Icon from "../icons/Icon";

export default function NoticePreview({ latestNotice }) {
  if (!latestNotice) return null;

  return (
    <section className="noticePreviewSection">
      <div className="noticePreviewWrap">
        <Link href="/notice" className="noticePreviewCard">
          <div className="noticePreviewTopLine">
            <span className="noticePreviewBadge">
              <Icon name="megaphone" size={14} /> 업데이트 안내
            </span>
            <span className="noticePreviewDate">{latestNotice.date}</span>
          </div>
          <div className="noticePreviewBody">
            <h2>{latestNotice.title}</h2>
            <p className="noticePreviewText">{latestNotice.content}</p>
          </div>
        </Link>
      </div>
    </section>
  );
}
