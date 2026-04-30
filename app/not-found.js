import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="hero">
      <div className="badge">404</div>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소가 잘못되었거나 아직 준비되지 않은 페이지입니다.</p>
      <div className="buttonRow">
        <Link href="/" className="button">홈으로 이동</Link>
        <Link href="/ranking" className="button secondary">랭킹 보기</Link>
      </div>
    </div>
  );
}
