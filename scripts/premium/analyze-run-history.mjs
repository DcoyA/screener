// 프리미엄 파이프라인 실행 이력 분석 (STEP 9, task 6d).
//
// 재시작 버튼은 증상 완화지 치료가 아니다. 최근 N일 실행 기록을 시간대(KST)별로
// 집계해 "언제 실패하는가"를 본다. 특히 KST 05:00 스케줄이 전일 데이터 확정 전이라
// 실패율이 높은지 확인한다.
//
// 사용:
//   node scripts/premium/analyze-run-history.mjs [--days 30] [--workflow premium-data-collect.yml] > docs/ops/premium-pipeline-failure-analysis.md
//
// 필요: gh CLI 로그인 (gh auth status). GitHub Actions 안에서 돌리려면 GH_TOKEN 필요.

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
}

const DAYS = Number(argVal("--days", "30"));
const WORKFLOWS = argVal("--workflow", "premium-data-collect.yml,weekly-json-update.yml,premium-report-generate.yml,premium-report-send.yml")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LIMIT = Number(argVal("--limit", "300"));

const sinceMs = Date.now() - DAYS * 24 * 60 * 60 * 1000;

// UTC ISO → KST 시(0-23)
function kstHour(iso) {
  const d = new Date(iso);
  return (d.getUTCHours() + 9) % 24;
}
function kstDateStr(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function fetchRuns(workflow) {
  const out = execFileSync(
    "gh",
    [
      "run",
      "list",
      "--workflow",
      workflow,
      "--limit",
      String(LIMIT),
      "--json",
      "databaseId,status,conclusion,createdAt,event,displayTitle",
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  return JSON.parse(out);
}

const lines = [];
lines.push(`# 프리미엄 파이프라인 실패 분석 (최근 ${DAYS}일)`);
lines.push("");
lines.push(`생성: ${new Date().toISOString()} · \`node scripts/premium/analyze-run-history.mjs --days ${DAYS}\``);
lines.push("");

for (const wf of WORKFLOWS) {
  let runs;
  try {
    runs = fetchRuns(wf);
  } catch (e) {
    lines.push(`## ${wf}`);
    lines.push("");
    lines.push(`> 조회 실패: ${e.message.split("\n")[0]}`);
    lines.push("");
    continue;
  }

  // 완료된(스케줄/디스패치) 실행만. status !== 'completed' (진행 중) 제외.
  const done = runs.filter(
    (r) => r.status === "completed" && new Date(r.createdAt).getTime() >= sinceMs
  );

  lines.push(`## ${wf}`);
  lines.push("");
  if (done.length === 0) {
    lines.push("> 기간 내 완료된 실행 없음");
    lines.push("");
    continue;
  }

  const total = done.length;
  const failed = done.filter((r) => r.conclusion === "failure").length;
  const cancelled = done.filter((r) => r.conclusion === "cancelled").length;
  lines.push(
    `- 완료 실행: **${total}건** · 실패 **${failed}건 (${((failed / total) * 100).toFixed(1)}%)** · 취소 ${cancelled}건`
  );
  lines.push("");

  // 시간대(KST)별
  const byHour = new Map();
  for (const r of done) {
    const h = kstHour(r.createdAt);
    if (!byHour.has(h)) byHour.set(h, { total: 0, failed: 0 });
    const b = byHour.get(h);
    b.total += 1;
    if (r.conclusion === "failure") b.failed += 1;
  }
  lines.push("| KST 시각대 | 실행 | 실패 | 실패율 |");
  lines.push("|---|---|---|---|");
  for (const h of [...byHour.keys()].sort((a, b) => a - b)) {
    const b = byHour.get(h);
    lines.push(
      `| ${String(h).padStart(2, "0")}시 | ${b.total} | ${b.failed} | ${((b.failed / b.total) * 100).toFixed(0)}% |`
    );
  }
  lines.push("");

  // event별
  const byEvent = new Map();
  for (const r of done) {
    if (!byEvent.has(r.event)) byEvent.set(r.event, { total: 0, failed: 0 });
    const b = byEvent.get(r.event);
    b.total += 1;
    if (r.conclusion === "failure") b.failed += 1;
  }
  lines.push("| 트리거 | 실행 | 실패 | 실패율 |");
  lines.push("|---|---|---|---|");
  for (const [ev, b] of byEvent) {
    lines.push(`| ${ev} | ${b.total} | ${b.failed} | ${((b.failed / b.total) * 100).toFixed(0)}% |`);
  }
  lines.push("");

  // 최근 실패 목록
  const recentFails = done
    .filter((r) => r.conclusion === "failure")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);
  if (recentFails.length) {
    lines.push("최근 실패:");
    lines.push("");
    for (const r of recentFails) {
      lines.push(`- ${kstDateStr(r.createdAt)} ${String(kstHour(r.createdAt)).padStart(2, "0")}시 · ${r.event} · run ${r.databaseId}`);
    }
    lines.push("");
  }
}

lines.push("---");
lines.push("");
lines.push("## 해석 가이드");
lines.push("");
lines.push("- 특정 KST 시각대(특히 05시)의 실패율이 두드러지면, 전일 데이터가 아직");
lines.push("  확정되지 않은 시점에 도는 것일 수 있다 → 스케줄을 늦추는 것을 검토.");
lines.push("- `schedule` 실패율은 높은데 `workflow_dispatch`(수동/재시작)는 낮다면,");
lines.push("  시각대 의존 이슈일 가능성이 크다.");
lines.push("- 스케줄 변경은 별도 승인 후 진행한다(이 리포트는 근거 자료).");

console.log(lines.join("\n"));
