export const metadata = {
  title: '한국 주식 추천 | 국내 상장 종목 분석',
  description: '한국 주식 시장에서 투자할 종목을 찾는 기준',
};

export default function Page() {
  return (
    <main>
      <h1>한국 주식 추천, 어떻게 골라야 할까?</h1>
      <p>국내 주식은 업종 흐름을 함께 봐야 합니다.</p>

      <ul>
        <li>시장 주도 섹터 확인</li>
        <li>거래대금 확인</li>
        <li>외국인 수급</li>
      </ul>

      <a href="/ranking">현재 랭킹 보기</a>
    </main>
  );
}
