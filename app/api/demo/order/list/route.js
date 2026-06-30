import { NextResponse } from "next/server";

async function callDemoTradeApi(payload) {
  const apiUrl = process.env.DEMO_TRADE_API_URL;

  if (!apiUrl) {
    throw new Error("DEMO_TRADE_API_URL 환경변수가 설정되지 않았습니다.");
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Apps Script raw response:", text);
    throw new Error("Apps Script 응답 파싱 실패");
  }
}

async function loadOrders(accountId, pin) {
  if (!accountId || !pin) {
    return {
      ok: false,
      error: "accountId와 pin이 필요합니다.",
    };
  }

  return await callDemoTradeApi({
    action: "loadOrders",
    accountId,
    pin,
  });
}

// 브라우저 주소창 테스트용
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const accountId = searchParams.get("accountId");
    const pin = searchParams.get("pin");

    const data = await loadOrders(accountId, pin);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Load orders GET API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "주문 목록 조회 실패",
      },
      { status: 500 }
    );
  }
}

// 실제 프론트 호출용
export async function POST(request) {
  try {
    const body = await request.json();

    const data = await loadOrders(body.accountId, body.pin);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Load orders POST API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "주문 목록 조회 실패",
      },
      { status: 500 }
    );
  }
}
