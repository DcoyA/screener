import { createClient } from "@supabase/supabase-js";
import { isMarketHoliday, isWeekendKst, kstDateStr } from "./lib/market-calendar.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NULL_TARGET_PRICE_RATIO_MAX = 0.3;
const PREV_DAY_COUNT_RATIO_MIN = 0.5;
const S_GRADE_RATIO_MIN = 0.03;
const S_GRADE_RATIO_MAX = 0.15;

async function countForDate(date) {
  const { count, error } = await supabase
    .from("latest_stock_snapshots")
    .select("code", { count: "exact", head: true })
    .eq("snapshot_date", date);
  if (error) throw error;
  return count;
}

async function fetchMostRecentPriorDate(today) {
  const { data, error } = await supabase
    .from("latest_stock_snapshots")
    .select("snapshot_date")
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.snapshot_date || null;
}

async function countNullTargetPrice(today) {
  const { count, error } = await supabase
    .from("latest_stock_snapshots")
    .select("code", { count: "exact", head: true })
    .eq("snapshot_date", today)
    .or("raw_data->metrics->>targetPrice.is.null,raw_data->metrics->>targetPrice.eq.0");
  if (error) throw error;
  return count;
}

async function countGrade(today, grade) {
  const { count, error } = await supabase
    .from("latest_stock_snapshots")
    .select("code", { count: "exact", head: true })
    .eq("snapshot_date", today)
    .eq("unified_grade_code", grade);
  if (error) throw error;
  return count;
}

function buildActionsLink() {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repo || !runId) return "(로컬 실행 - Actions 링크 없음)";
  return `https://github.com/${repo}/actions/runs/${runId}`;
}

async function sendSlackAlert(failures) {
  // 전용 ALERT_WEBHOOK_URL 시크릿은 만들지 않고, 이미 존재하는
  // SLACK_WEBHOOK_URL(프리미엄 에디터 알림과 같은 채널)을 재사용한다.
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("SLACK_WEBHOOK_URL 미설정 - 슬랙 전송을 생략합니다");
    return;
  }

  const lines = failures
    .map((f) => `• *${f.label}* - 실측: ${f.actual} / 기대: ${f.expected}`)
    .join("\n");

  const text = `:rotating_light: [워치독] 오늘(${kstDateStr()}) 데이터 검증 실패 ${failures.length}건\n${lines}\n${buildActionsLink()}`;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    console.error(`슬랙 전송 실패: ${res.status} - ${await res.text()}`);
  } else {
    console.log("[검증] 슬랙 알림 전송 완료");
  }
}

async function main() {
  const today = kstDateStr();

  // 알림 배선 자체를 실제 데이터 상태와 무관하게 테스트하기 위한 강제 실패 경로
  if (process.env.FORCE_FAIL) {
    console.error("[검증] FORCE_FAIL 설정됨 - 강제로 실패 처리합니다");
    await sendSlackAlert([
      { label: "FORCE_FAIL 강제 테스트", actual: "강제 실패", expected: "알림 경로 확인용(정상 동작이면 실패 아님)" },
    ]);
    process.exit(1);
  }

  // 거래일이 아니면 스냅샷이 없는 게 정상이므로 검증을 건너뛴다. cron 지연으로
  // 실행이 KST 자정을 넘겨 주말/휴장일로 밀려도 여기서 걸러진다.
  if (isWeekendKst()) {
    console.log("[스킵] 비거래일(주말)");
    return;
  }
  let holiday;
  try {
    holiday = await isMarketHoliday(supabase, today);
  } catch (err) {
    // 조회 실패를 휴장일로 오인하면 진짜 장애를 놓친다 - 실패로 처리한다.
    console.error(`[검증] ${err.message}`);
    process.exit(1);
  }
  if (holiday) {
    console.log("[스킵] 비거래일(휴장일)");
    return;
  }

  const failures = [];

  const todayCount = await countForDate(today);
  console.log(`[검증] 오늘(${today}) 행 수: ${todayCount}`);
  if (todayCount === 0) {
    failures.push({ label: "오늘 날짜 행 존재", actual: "0건", expected: "1건 이상" });
  }

  const prevDate = await fetchMostRecentPriorDate(today);
  if (prevDate) {
    const prevCount = await countForDate(prevDate);
    const ratio = prevCount > 0 ? todayCount / prevCount : 0;
    console.log(
      `[검증] 직전 데이터 날짜(${prevDate}) 행 수: ${prevCount}, 오늘 대비 비율: ${(ratio * 100).toFixed(1)}%`
    );
    if (ratio < PREV_DAY_COUNT_RATIO_MIN) {
      failures.push({
        label: "직전 데이터 대비 행 수 비율",
        actual: `${(ratio * 100).toFixed(1)}% (${todayCount}/${prevCount})`,
        expected: `${PREV_DAY_COUNT_RATIO_MIN * 100}% 이상`,
      });
    }
  } else {
    console.log("[검증] 비교할 직전 데이터 날짜가 없어 이 항목은 스킵합니다");
  }

  if (todayCount > 0) {
    const nullCount = await countNullTargetPrice(today);
    const nullRatio = nullCount / todayCount;
    console.log(`[검증] targetPrice null/0 비율: ${(nullRatio * 100).toFixed(1)}% (${nullCount}/${todayCount})`);
    if (nullRatio >= NULL_TARGET_PRICE_RATIO_MAX) {
      failures.push({
        label: "targetPrice 결측 비율",
        actual: `${(nullRatio * 100).toFixed(1)}%`,
        expected: `${NULL_TARGET_PRICE_RATIO_MAX * 100}% 미만`,
      });
    }

    const sCount = await countGrade(today, "S");
    const sRatio = sCount / todayCount;
    console.log(`[검증] S등급 비율: ${(sRatio * 100).toFixed(1)}% (${sCount}/${todayCount})`);
    if (sRatio < S_GRADE_RATIO_MIN || sRatio > S_GRADE_RATIO_MAX) {
      failures.push({
        label: "S등급 비율",
        actual: `${(sRatio * 100).toFixed(1)}%`,
        expected: `${S_GRADE_RATIO_MIN * 100}~${S_GRADE_RATIO_MAX * 100}%`,
      });
    }
  } else {
    console.log("[검증] 오늘 행이 없어 결측 비율/등급 분포 검증은 스킵합니다");
  }

  if (failures.length > 0) {
    console.error(`[검증] 총 ${failures.length}건 실패`);
    await sendSlackAlert(failures);
    process.exit(1);
  }

  console.log("[검증] 전체 통과");
}

main();
