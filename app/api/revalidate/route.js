import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import crypto from "node:crypto";

// STEP 8: 데이터 파이프라인 성공 후 캐시를 즉시 무효화하는 훅.
//
// 이 훅이 영원히 안 붙어도 각 라우트의 revalidate=3600 + unstable_cache의
// 3600초 주기가 1차 안전망이므로 최대 1시간 뒤엔 갱신된다(일 1회 갱신
// 데이터라 실무상 충분). 훅은 "적재 완료 ~ 재배포 반영" 사이 수 분을 메운다.
//
// 붙이는 법: docs/ops/revalidate-hook.md

// 무효화 허용 태그 화이트리스트. stocksData.js의 unstable_cache tags와 일치.
const ALLOWED_TAGS = new Set(["stocks"]);

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  // 길이가 다르면 timingSafeEqual이 던지므로 먼저 길이를 상수시간 비슷하게 처리
  if (ab.length !== bb.length) {
    // 그래도 한 번은 비교해서 타이밍 편차를 줄인다
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // 조용히 통과시키지 않는다. 설정 누락은 명시적으로 503.
    console.error("[revalidate] REVALIDATE_SECRET 미설정 - 훅 비활성 상태");
    return NextResponse.json(
      { ok: false, error: "revalidate 훅이 설정되지 않았습니다(REVALIDATE_SECRET 없음)." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-revalidate-secret") || "";
  if (!timingSafeEqualStr(provided, secret)) {
    console.warn("[revalidate] 잘못된 시크릿으로 호출됨");
    return NextResponse.json({ ok: false, error: "인증 실패" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const tags = Array.isArray(body?.tags) ? body.tags : [];
  if (tags.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'body는 { "tags": ["stocks"] } 형태여야 합니다.' },
      { status: 400 }
    );
  }

  const invalid = tags.filter((t) => !ALLOWED_TAGS.has(t));
  if (invalid.length > 0) {
    return NextResponse.json(
      { ok: false, error: `허용되지 않은 태그: ${invalid.join(", ")}`, allowed: [...ALLOWED_TAGS] },
      { status: 400 }
    );
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }

  const at = new Date().toISOString();
  console.log(`[revalidate] tags=[${tags.join(", ")}] at=${at}`);

  return NextResponse.json({ ok: true, revalidated: tags, at });
}

// GET 등으로 우발 호출(브라우저 프리페치/크롤러)되면 안 된다.
export function GET() {
  return NextResponse.json({ ok: false, error: "POST만 허용됩니다." }, { status: 405 });
}
