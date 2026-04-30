import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "공시 기반 저평가 스크리너 MVP",
  description: "공식 공시·재무·시장 데이터 기반 종목 탐색 MVP"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <nav className="nav">
          <Link href="/" className="brand">공시 기반 저평가 스크리너</Link>
          <Link href="/ranking">랭킹</Link>
          <Link href="/risk">위험 공시</Link>
          <Link href="/reports">주간 리포트</Link>
          <Link href="/about">소개/면책</Link>
        </nav>

        <main className="container">
          {children}
          <div className="footer">
            MVP 버전 · 공식 공시/재무/시장 데이터 기반 탐색 서비스 방향으로 제작 중
          </div>
        </main>
      </body>
    </html>
  );
}
