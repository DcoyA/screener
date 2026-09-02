// Supabase 테이블 존재 프로브 - 읽기 전용 진단.
//
// STEP A 표에서 CI 로그 추론으로 존재 여부를 갈랐는데, 직접 프로브가 더 강한
// 근거라 근거를 하나로 통일한다. 각 테이블에 select '*' limit 1 을 날려
// error + status 를 함께 검사한다(C-2: head 응답의 회색지대 제거). 쓰기 없음.
// error 가 비어도 2xx 가 아니면 "의심" 으로 올린다. 판정은 사람이 한다
// (스크립트는 항상 exit 0). 데이터 본문은 로그에 안 찍고 행 유무만 본다.
//
// 실행: .github/workflows/probe-tables.yml (workflow_dispatch 전용).

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// STEP A 표의 테이블 전수. RPC 3종(execute_virtual_order /
// increment_send_log_open / increment_send_log_click)은 제외 - 함수 존재
// 확인은 별도 수단이 필요하고 execute_virtual_order 는 호출이 곧 주문 생성이다.
const TABLES = [
  "reports",
  "report_subscribers",
  "send_logs",
  "consent_logs",
  "topic_candidates",
  "market_issues",
  "disclosure_events",
  "flow_signals",
  "economic_calendar",
  "evergreen_topics",
  "literacy_topics",
  "latest_stock_snapshots",
  "stock_daily_snapshots",
  "stock_price_daily",
  "stocks",
  "batch_ingest_logs",
  "market_holidays",
  "pipeline_quality_log",
  "wishlists",
  "virtual_accounts",
  "virtual_holdings",
  "virtual_transactions",
  "demo_accounts",
];

// PostgREST/PG 에러코드 → 판정.
function classify(error) {
  if (!error) return "존재";
  const code = error.code || "";
  if (code === "PGRST205" || code === "42P01") return "부재";
  if (code === "42501") return "권한없음";
  return "기타";
}

async function probe(table) {
  try {
    // C-2: head:true 제거. 본문이 오는 요청(select '*' limit 1)으로 바꿔서
    //   HEAD 응답 특유의 "status는 4xx인데 error는 null" 회색지대를 없앤다.
    //   데이터는 로그에 안 찍는다 - 행 유무만 본다.
    const { data, error, status, statusText } = await supabase
      .from(table)
      .select("*")
      .limit(1);

    let verdict = classify(error);
    // C-2: error가 비어 있어도 2xx가 아니거나 data가 배열이 아니면 "존재"로
    //   판정하지 않는다. error-only 검사가 놓치는 층을 의심으로 올린다.
    if (!error && (status < 200 || status >= 300 || !Array.isArray(data))) {
      verdict = "의심";
    }

    const rowsPresent = error
      ? "-"
      : Array.isArray(data)
        ? data.length > 0
          ? "있음"
          : "없음(0행)"
        : "-";

    return {
      table,
      verdict,
      rows: rowsPresent,
      status: `${status ?? "-"}${statusText ? " " + statusText : ""}`,
      code: error ? error.code || "(코드없음)" : "-",
      raw:
        (error && classify(error) === "기타" && error.message) ||
        (verdict === "의심" && !error ? `status=${status} ${statusText || ""}` : null),
    };
  } catch (e) {
    return { table, verdict: "기타", rows: "-", status: "(throw)", code: "(throw)", raw: e.message };
  }
}

async function main() {
  const results = [];
  for (const t of TABLES) {
    results.push(await probe(t));
  }

  const w = Math.max(...TABLES.map((t) => t.length));
  console.log(`${"테이블".padEnd(w)} | 판정      | 행 유무     | status        | 에러코드`);
  console.log(`${"-".repeat(w)}-+-----------+-------------+---------------+---------`);
  for (const r of results) {
    console.log(
      `${r.table.padEnd(w)} | ${String(r.verdict).padEnd(9)} | ${String(r.rows).padEnd(11)} | ${String(r.status).padEnd(13)} | ${r.code}`
    );
  }

  const others = results.filter((r) => r.raw);
  if (others.length) {
    console.log("\n[기타] 에러 원문:");
    for (const r of others) console.log(`  ${r.table}: ${r.raw}`);
  }

  // 진단이므로 항상 성공 종료. 판정은 사람이 표를 보고 한다.
  process.exit(0);
}

main();
