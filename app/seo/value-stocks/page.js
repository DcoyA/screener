export const metadata = {
  title: '저평가 주식 추천 | 한국 가치주 찾는 법 | 우량주 스카우터',
  description:
    '저평가 주식과 가치주의 차이, 실제로 저평가 종목을 고를 때 필요한 체크포인트를 정리합니다.',
  keywords: ['저평가 주식', '가치주 추천', '한국 가치주', '주식 추천', '주식 분석'],
  openGraph: {
    title: '저평가 주식 추천 | 우량주 스카우터',
    description: '저평가 주식을 찾는 기준과 투자 전 확인할 사항을 정리한 페이지입니다.',
    url: 'https://www.hellomedia.win/seo/value-stocks',
    siteName: '우량주 스카우터',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function ValueStocksPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 leading-7 text-zinc-900">
      <h1 className="text-3xl font-bold mb-6">저평가 주식 추천, 정말 싼 주식은 어떻게 찾을까?</h1>

      <p className="mb-4">
        저평가 주식은 단순히 가격이 싼 종목이 아니라, 기업 가치 대비 시장 평가가 낮은 종목을 말합니다.
        하지만 모든 저평가 종목이 오르는 것은 아니며, 그 이유를 해석하는 과정이 중요합니다.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">저평가 주식을 찾는 핵심 기준</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>PER, PBR이 업종 평균 대비 낮은지</li>
        <li>ROE가 유지되는지</li>
        <li>부채비율이 과도하지 않은지</li>
        <li>거래대금이 충분해 실제 매매가 가능한지</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">진짜 저평가와 함정 구분하기</h2>
      <p className="mb-4">
        시장이 몰라서 싼 종목도 있지만, 업황 둔화, 실적 악화, 구조적 문제 때문에 계속 싼 종목도 있습니다.
        따라서 저평가 종목을 볼 때는 항상 <strong>왜 싼지</strong>를 먼저 확인해야 합니다.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">실전 매수 전 행동</h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>최근 공시와 뉴스 확인</li>
        <li>시장 주도 섹터와의 정합성 체크</li>
        <li>진입가, 손절가, 목표가 설정</li>
        <li>후보군 중 1~2개만 엄선해서 관찰</li>
      </ol>

      <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-xl font-semibold mb-3">현재 저평가 후보 랭킹 보기</h2>
        <p className="mb-4">
          우량주 스카우터에서 현재 상위 가치주 후보와 리스크 정보를 함께 확인할 수 있습니다.
        </p>
        <a href="/ranking" className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-white">
          저평가 주식 랭킹 보기
        </a>
      </div>
    </main>
  );
}
