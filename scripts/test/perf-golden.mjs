// /performance 골든 스냅샷 — STEP 8 서버 래퍼 전환 전후 정합성 검증.
//
// buildPerformanceData / history.json / stocks.json 은 이번 작업에서 안 건드린다.
// 따라서 렌더된 /performance 의 KPI·생존편향·벤치마크 기준일·주차별 테이블 전 행이
// 리팩터링 전후로 완전히 같아야 한다. 다르면 slim 투영이 필드를 누락한 것 → 실패.
//
// 사용:
//   node scripts/test/perf-golden.mjs http://localhost:3100 > before.txt
//   node scripts/test/perf-golden.mjs http://localhost:3100 > after.txt
//   diff before.txt after.txt   (아무 출력 없어야 통과)

const base = process.argv[2] || "http://localhost:3100";

const res = await fetch(`${base}/performance`);
const html = await res.text();

function stripTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const out = [];

// 1) KPI / 요약 문구들 (사용자가 지정한 골든 항목)
const fullText = stripTags(html);
const pick = (label, re) => {
  const m = fullText.match(re);
  out.push(`${label}: ${m ? m[0].trim() : "(NOT FOUND)"}`);
};
pick("전체승률", /전체 승률 [0-9.]+%/);
pick("표본", /표본 [0-9]+ ?주차[^.]*/);
pick("초과수익", /평균 초과수익 [+-]?[0-9.]+%/);
pick("생존편향", /전체의 [0-9.]+% 로 다소 높습니다 - 생존 편향 가능성/);
pick("벤치기준일", /기준일 [0-9]{4}-[0-9]{2}-[0-9]{2} KOSPI 기준값 [0-9,]+/);

// 2) 주차별 테이블 전 행 (class에 historyTable 포함하는 table)
const tableMatch = html.match(/<table[^>]*historyTable[^>]*>[\s\S]*?<\/table>/);
if (!tableMatch) {
  out.push("historyTable: (NOT FOUND)");
} else {
  const rowMatches = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
  out.push(`historyTable rows: ${rowMatches.length}`);
  rowMatches.forEach((tr, i) => {
    const cells = (tr.match(/<t[hd][\s\S]*?<\/t[hd]>/g) || []).map((c) => stripTags(c));
    out.push(`row[${i}] | ${cells.join(" | ")}`);
  });
}

console.log(out.join("\n"));
