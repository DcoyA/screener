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

너는 반드시 이 목록에서 최소 1개, 최대 5개의 이슈를 골라야 한다. "관련성이 애매해서 못 고르겠다"는 답은 허용되지 않는다. 완전히 무관한 연예/스포츠 기사가 아니라면, 국내 증시(코스피/코스닥)와의 연결고리가 조금이라도 있다고 볼 수 있으면 무조건 이슈로 포함시켜라. 정말 연관성이 약하다고 판단되면 confidence를 low로 표시하되, 그래도 최소 1개는 반드시 채워서 출력하라.

목록에 없는 사실을 새로 만들어내지는 말고, 각 이슈에 대해 다음 필드를 가진 JSON 배열만 출력하라 (다른 설명 문장 절대 넣지 말 것, 반드시 배열 형태로만 출력):
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

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // collect 워크플로를 실패 지점부터 재실행해도 이미 끝난 이 단계는 건너뛴다.
  // FORCE=1이면 무시하고 강제 재수집(구글 뉴스 스크랩 + LLM 호출까지 다시 돈다).
  if (process.env.FORCE !== "1" && (await alreadyScannedToday(today))) {
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
