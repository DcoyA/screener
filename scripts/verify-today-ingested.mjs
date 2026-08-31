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

// 오늘자 적재 결과. ingest-daily-snapshot.mjs가 성공/실패 시 batch_ingest_logs에
// 한 행씩 남긴다. 없으면 null. 조회 자체가 실패하면 throw(휴장일 조회와 동일 원칙).
async function fetchTodayIngestLog(date) {
  const { data, error } = await supabase
    .from("batch_ingest_logs")
    .select("status, total_rows, finished_at")
    .eq("snapshot_date", date)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`batch_ingest_logs 조회 실패: ${error.message}`);
  return data || null;
}

// 현재 KST 시각. { hour: 0~23, hhmm: "HH:MM" }
function kstNow() {
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return { hour: parseInt(hhmm.slice(0, 2), 10) % 24, hhmm };
}

// 어떤 트리거로 돈 실행인지. 중복 방지 로직을 두지 않으므로, 사람이 슬랙에서
// 중복 알림임을 알아볼 수 있게 메시지에 넣는다.
function triggerLabel() {
  const e = process.env.GITHUB_EVENT_NAME || "";
  if (e === "schedule") return "schedule";
  if (e === "workflow_run") return "workflow_run";
  if (e === "workflow_dispatch") return "manual";
  return e || "local";
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

  const text = `:rotating_light: [워치독] 오늘(${kstDateStr()}) 데이터 검증 실패 ${failures.length}건 (트리거: ${triggerLabel()})\n${lines}\n${buildActionsLink()}`;

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
    // 벽시계 고정 시각("09:07 이후면 실패")은 신뢰 못 한다 - 8/28엔 파이프라인이
    // KST 20:17에 돌았다. "적재가 실제로 끝났는가"(batch_ingest_logs)를 본다.
    let ingestLog;
    try {
      ingestLog = await fetchTodayIngestLog(today);
    } catch (err) {
      console.error(`[검증] ${err.message}`);
      process.exit(1);
    }

    if (ingestLog?.status === "success") {
      // 적재는 성공으로 끝났는데 스냅샷이 0건 = 뷰 파손/날짜 불일치/부분 삭제 등 진짜 모순
      failures.push({
        label: "적재 완료 후에도 오늘 행 없음",
        actual: `0건 (batch_ingest_logs status=success, total_rows=${ingestLog.total_rows ?? "?"})`,
        expected: "1건 이상",
      });
    } else if (ingestLog?.status === "failed") {
      // 적재 잡이 스스로 실패 알림을 이미 보냈다 - 여기서 중복 알림하지 않는다.
      console.log("[보류] 오늘 수집이 실패로 종료됨 (batch_ingest_logs status=failed) - 적재 잡 알림 확인");
      process.exit(0);
    } else {
      // batch_ingest_logs에 오늘 행이 없음 = 적재가 아직/전혀 안 돎.
      const { hour, hhmm } = kstNow();
      const isSchedule = process.env.GITHUB_EVENT_NAME === "schedule";
      // STRICT: 안전망 cron(KST 22:00)이 제 시각(21:00~23:59)에 떴는데도 적재
      // 기록이 전혀 없다 = 오늘 수집 파이프라인이 시작조차 안 됨.
      const strict = isSchedule && hour >= 21 && hour <= 23;

      if (strict) {
        failures.push({
          label: "오늘 수집 미시작",
          actual: `batch_ingest_logs 오늘 행 없음 (안전망 cron 시각 KST ${hhmm})`,
          expected: "KST 22:00 이전 수집 완료",
        });
      } else if (isSchedule) {
        // 22:00 cron 자체가 지연돼 다음날 오전으로 밀리면, 새 거래일을 0건으로
        // 오판해 원래 버그가 재발한다. 창(21~23시) 밖의 schedule 실행은 보류.
        console.log(`[스킵] 스케줄 지연 감지(현재 KST ${hhmm}), 판정 보류`);
        process.exit(0);
      } else {
        // workflow_run / manual: 적재 직후거나 사람이 돌린 것. 기록이 아직
        // 없으면 그냥 안 끝난 것 - 조용히 보류.
        console.log("[대기] 오늘 수집 미완료, 판정 보류");
        process.exit(0);
      }
    }
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
