import "./globals.css";

export const metadata = {
  title: "우량주 스카우터",
  description: "OpenDART와 KRX 데이터를 활용한 저평가 종목 스크리너"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
