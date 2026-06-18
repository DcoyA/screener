export const metadata = {
  title: '이번 주 추천 종목 | 주간 관심 주식 점검 | 우량주 스카우터',
  description:
    '이번 주 관심 종목을 어떻게 점검해야 하는지, 주간 랭킹 데이터를 실제 투자에 연결하는 방법을 설명합니다.',
  keywords: ['이번 주 추천 종목', '주간 추천 주식', '관심 종목', '주식 추천', '주간 랭킹'],
  openGraph: {
    title: '이번 주 추천 종목 | 우량주 스카우터',
    description: '주간 랭킹 상위 종목을 실제 투자 후보로 바꾸는 방법을 정리한 페이지입니다.',
    url: 'https://www.hellomedia.win/seo/weekly-stocks',
    siteName: '우량주 스카우터',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function WeeklyStocksPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 leading-7 text-zinc-900">
      <h1 className="text-3xl font-bold mb-6">이번 주 추천 종목, 그대로 사도 될까?</h1>

      <p className="mb-4">
        주간 랭킹 상위 종목은 좋은 출발점이 될 수 있지만, 그대로 매수 버튼을 누르기에는 부족합니다.
        랭킹은 후보군일 뿐이며, 실제 투자 전에는 시장 상황과 뉴스, 진입 타이밍을 추가로 확인해야 합니다.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">주간 랭킹 활용 순서</h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>랭킹 상위 3~5개를 먼저 추린다</li>
        <li>업종 강도와 시장 주도 섹터 여부를 본다</li>
        <li>각 종목의 뉴스와 최근 가격 흐름을 본다</li>
        <li>매수 후보는 1~2개로만 압축한다</li>
      </ol>

      <h2 className="text-2xl font-semibold mt-10 mb-4">이번 주 추천 종목을 볼 때 체크할 질문</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>왜 이 종목이 상위에 올라왔는가?</li>
        <li>왜 시장은 아직 이 종목을 강하게 사지 않는가?</li>
        <li>업종과 타이밍이 맞는가?</li>
        <li>지금 바로 사는 것보다 기다리는 게 나은가?</li>
      </ul>

      <p className="mt-6">
        결국 이번 주 추천 종목은 <strong>감시 목록</strong>으로 쓰고, 그중 조건이 맞는 종목만 실제 매수로
        연결하는 것이 안전합니다.
      </p>

      <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-xl font-semibold mb-3">이번 주 랭킹과 리포트 보기</h2>
        <p className="mb-4">
          우량주 스카우터에서 최신 랭킹과 주간 리포트를 함께 확인할 수 있습니다.
        </p>
        <div className="flex gap-3 flex-wrap">
          <a href="/ranking" className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-white">
            랭킹 보기
          </a>
          <a href="/report" className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-zinc-900">
            리포트 보기
          </a>
        </div>
      </div>
    </main>
  );
}
