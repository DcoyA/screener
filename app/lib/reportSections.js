// 프리미엄 리포트 섹션 필터 (STEP 10 B).
//
// 승인 시 편집자가 고른 "빼고 발송할 섹션"은 reports.excluded_sections(int[])에
// content_json.sections 원본 배열 기준 0-based 인덱스로 저장된다. content_json
// 자체는 절대 수정하지 않으므로, 렌더 시점에 이 함수로 걸러낸다.
//
// 이메일 템플릿(scripts/premium/lib/emailTemplate.mjs)과 웹 뷰
// (app/reports/[id]/page.js)가 같은 규칙을 쓰도록 한 곳에 둔다.

function excludedSet(report) {
  const raw = report?.excluded_sections;
  return new Set(Array.isArray(raw) ? raw.map(Number).filter(Number.isInteger) : []);
}

// 발송/노출 대상 섹션만. 원본 배열은 건드리지 않는다.
export function visibleSections(report) {
  const all = report?.content_json?.sections || [];
  const excl = excludedSet(report);
  return all.filter((_, i) => !excl.has(i));
}

// 전 섹션이 제외됐는지(발송 차단 가드용).
export function allSectionsExcluded(report) {
  const all = report?.content_json?.sections || [];
  if (all.length === 0) return false;
  return visibleSections(report).length === 0;
}
