import { NextResponse } from "next/server";

let accessToken: string | null = null;
let expiredAt = 0;

// 토큰 발급 함수
async function getAccessToken() {
  const now = Date.now();

  if (accessToken && now < expiredAt) {
    return accessToken;
  }

  const res = await fetch(
    `${process.env.KIS_BASE_URL}/oauth2/tokenP`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: process.env.KIS_APP_KEY,
        appsecret: process.env.KIS_APP_SECRET,
      }),
    }
  );

  const data = await res.json();

  accessToken = data.access_token;
  expiredAt = now + data.expires_in * 1000 - 60000;

  return accessToken;
}

// 현재가 조회
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "code 없음" }, { status: 400 });
  }

  const token = await getAccessToken();

  const res = await fetch(
    `${process.env.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "appkey": process.env.KIS_APP_KEY!,
        "appsecret": process.env.KIS_APP_SECRET!,
        "tr_id": "FHKST01010100",
      },
    }
  );

  const data = await res.json();

  return NextResponse.json({
    price: data?.output?.stck_prpr,
    change: data?.output?.prdy_vrss,
    rate: data?.output?.prdy_ctrt,
  });
}
