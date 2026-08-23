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
  }));
}

function stripHtml(text) {
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function extractIssuesWithLLM(newsSnippets) {
  const snippetText = newsSnippets
    .map(
      (n) =>
        `- 제목: ${n.title} / 요약: ${n.description} / 날짜: ${n.pubDate} / 출처: ${n.source}`
    )
    .join("\n");

  const prompt = `아래는 최근 3일간 수집된 국내외 뉴스 제목/스니펫 목록이다.

이 목록의 제목만 봐도 국내 증시(코스피/코스닥)나 특정 산업/섹터에 조금이라도 영향을 줄 수 있다고 판단되면 이슈로 선정하라. 완전히 무관한 연예/스포츠 기사만 아니면 최대한 관대하게 선정하되, 최소 1개에서 최대 5개까지 선별하라.

목록에 없는 사실을 새로 만들어내지는 말고, 각 이슈에 대해 다음 필드를 가진 JSON 배열만 출력하라 (다른 설명 문장 절대 넣지 말 것):
- category: geo/policy/industry/social 중 하나
- title: 15자 이내 한글 제목
- summary: 1~2문장 요약
- direction: bull/bear/neutral 중 하나
- impacted_sectors: 관련 산업/섹터명 배열 (예: ["반도체","자동차"])
- confidence: high/mid/low 중 하나

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
  const text = data?.content?.[0]?.text || "[]";

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

async function main() {
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

  const today = new Date().toISOString().slice(0, 10);
  const rows = issues.map((issue) => ({
    issue_date: today,
    category: issue.category,
    title: issue.title,
    summary: issue.summary,
    direction: issue.direction,
    impacted_sectors: issue.impacted_sectors || [],
    impacted_codes: [],
    confidence: issue.confidence,
    source_note: "google_news_rss_scan",
  }));

  const { error } = await supabase.from("market_issues").insert(rows);
  if (error) {
    console.error("market_issues 저장 실패:", error);
    process.exit(1);
  }
  console.log(`market_issues에 ${rows.length}건 저장 완료`);
}

main();
