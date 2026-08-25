import Link from "next/link";
import MainNav from "./MainNav";

const styles = {
  wrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 22,
    flexWrap: "wrap",
    background: "var(--color-primary)",
    borderRadius: "var(--radius-card)",
    padding: "14px 18px",
    // MainNav의 pill 색을 흰색 변형으로 덮어쓴다(기본값은 흰 배경용)
    "--nav-pill-border": "rgba(255, 255, 255, 0.35)",
    "--nav-pill-bg": "transparent",
    "--nav-pill-color": "#ffffff",
    "--nav-pill-hover-bg": "rgba(255, 255, 255, 0.12)",
    "--nav-pill-hover-border": "rgba(255, 255, 255, 0.55)",
    "--nav-pill-active-bg": "#ffffff",
    "--nav-pill-active-color": "var(--color-primary)",
    "--nav-pill-muted-color": "rgba(255, 255, 255, 0.6)",
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
    border: "1px solid transparent",
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
