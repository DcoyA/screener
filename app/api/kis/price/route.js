import { NextResponse } from "next/server";

let accessToken = null;
let expiredAt = 0;

async function getAccessToken() {
  const now = Date.now();

  if (accessToken && now < expiredAt) {
    return accessToken;
  }

  const baseUrl = process.env.KIS_BASE_URL;
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!baseUrl || !appKey || !appSecret) {
    throw new Error("KIS 환경변수가 설정되지 않았습니다.");
  }

  const res = await fetch(`${baseUrl}/oauth2/tokenP`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    console.error("KIS token error:", data);
    throw new Error("KIS access token 발급 실패");
  }

  accessToken = data.access_token;
  expiredAt = now + Number(data.expires_in || 86400) * 1000 - 60000;

  return accessToken;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "종목코드 code 파라미터가 없습니다." },
        { status: 400 }
      );
    }

    const baseUrl = process.env.KIS_BASE_URL;
    const appKey = process.env.KIS_APP_KEY;
    const appSecret = process.env.KIS_APP_SECRET;

    if (!baseUrl || !appKey || !appSecret) {
      return NextResponse.json(
        { ok: false, error: "KIS 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const token = await getAccessToken();

    const apiUrl = new URL(
      `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`
    );

    apiUrl.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    apiUrl.searchParams.set("FID_INPUT_ISCD", code);

    const res = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: "FHKST01010100",
        custtype: "P",
      },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || data.rt_cd !== "0") {
      console.error("KIS price error:", data);
      return NextResponse.json(
        {
          ok: false,
          error: "현재가 조회 실패",
          detail: data,
        },
        { status: 500 }
      );
    }

    const output = data.output || {};

    return NextResponse.json({
      ok: true,
      code,
      price: output.stck_prpr,
      change: output.prdy_vrss,
      rate: output.prdy_ctrt,
      name: output.hts_kor_isnm || "",
      raw: output,
    });
  } catch (error) {
    console.error("API route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "서버 오류",
      },
      { status: 500 }
    );
  }
}
