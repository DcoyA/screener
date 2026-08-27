import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SEARCH_KEYWORDS = ["관세", "금리", "지정학 리스크", "반도체 정책", "환율"];

const parser = new XMLParser();

async function searchGoogleNews(keyword) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    keyword
  )}+when:3d&hl=ko&gl=KR&ceid=KR:ko`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PremiumReportBot/1.0)",
    },
  });

  if (!res.ok) {
    console.error(`구글 뉴스 RSS 조회 실패 (${keyword}): ${res.status}`);
    return [];
  }

  const xmlText = await res.text();
  const data = parser.parse(xmlText);
  const items = data?.rss?.channel?.item;
  if (!items) return [];

  const itemList = Array.isArray(items) ? items : [items];

  return itemList.slice(0, 8).map((item) => ({
    title: item.title || "",
    description: stripHtml(item.description || ""),
    pubDate: item.pubDate || "",
    source: item.source?.["#text"] || item.source || "",
    // STEP 10: 출처 귀속용. 없으면 '' 가 아니라 null (NULL/'' 혼재 방지).
    link: item.link || null,
  }));
}

function stripHtml(text) {
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function extractIssuesWithLLM(newsSnippets) {
  // 프롬프트 조립과 매핑은 같은 배열(newsSnippets)의 1-based 인덱스를 쓴다.
  const snippetText = newsSnippets
    .map(
      (n, i) =>
        `[${i + 1}] 제목: ${n.title} / 요약: ${n.description} / 날짜: ${n.pubDate} / 출처: ${n.source}`
    )
    .join("\n");

  const prompt = `아래는 최근 3일간 수집된 국내외 뉴스 제목/스니펫 목록이다. 각 항목 앞의 [N]은 기사 번호다.

너는 반드시 이 목록에서 최소 1개, 최대 5개의 이슈를 골라야 한다. "관련성이 애매해서 못 고르겠다"는 답은 허용되지 않는다. 완전히 무관한 연예/스포츠 기사가 아니라면, 국내 증시(코스피/코스닥)와의 연결고리가 조금이라도 있다고 볼 수 있으면 무조건 이슈로 포함시켜라. 정말 연관성이 약하다고 판단되면 confidence를 low로 표시하되, 그래도 최소 1개는 반드시 채워서 출력하라.

목록에 없는 사실을 새로 만들어내지는 말고, 각 이슈에 대해 다음 필드를 가진 JSON 배열만 출력하라 (다른 설명 문장 절대 넣지 말 것, 반드시 배열 형태로만 출력):
- category: geo/policy/industry/social 중 하나
- title: 15자 이내 한글 제목
- summary: 1~2문장 요약
- direction: bull/bear/neutral 중 하나
- impacted_sectors: 관련 산업/섹터명 배열 (예: ["반도체","자동차"])
- confidence: high/mid/low 중 하나
- source_indices: 이 이슈의 근거가 된 위 목록의 기사 번호(정수) 배열. 예: [2, 5]. 실제로 근거가 된 것만 넣고 추측하지 마라. 확실한 근거가 없으면 빈 배열 []. 최대 5개.

예시 형식(값은 예시일 뿐):
[{"category":"policy","title":"금리 인하 기대 확대","summary":"한은 총재 발언으로 인하 기대가 커졌다.","direction":"bull","impacted_sectors":["은행","건설"],"confidence":"mid","source_indices":[3,7]}]

뉴스 목록:
${snippetText}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Anthropic API 호출 실패: ${res.status} - ${errText}`);
    return [];
  }

  const data = await res.json();
  console.log("=== Anthropic 응답 전체 구조 (진단용) ===");
  console.log(JSON.stringify(data, null, 2));
  console.log("=== 응답 전체 구조 끝 ===");

  const textBlock = (data?.content || []).find((block) => block.type === "text");
  const text = textBlock?.text || "[]";

  if (!textBlock) {
    console.error("응답 content 배열에 type='text' 블록이 없습니다. content 블록 타입들:", (data?.content || []).map((b) => b.type));
  }

  // 진단용: 성공 여부와 무관하게 항상 원문 응답을 로그로 남긴다
  console.log("=== LLM 원문 응답 시작 ===");
  console.log(text);
  console.log("=== LLM 원문 응답 끝 ===");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("LLM 응답에서 JSON 배열을 찾지 못했습니다.");
    return [];
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON 파싱 실패:", e.message);
    console.error("파싱 시도했던 원문:", jsonMatch[0]);
    return [];
  }
}

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.toString();
  } catch {
    return String(u || "").trim();
  }
}

// LLM이 반환한 source_indices → [{url, title}] (STEP 10).
// LLM에게 URL을 만들게 하지 않고 번호만 받아 범위 검증 후 매핑한다.
//  - 정수 강제변환, 1..snippetCount 범위, 중복 제거(번호 + URL), 최대 5개
//  - 유효 0개면 [] (NULL 아님). 여기서 억지로 채우지 않는다 = 2번 폴백.
function resolveIssueSources(rawIndices, snippets, issueTitle) {
  const dropped = [];
  const seenIdx = new Set();
  const validIdx = [];
  for (const raw of Array.isArray(rawIndices) ? rawIndices : []) {
    const n = Math.trunc(Number(raw));
    if (!Number.isInteger(n) || n < 1 || n > snippets.length) {
      dropped.push(raw);
      continue;
    }
    if (seenIdx.has(n)) continue;
    seenIdx.add(n);
    validIdx.push(n);
    if (validIdx.length >= 5) break;
  }
  if (dropped.length > 0) {
    console.warn(`[source attribution] "${issueTitle}" 무효 번호 버림: ${JSON.stringify(dropped)}`);
  }

  const seenUrl = new Set();
  const sources = [];
  for (const n of validIdx) {
    const snip = snippets[n - 1];
    if (!snip?.link) continue; // link 없는 기사는 건너뜀
    const key = normalizeUrl(snip.link);
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    sources.push({ url: snip.link, title: snip.title || "(제목 없음)" });
  }
  return { sources, droppedCount: dropped.length };
}

// 멱등성 가드(STEP 9): market_issues에 오늘(issue_date) 행이 이미 있으면 True.
// market_issues는 plain insert라 재실행 시 중복이 쌓인다. 조회 실패 시 fail-open.
async function alreadyScannedToday(today) {
  try {
    const { data, error } = await supabase
      .from("market_issues")
      .select("id")
      .eq("issue_date", today)
      .limit(1);
    if (error) {
      console.warn(`[멱등성] market_issues 오늘자 확인 실패, 계속 진행: ${error.message}`);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.warn(`[멱등성] market_issues 오늘자 확인 예외, 계속 진행: ${e.message}`);
    return false;
  }
}

const DRY_RUN = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // collect 워크플로를 실패 지점부터 재실행해도 이미 끝난 이 단계는 건너뛴다.
  // FORCE=1이면 무시하고 강제 재수집(구글 뉴스 스크랩 + LLM 호출까지 다시 돈다).
  if (!DRY_RUN && process.env.FORCE !== "1" && (await alreadyScannedToday(today))) {
    console.log(`[멱등성] market_issues에 오늘(${today}) 데이터가 이미 있어 스킵합니다 (강제 재수집: FORCE=1)`);
    return;
  }

  let allSnippets = [];
  for (const keyword of SEARCH_KEYWORDS) {
    const items = await searchGoogleNews(keyword);
    console.log(`[${keyword}] ${items.length}건 수집`);
    allSnippets = allSnippets.concat(items);
  }
  console.log(`총 ${allSnippets.length}건 뉴스 스니펫 수집됨`);

  if (allSnippets.length === 0) {
    console.log("수집된 뉴스가 없어 이슈 추출을 건너뜁니다.");
    return;
  }

  const issues = await extractIssuesWithLLM(allSnippets);
  console.log(`LLM이 추출한 이슈 ${issues.length}건`);

  if (issues.length === 0) {
    console.log("추출된 이슈가 없습니다.");
    return;
  }

  // 출처 귀속: LLM source_indices → [{url,title}]
  let attributedCount = 0;
  let totalLinks = 0;
  let droppedTotal = 0;
  const enriched = issues.map((issue) => {
    const { sources, droppedCount } = resolveIssueSources(
      issue.source_indices,
      allSnippets,
      issue.title || "(제목 없음)"
    );
    droppedTotal += droppedCount;
    if (sources.length > 0) attributedCount += 1;
    totalLinks += sources.length;
    return { ...issue, sources };
  });

  const pct = issues.length ? Math.round((attributedCount / issues.length) * 100) : 0;
  const avgLinks = issues.length ? (totalLinks / issues.length).toFixed(1) : "0";
  console.log(
    `[source attribution] 이슈 ${issues.length}건 중 귀속 성공 ${attributedCount}건(${pct}%), ` +
      `평균 링크 ${avgLinks}개, 무효번호 버림 ${droppedTotal}건`
  );

  if (DRY_RUN) {
    console.log("\n===== DRY RUN: 저장 안 함. 이슈 ↔ 근거 대조 =====");
    enriched.forEach((issue, i) => {
      console.log(`\n[이슈 ${i + 1}] ${issue.title}  (${issue.category}/${issue.confidence}/${issue.direction})`);
      console.log(`  요약: ${issue.summary}`);
      console.log(`  source_indices(원문): ${JSON.stringify(issue.source_indices)}`);
      if (issue.sources.length === 0) {
        console.log(`  → 매핑된 출처: 없음 (자동 귀속 실패)`);
      } else {
        issue.sources.forEach((s) => console.log(`  → ${s.title}\n     ${s.url}`));
      }
    });
    console.log("\n===== DRY RUN 끝 =====");
    return;
  }

  const rows = enriched.map((issue) => ({
    issue_date: today,
    category: issue.category,
    title: issue.title,
    summary: issue.summary,
    direction: issue.direction,
    impacted_sectors: issue.impacted_sectors || [],
    impacted_codes: [],
    confidence: issue.confidence,
    source_note: "google_news_rss_scan",
    // [{url, title}] - LLM source_indices 로 귀속. 자동 귀속 실패 시 [](NULL 아님).
    sources: issue.sources,
  }));

  const { error } = await supabase.from("market_issues").insert(rows);
  if (error) {
    console.error("market_issues 저장 실패:", error);
    process.exit(1);
  }
  console.log(`market_issues에 ${rows.length}건 저장 완료`);
}

main();
