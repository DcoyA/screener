// 프리미엄 리포트 콘텐츠 스키마. generate-report.mjs(프롬프트 구성)와
// validateReport.mjs(후처리 검증) 양쪽이 이 파일을 단일 출처로 삼는다 -
// 스키마가 바뀌면 여기 한 곳만 고치면 프롬프트/검증이 같이 따라온다.

export const FORBIDDEN_PHRASES = [
  "수익 보장",
  "확정 수익률",
  "매수하세요",
  "매도하세요",
  "지금이 기회",
  "급등 임박",
  "지금 사세요",
  "지금 파세요",
];

// 상승여력을 산문 안에서 숫자로 언급할 때의 절대값 상한(±60%).
// app/lib/formatUpside.js의 표시 밴드(+60/-40 비대칭, 화면에 찍히는 단일
// 계산값용)와는 별개 규칙이다 - 이건 LLM이 자유 문장에 쓰는 숫자를 걸러내는
// 용도라 문서에 명시된 대칭 ±60%를 그대로 쓴다.
export const MAX_ABS_UPSIDE_PERCENT = 60;

export const MIN_INVALIDATION_LENGTH = 20;

export const VALID_FOLLOWUP_VERDICTS = ["맞음", "틀림", "진행중"];

// buildPrompt가 이 예시를 그대로 프롬프트에 박아 넣는다 - 실제 응답도 이
// 형태와 100% 같은 키 이름/중첩 구조를 써야 한다.
export const REPORT_JSON_EXAMPLE = {
  cover: {
    headline: "오늘 리포트 전체를 대표하는 한 줄 제목",
    market_temp: "오늘 시장 분위기를 한 문장으로",
    reading_time_min: 7,
  },
  sections: [
    {
      title: "이 섹션(후보)의 제목",
      what_happened: "사실만. 무슨 일이 있었는지 2~4문장",
      why_it_matters: "해석. 왜 중요한지 1~3문장",
      scenarios: {
        short: { horizon: "1~4주", view: "단기 관점 1~2문장", watch: "단기에 지켜볼 지표/이벤트" },
        mid: { horizon: "1~6개월", view: "중기 관점 1~2문장", watch: "중기에 지켜볼 지표/이벤트" },
        long: { horizon: "1년+", view: "장기 관점 1~2문장", watch: "장기에 지켜볼 지표/이벤트" },
      },
      invalidation: "이 시나리오가 틀렸다고 봐야 하는, 검증 가능한 조건(최소 20자)",
      related_stocks: [
        {
          code: "종목코드(컨텍스트 데이터에 있는 코드만)",
          name: "종목명",
          grade: "현재 등급(컨텍스트 데이터 값 그대로)",
          grade_4w_ago: "4주 전 등급(데이터 없으면 null)",
          sector_percentile: "섹터 내 상대적 위치(데이터에 없으면 null)",
          one_liner: "이 종목이 왜 관련 있는지 한 줄",
          stance: "bullish|bearish|neutral - 이 섹션이 이 종목에 대해 취하는 방향성. " +
            "7일 뒤 후속 추적(build-followup.mjs)이 실제 주가 변동과 대조해 맞음/틀림을 " +
            "자동 판정하는 데 쓰이므로 반드시 채워라(회피성으로 전부 neutral로 쓰지 말 것)",
        },
      ],
      sources: [{ type: "공시|뉴스|데이터", url: "근거 URL", date: "YYYY-MM-DD" }],
    },
  ],
  followup: [
    {
      from_issue: "지난 리포트 발행일(YYYY-MM-DD)",
      topic: "그때 다룬 주제",
      what_changed: "그 사이 무엇이 바뀌었는지",
      verdict: "맞음|틀림|진행중",
    },
  ],
  next_week_calendar: [{ date: "YYYY-MM-DD", event: "일정명", why: "왜 봐야 하는지" }],
  disclaimer: "투자 참고용 고지 문구",
};

export function containsForbiddenPhrase(text) {
  if (!text) return null;
  return FORBIDDEN_PHRASES.find((p) => text.includes(p)) || null;
}
