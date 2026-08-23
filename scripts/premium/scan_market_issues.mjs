import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SEARCH_KEYWORDS = ["관세", "금리", "지정학", "반도체 정책", "환율"];

async function searchNews(keyword) {
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
    keyword
  )}&display=10&sort=date`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
  });
  if (!res.ok) {
    console.error(`뉴스 검색 실패 (${keyword}): ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.items || [];
}

function stripHtml(text) {
  return text.replace(/<[^>]*>/g, "");
}

async function extractIssuesWithLLM(newsSnippets) {
  const snippetText = newsSnippets
    .map((n) => `- 제목: ${stripHtml(n.title)} / 요약: ${stripHtml(n.description)} / 날짜: ${n.pubDate}`)
    .join("\n");

  const prompt = `아래는 최근 며칠간 수집된 국내 뉴스 스니펫 목록이다. 이 목록에 등장한 내용만 근거로 삼아서, 국내 증시에 영향을 줄 만한 지정학/정책/산업/사회 이슈를 최대 5개 선별하라. 목록에 없는 사실을 추가하거나 추측하지 말라. 각 이슈에 대해 category(geo/policy/industry/social 중 하나), title(15자 이내), summary(1~2문장), direction(bull/bear/neutral), impacted_sectors(관련 산업 목록), confidence(high/mid/low)를 JSON 배열로만 출력하라.

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

  const data = await res.json();
  const text = data?.content?.[0]?.text || "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("LLM 응답에서 JSON을 찾지 못했습니다:", text);
    return [];
  }
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  let allSnippets = [];
  for (const keyword of SEARCH_KEYWORDS) {
    const items = await searchNews(keyword);
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
    source_note: "naver_news_scan",
  }));

  if (rows.length > 0) {
    await supabase.from("market_issues").insert(rows);
    console.log(`market_issues에 ${rows.length}건 저장 완료`);
  }
}

main();
