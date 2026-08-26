import Link from "next/link";
import Icon from "../icons/Icon";

// TASK 4-2(디자인·IA 개편): 네비가 5개(오늘/종목찾기/성적표/리포트/내 종목)로
// 재편되면서 ETF·리스크체크는 "종목찾기"(/screener) 탭으로 이미 도달 가능해져
// 여기 있을 이유가 없어졌다. 네비 어디에도 없는 모의투자·이용가이드만 남긴다.
const LINKS = [
  { href: "/demo-trade", icon: "wallet", title: "모의투자", desc: "가상 자금으로 미리 연습" },
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
