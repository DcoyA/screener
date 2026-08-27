import Link from "next/link";
import PageTopBar from "../components/PageTopBar";

export const metadata = {
  title: "종목검색",
  description: "종목검색 기능 준비 중",
};

// STEP 7에서 실제 검색 UI를 구현한다. 그 전까지 네비 항목이 404가 되지 않도록
// 두는 임시 스텁. 현재는 데일리 Top10(랭킹)에서 상단 검색창으로 대체 가능.
export default function SearchPage() {
  return (
    <main className="container" style={{ background: "var(--page-bg)", minHeight: "60vh" }}>
      <PageTopBar />

      <section
        style={{
          maxWidth: 640,
          margin: "40px auto",
          textAlign: "center",
          border: "1px solid var(--ink-300)",
          borderRadius: "var(--radius-card)",
          background: "#fff",
          padding: "40px 24px",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: "1.6rem", color: "var(--ink-900)" }}>
          종목검색은 준비 중입니다
        </h1>
        <p style={{ margin: "0 0 24px", color: "var(--ink-600)", lineHeight: 1.7 }}>
          이름·코드로 바로 찾는 검색 화면을 준비하고 있어요.
          <br />
          그동안은 데일리 Top10 랭킹의 상단 검색창을 이용해 주세요.
        </p>
        <Link href="/screener?tab=ranking" className="rubyCta" style={{ display: "inline-flex", alignItems: "center", padding: "12px 22px" }}>
          데일리 Top10으로 가기
        </Link>
      </section>
    </main>
  );
}
