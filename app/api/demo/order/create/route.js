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

async function createOrder(payload) {
  const {
    accountId,
    pin,
    side,
    code,
    name,
    price,
    quantity,
    reason,
    targetPrice,
    stopLossPrice,
    holdingDays,
    fomoScore,
  } = payload;

  if (!accountId || !pin) {
    return {
      ok: false,
      error: "accountId와 pin이 필요합니다.",
    };
  }

  if (!code || !price || !quantity) {
    return {
      ok: false,
      error: "종목코드, 가격, 수량이 필요합니다.",
    };
  }

  return await callDemoTradeApi({
    action: "createOrder",
    accountId,
    pin,
    side: side || "BUY",
    code,
    name: name || "",
    price: Number(price),
    quantity: Number(quantity),
    reason: reason || "",
    targetPrice: targetPrice || "",
    stopLossPrice: stopLossPrice || "",
    holdingDays: holdingDays || "",
    fomoScore: fomoScore || "",
  });
}

// 브라우저 주소창 테스트용
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const payload = {
      accountId: searchParams.get("accountId"),
      pin: searchParams.get("pin"),
      side: searchParams.get("side") || "BUY",
      code: searchParams.get("code"),
      name: searchParams.get("name") || "",
      price: searchParams.get("price"),
      quantity: searchParams.get("quantity"),
      reason: searchParams.get("reason") || "",
      targetPrice: searchParams.get("targetPrice") || "",
      stopLossPrice: searchParams.get("stopLossPrice") || "",
      holdingDays: searchParams.get("holdingDays") || "",
      fomoScore: searchParams.get("fomoScore") || "",
    };

    const data = await createOrder(payload);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Create order GET API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "주문 저장 실패",
      },
      { status: 500 }
    );
  }
}

// 실제 프론트 호출용
export async function POST(request) {
  try {
    const body = await request.json();

    const data = await createOrder(body);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Create order POST API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "주문 저장 실패",
      },
      { status: 500 }
    );
  }
}
