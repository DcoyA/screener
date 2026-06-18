export const metadata = {
  title: '주식 분석 AI 사이트 | 데이터 기반 종목 분석 | 우량주 스카우터',
  description:
    '주식 분석 AI가 무엇을 할 수 있는지, 데이터 기반 종목 선별이 어떤 방식으로 이루어지는지 설명합니다.',
  keywords: ['주식 분석 AI', 'AI 주식 추천', '주식 AI', '주식 분석 사이트', '데이터 기반 주식 분석'],
  openGraph: {
    title: '주식 분석 AI 사이트 | 우량주 스카우터',
    description: '데이터 기반 주식 분석 AI의 활용 방법을 소개합니다.',
    url: 'https://www.hellomedia.win/seo/ai-stock',
    siteName: '우량주 스카우터',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function AIStockPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 leading-7 text-zinc-900">
      <h1 className="text-3xl font-bold mb-6">주식 분석 AI, 실제로 무엇을 해주나?</h1>

      <p className="mb-4">
        주식 분석 AI는 일반적으로 재무지표, 밸류에이션, 유동성, 데이터 패턴을 기반으로 종목 후보를
        빠르게 좁혀주는 역할을 합니다. 다만 AI가 바로 매수/매도 정답을 주는 것은 아니며, 투자자는
        시장 상황과 뉴스, 업종 흐름까지 함께 판단해야 합니다.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">주식 분석 AI가 잘하는 것</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>수백~수천 개 종목을 빠르게 정량 필터링</li>
        <li>저평가, 수익성, 재무건전성 같은 기준을 일관되게 적용</li>
        <li>사람이 놓치기 쉬운 후보를 빠르게 추출</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">주식 분석 AI가 못하는 것</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>갑작스러운 뉴스, 지정학 이슈, 정책 변화의 즉시 반영</li>
        <li>정성적 리스크를 완벽히 해석하는 일</li>
        <li>진입 시점과 손절/익절을 자동으로 보장하는 일</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">그래서 어떻게 써야 하나?</h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>AI 랭킹으로 후보를 좁힌다</li>
        <li>뉴스와 업종 강도를 확인한다</li>
        <li>진입 조건과 손절 기준을 스스로 세운다</li>
      </ol>

      <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-xl font-semibold mb-3">AI 랭킹 서비스 확인하기</h2>
        <p className="mb-4">
          우량주 스카우터에서는 OpenDART와 KRX 데이터를 기반으로 종목을 선별하고 랭킹, 리스크,
          리포트 형태로 제공합니다.
        </p>
        <a href="/ranking" className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-white">
          주식 분석 AI 랭킹 보기
        </a>
      </div>
    </main>
  );
}
