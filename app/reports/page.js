import Link from "next/link";
import reports from "../data/reports.json";
import stocks from "../data/stocks.json";
import PageTopBar from "../components/PageTopBar";
import Icon from "../components/icons/Icon";
import { cleanStockName } from "../lib/stockName";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import ReportsPageStyles from "./PageStyles";

async function fetchPremiumReports() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, issue_date, day_type, topic_title")
    .eq("status", "sent")
    .order("issue_date", { ascending: false });

  if (error) {
    console.error("premium reports 조회 실패:", error);
    return [];
  }
  return data || [];
}

export default async function ReportsPage() {
  const updatedAt = reports[0]?.publishedAt || "-";
  const premiumReports = await fetchPremiumReports();
  const [latestPremium, ...restPremium] = premiumReports;

  return (
    <>
      <main className="container" style={{ background: "var(--bg-report)" }}>
        <PageTopBar />

        <section className="pageHero">
          <div>
            <p className="badge">DAILY REPORT</p>
            <h1>데일리 Top10 리포트</h1>
            <p className="desc">
              매일 자동 수집된 공식 데이터를 바탕으로 상위 후보와 핵심 코멘트를
              정리하는 페이지입니다. <br />오늘의 핵심 후보와 시장 코멘트를 한 번에
              볼 수 있도록 구성했습니다.
            </p>
          </div>
          <div className="updateBox">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>
        </section>

        {/* 상단 네비를 4개로 통합하면서 "성과/백테스트"가 네비에서 빠져
            여기서 진입 경로를 열어둔다 (리포트<->성과 상호 링크). */}
        <Link href="/performance" className="performanceCrossLink">
          <Icon name="trendingUp" size={16} /> 이 전략들의 실제 성과/백테스트 결과 보기 →
        </Link>

        <div className="reportList">
          {reports.map((report) => {
            const topPicks = stocks.filter((stock) =>
              report.topPickCodes.includes(stock.code)
            );

            return (
              <article className="reportCard" key={report.week}>
                <div className="reportHead">
                  <div>
                    <p className="stockCode">{report.week}</p>
                    <h2>{report.title}</h2>
                    <p className="summaryText">{report.summary}</p>
                  </div>

                  <div className="reportDate">{report.publishedAt}</div>
                </div>

                <section className="reportSection">
                  <h3>오늘의 Top10 후보</h3>
                  <div className="miniCardWrap">
                    {topPicks.map((stock) => (
                      <div className="miniCard" key={stock.code}>
                        <p className="marketBadge">{stock.market}</p>
                        <h4>{cleanStockName(stock.name)}</h4>
                        <p className="stockCode">{stock.code}</p>
                        <p className="scoreLine">총점 {stock.totalScore}점</p>
                        <Link className="miniLink" href={`/stock/${stock.code}`}>
                          상세 보기
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="reportSection">
                  <h3>핵심 포인트</h3>
                  <ul className="bulletList">
                    {report.highlights.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="reportSection">
                  <h3>시장 코멘트</h3>
                  <p className="detailText">{report.marketNote}</p>
                </section>

                <section className="reportSection">
                  <h3>안내 문구</h3>
                  <p className="detailText">{report.disclaimer}</p>
                </section>
              </article>
            );
          })}
        </div>

        {/* TASK 3-2(디자인·IA 개편): /premium/reports를 여기 하단 섹션으로
            흡수. 실제 열람 권한 판정은 /reports/[id](app/lib/reportAccess.js)가
            서버에서 하므로, 여기 링크는 그냥 /reports/{id}로 보내면 된다 -
            토큰이 없으면 그 페이지가 알아서 잠금 화면을 보여준다. */}
        <section className="premiumSection">
          <div className="premiumHeader">
            <p className="badge premiumBadge">PREMIUM</p>
            <h2>프리미엄 주간 리포트</h2>
          </div>

          {!latestPremium && <p className="detailText">발행된 프리미엄 리포트가 아직 없습니다.</p>}

          {latestPremium && (
            <Link href={`/reports/${latestPremium.id}`} className="latestCard">
              <span className="latestBadge">최신 리포트</span>
              <p className="premiumDate">{latestPremium.issue_date}</p>
              <h3 className="premiumTitle">{latestPremium.topic_title}</h3>
            </Link>
          )}

          {restPremium.length > 0 && (
            <div className="subscribeBanner">
              <span className="subscribeBannerText">이전 리포트 {restPremium.length}건은 구독자만 볼 수 있습니다.</span>
              <Link href="/" className="subscribeBannerBtn">구독하고 전체 보기</Link>
            </div>
          )}

          {restPremium.length > 0 && (
            <ul className="premiumList">
              {restPremium.map((report) => (
                <li key={report.id} className="premiumItemWrap">
                  <Link href={`/reports/${report.id}`} className="premiumItemLink">
                    <span className="reportDateChip">{report.issue_date}</span>
                    <span className="reportDayType">{report.day_type}</span>
                    <span className="premiumTitleInline">{report.topic_title}</span>
                  </Link>
                  <div className="lockOverlay">
                    <span className="lockLabel"><Icon name="lock" size={16} /> 잠긴 리포트</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <ReportsPageStyles />
    </>
  );
}
