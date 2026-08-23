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

  const prompt = `아래는 최근 3일간 수집된 국내외 뉴스 스니펫 목록이다. 이 목록에 등장한 내용만 근거로 삼아서, 국내 증시에 영향을 줄 만한 지정학/정책/산업/사회 이슈를 최대 5개 선별하라. 목록에 없는 사실을 추가하거나 추측하지 말라. 각 이슈에 대해 category(geo/policy/industry/social 중 하나), title(15자 이내), summary(1~2문장), direction(bull/bear/neutral), impacted_sectors(관련 산업 목록, 배열), confidence(high/mid/low)를 JSON 배열로만 출력하라. 다른 설명 문장 없이 JSON 배열만 출력하라.

뉴스 스니펫:
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
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("LLM 응답에서 JSON을 찾지 못했습니다:", text);
    return [];
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON 파싱 실패:", e, jsonMatch[0]);
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

  if (rows.length > 0) {
    const { error } = await supabase.from("market_issues").insert(rows);
    if (error) {
      console.error("market_issues 저장 실패:", error);
      process.exit(1);
    }
    console.log(`market_issues에 ${rows.length}건 저장 완료`);
  } else {
    console.log("추출된 이슈가 없습니다.");
  }
}

main();
