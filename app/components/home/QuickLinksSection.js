import Link from "next/link";
import Icon from "../icons/Icon";

// 상단 네비를 홈/스크리너/리포트/마이 4개로 줄이면서 밀려난 항목들을 여기로 옮겼다.
const LINKS = [
  { href: "/demo-trade", icon: "wallet", title: "모의투자", desc: "가상 자금으로 미리 연습" },
  { href: "/alternative", icon: "box", title: "ETF", desc: "대안투자 후보 살펴보기" },
  { href: "/search?tab=risk", icon: "alertTriangle", title: "리스크 체크", desc: "주의 종목과 체크포인트" },
  { href: "/notice", icon: "megaphone", title: "이용가이드", desc: "사이트 사용법과 공지" },
];

export default function QuickLinksSection() {
  return (
    <section className="quickLinksSection">
      <div className="quickLinksCard">
        <h2>서비스 바로가기</h2>
        <div className="quickLinksGrid">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="quickLinkItem">
              <Icon name={link.icon} size={22} />
              <strong>{link.title}</strong>
              <span>{link.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
