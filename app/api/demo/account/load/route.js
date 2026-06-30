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

export async function POST(request) {
  try {
    const body = await request.json();

    const { accountId, pin } = body;

    if (!accountId || !pin) {
      return NextResponse.json(
        {
          ok: false,
          error: "accountId와 pin이 필요합니다.",
        },
        { status: 400 }
      );
    }

    const data = await callDemoTradeApi({
      action: "loadAccount",
      accountId,
      pin,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Load account API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "계좌 조회 실패",
      },
      { status: 500 }
    );
  }
}
