import Link from "next/link";

export default function ScreenerLinkSection() {
  return (
    <section className="screenerLinkSection">
      <Link href="/search" className="screenerLink">
        전체 스크리너 보기 →
      </Link>

      <style jsx>{`
        .screenerLinkSection {
          margin-top: 16px;
          text-align: center;
        }
        .screenerLink {
          font-weight: 800;
          color: var(--color-primary);
        }
      `}</style>
    </section>
  );
}
