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

function getNowTimeString() {
  const now = new Date();

  const koreaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );

  const hours = String(koreaTime.getHours()).padStart(2, "0");
  const minutes = String(koreaTime.getMinutes()).padStart(2, "0");
  const seconds = String(koreaTime.getSeconds()).padStart(2, "0");

  return `${hours}${minutes}${seconds}`;
}

function normalizeMinuteItem(item) {
  const date = String(item.stck_bsop_date || "");
  const time = String(item.stck_cntg_hour || "");

  return {
    date,
    time,
    label:
      time.length >= 4
        ? `${time.slice(0, 2)}:${time.slice(2, 4)}`
        : time,
    open: Number(item.stck_oprc || item.stck_prpr || 0),
    high: Number(item.stck_hgpr || item.stck_prpr || 0),
    low: Number(item.stck_lwpr || item.stck_prpr || 0),
    close: Number(item.stck_prpr || 0),
    volume: Number(item.cntg_vol || item.acml_vol || 0),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const time = searchParams.get("time") || getNowTimeString();

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          error: "종목코드 code 파라미터가 없습니다.",
        },
        { status: 400 }
      );
    }

    const baseUrl = process.env.KIS_BASE_URL;
    const appKey = process.env.KIS_APP_KEY;
    const appSecret = process.env.KIS_APP_SECRET;

    if (!baseUrl || !appKey || !appSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "KIS 환경변수가 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const token = await getAccessToken();

    const apiUrl = new URL(
      `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`
    );

    apiUrl.searchParams.set("FID_ETC_CLS_CODE", "");
    apiUrl.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    apiUrl.searchParams.set("FID_INPUT_ISCD", code);
    apiUrl.searchParams.set("FID_INPUT_HOUR_1", time);
    apiUrl.searchParams.set("FID_PW_DATA_INCU_YN", "Y");

    const res = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: "FHKST03010200",
        custtype: "P",
      },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || data.rt_cd !== "0") {
      console.error("KIS minute chart error:", data);

      return NextResponse.json(
        {
          ok: false,
          error: "분봉 조회 실패",
          detail: data,
        },
        { status: 500 }
      );
    }

    const output1 = data.output1 || {};
    const output2 = Array.isArray(data.output2) ? data.output2 : [];

    const candles = output2
      .map(normalizeMinuteItem)
      .filter((item) => item.close > 0)
      .reverse();

    return NextResponse.json({
      ok: true,
      code,
      name: output1.hts_kor_isnm || "",
      time,
      count: candles.length,
      candles,
      raw: {
        output1,
      },
    });
  } catch (error) {
    console.error("Minute chart API route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "서버 오류",
      },
      { status: 500 }
    );
  }
}
