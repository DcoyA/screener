import Link from "next/link";
import Image from "next/image";
import MainNav from "./MainNav";

// 기획서 헤더: 좌측 로고, 우측 네비. 딥 루비(.rubySurface) 위에 아웃라인 pill.
// 페이지마다 제각각이던 상단 바(PageTopBar / HomeClient.topBar / notice.topLinks)를
// 이 하나로 통일한다. 스타일은 app/globals.css의 .siteHeader / MainNav 규칙.
export default function SiteHeader() {
  return (
    <header className="siteHeader rubySurface">
      <div className="siteHeaderInner">
        <Link href="/" className="siteBrand" aria-label="우량주 스카우터 홈으로">
          <Image src="/logo.png" alt="" width={28} height={28} className="siteBrandLogo" priority />
          <span className="siteBrandName">우량주 스카우터</span>
        </Link>
        <MainNav />
      </div>
    </header>
  );
}
