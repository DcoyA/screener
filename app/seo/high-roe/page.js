export const metadata = {
  title: 'ROE 높은 주식 | 수익성 좋은 종목 찾는 법 | 우량주 스카우터',
  description:
    'ROE 높은 주식이 왜 주목받는지, 수익성 좋은 종목을 고를 때 어떤 지표를 함께 봐야 하는지 설명합니다.',
  keywords: ['ROE 높은 주식', '수익성 좋은 종목', '고ROE 주식', '주식 분석', '주식 추천'],
  openGraph: {
    title: 'ROE 높은 주식 | 우량주 스카우터',
    description: 'ROE 중심으로 수익성 좋은 종목을 고르는 방법을 정리한 페이지입니다.',
    url: 'https://www.hellomedia.win/seo/high-roe',
    siteName: '우량주 스카우터',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function HighROEPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 leading-7 text-zinc-900">
      <h1 className="text-3xl font-bold mb-6">ROE 높은 주식은 왜 중요한가?</h1>

      <p className="mb-4">
        ROE는 자기자본이익률로, 기업이 자본을 얼마나 효율적으로 사용해 이익을 내는지를 보여주는
        대표 지표입니다. 일반적으로 ROE가 높다는 것은 수익성이 좋다는 뜻이지만, 부채를 과도하게
        활용해 인위적으로 높아진 경우도 있으므로 함께 봐야 할 지표가 있습니다.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">ROE만 보면 안 되는 이유</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>부채비율이 높으면 ROE가 과대하게 보일 수 있음</li>
        <li>일회성 이익으로 ROE가 일시적으로 높아질 수 있음</li>
        <li>업종 평균보다 어느 정도 높은지 비교가 필요함</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">ROE 높은 주식 체크 순서</h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>ROE를 먼저 본다</li>
        <li>부채비율과 PER, PBR을 함께 확인한다</li>
        <li>최근 실적 추세가 유지되는지 본다</li>
        <li>업종이 시장에서 강한지 점검한다</li>
      </ol>

      <p className="mt-6">
        즉, 고ROE 종목은 단독으로 보는 것이 아니라 <strong>저평가 여부와 재무안정성</strong>을 함께 봐야
        의미가 있습니다.
      </p>

      <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-xl font-semibold mb-3">수익성 포함 실제 랭킹 보기</h2>
        <p className="mb-4">
          우량주 스카우터는 ROE뿐 아니라 PER, PBR, 부채비율, 거래대금까지 함께 반영한 랭킹을
          제공합니다.
        </p>
        <a href="/ranking" className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-white">
          우량주 랭킹 확인하기
        </a>
      </div>
    </main>
  );
}
