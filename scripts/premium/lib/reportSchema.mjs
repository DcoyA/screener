// 프리미엄 리포트의 "표현 규칙" 상수 모음.
// 출력 형식(키/중첩/길이) 스키마는 scripts/premium/report-schema.mjs(zod)로
// 단일화했다 - 여기엔 형식 예시(REPORT_JSON_EXAMPLE)를 두지 않는다.
// 이 파일은 금지 표현 목록 등 zod 로 표현 못 하는 후처리 검증 상수만 남긴다.

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

export function containsForbiddenPhrase(text) {
  if (!text) return null;
  return FORBIDDEN_PHRASES.find((p) => text.includes(p)) || null;
}
