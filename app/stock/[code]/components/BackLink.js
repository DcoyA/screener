"use client";

import { useRouter } from "next/navigation";

// 종목 상세는 홈·데일리 Top10·관심종목·성적표 등 여러 경로에서 들어온다.
// 고정 경로(/screener)로 보내면 진입 맥락이 깨지고 스크롤 위치도 날아간다.
// history가 있으면 router.back()(브라우저 네이티브 이동이라 스크롤 복원됨),
// 직접 진입·새 탭 등 history가 없으면 홈으로 폴백한다.
export default function BackLink() {
  const router = useRouter();

  const handleClick = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <a
      href="/"
      onClick={handleClick}
      style={{ fontWeight: 800, textDecoration: "none", color: "var(--ink-700)", cursor: "pointer" }}
    >
      ← 뒤로
    </a>
  );
}
