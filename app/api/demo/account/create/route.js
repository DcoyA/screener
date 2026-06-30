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
    throw new Error("Apps Script 응답을 JSON으로 파싱하지 못했습니다.");
  }
}

export async function GET() {
  try {
    const data = await callDemoTradeApi({
      action: "createAccount",
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Create account API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "가상계좌 생성 실패",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const data = await callDemoTradeApi({
      action: "createAccount",
      nickname: body.nickname || "",
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Create account API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "가상계좌 생성 실패",
      },
      { status: 500 }
    );
  }
}
