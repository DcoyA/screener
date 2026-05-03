import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://screener-two-kappa.vercel.app"),
  title: {
    default: "우량주 스카우터",
    template: "%s | 우량주 스카우터",
  },
  description:
    "OpenDART 전자공시와 KRX 시장 데이터를 기반으로 AI가 매주 상위 후보 종목을 분석하는 공식 데이터 기반 주식 리서치 서비스",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "우량주 스카우터",
    description:
      "공식 공시·재무·시장 데이터를 바탕으로 AI가 상위 후보 종목을 분석하는 주식 리서치 서비스",
    url: "https://screener-two-kappa.vercel.app",
    siteName: "우량주 스카우터",
    locale: "ko_KR",
    type: "website",
  },
};


export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
