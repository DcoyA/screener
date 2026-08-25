import Link from "next/link";
import MainNav from "./MainNav";

const styles = {
  wrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-pill)",
    padding: "10px 18px",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: "0.9rem",
    border: "1px solid var(--color-primary)",
    background: "#ffffff",
    color: "var(--color-primary)",
  },
};

// 페이지마다 제각각이던 "홈으로 가기" 버튼을 하나로 통일한다.
// 서버/클라이언트 컴포넌트 양쪽에서 다 쓰이므로 styled-jsx 대신 인라인 스타일을 쓴다.
export default function PageTopBar({ backHref = "/", backLabel = "홈으로 가기" }) {
  return (
    <div style={styles.wrap}>
      <Link href={backHref} style={styles.backBtn}>
        {backLabel}
      </Link>
      <MainNav />
    </div>
  );
}
