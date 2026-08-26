import {
  containsForbiddenPhrase,
  MAX_ABS_UPSIDE_PERCENT,
  MIN_INVALIDATION_LENGTH,
} from "./reportSchema.mjs";

const UPSIDE_KEYWORD = "상승여력";
const PERCENT_PATTERN = /([+-]?\d+(?:\.\d+)?)\s*%/g;

// "상승여력"이 언급된 문장에서만 %숫자를 검사한다 - 영업이익률/지분율처럼
// 상승여력과 무관한 퍼센트까지 걸리면 검증이 무의미해진다.
function findUpsideViolations(text) {
  if (!text) return [];
  const violations = [];
  const sentences = text.split(/(?<=[.!?\n])/);

  for (const sentence of sentences) {
    if (!sentence.includes(UPSIDE_KEYWORD)) continue;
    PERCENT_PATTERN.lastIndex = 0;
    let match;
    while ((match = PERCENT_PATTERN.exec(sentence))) {
      const value = parseFloat(match[1]);
      if (Math.abs(value) > MAX_ABS_UPSIDE_PERCENT) {
        violations.push({ sentence: sentence.trim(), value });
      }
    }
  }
  return violations;
}

function collectTextFields(report) {
  const texts = [];
  if (report.cover?.headline) texts.push(report.cover.headline);
  if (report.cover?.market_temp) texts.push(report.cover.market_temp);

  for (const s of report.sections || []) {
    texts.push(s.title, s.what_happened, s.why_it_matters, s.invalidation);
    for (const horizon of ["short", "mid", "long"]) {
      const sc = s.scenarios?.[horizon];
      if (sc) texts.push(sc.view, sc.watch);
    }
    for (const rs of s.related_stocks || []) {
      texts.push(rs.one_liner);
    }
  }

  if (report.disclaimer) texts.push(report.disclaimer);
  return texts.filter(Boolean);
}

// supabase를 넘기면 related_stocks[].code의 실존 여부까지 검증한다(선택 -
// 픽스처 단위 테스트에선 생략 가능하게).
export async function validateReport(report, { supabase } = {}) {
  const errors = [];

  if (!report || typeof report !== "object") {
    return { ok: false, errors: ["리포트가 객체가 아닙니다"] };
  }
  if (!Array.isArray(report.sections) || report.sections.length === 0) {
    return { ok: false, errors: ["sections가 비어있습니다"] };
  }

  const texts = collectTextFields(report);

  for (const t of texts) {
    const phrase = containsForbiddenPhrase(t);
    if (phrase) {
      errors.push(`금지 표현 "${phrase}" 발견: "${t.slice(0, 60)}"`);
    }
    for (const v of findUpsideViolations(t)) {
      errors.push(`상승여력 ±${MAX_ABS_UPSIDE_PERCENT}% 초과 수치(${v.value}%) 발견: "${v.sentence.slice(0, 60)}"`);
    }
  }

  report.sections.forEach((s, i) => {
    const label = s.title || `섹션 ${i + 1}`;
    if (!s.invalidation || s.invalidation.length < MIN_INVALIDATION_LENGTH) {
      errors.push(`[${label}] invalidation이 없거나 ${MIN_INVALIDATION_LENGTH}자 미만입니다`);
    }
    if (!Array.isArray(s.sources) || s.sources.length === 0) {
      errors.push(`[${label}] sources가 비어있습니다(최소 1개 필요)`);
    }
  });

  if (supabase) {
    const allCodes = [
      ...new Set(
        report.sections.flatMap((s) => (s.related_stocks || []).map((rs) => rs.code)).filter(Boolean)
      ),
    ];

    if (allCodes.length > 0) {
      const { data, error } = await supabase.from("latest_stock_snapshots").select("code").in("code", allCodes);
      if (error) {
        errors.push(`latest_stock_snapshots 조회 실패로 종목코드 검증을 건너뜁니다: ${error.message}`);
      } else {
        const validCodes = new Set((data || []).map((r) => r.code));
        const invalidCodes = allCodes.filter((c) => !validCodes.has(c));
        if (invalidCodes.length > 0) {
          errors.push(`실제 존재하지 않는 종목코드: ${invalidCodes.join(", ")}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
