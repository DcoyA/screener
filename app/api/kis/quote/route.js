import { NextResponse } from "next/server";

let accessToken = null;
let expiredAt = 0;
let tokenPromise = null;

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function toNumber(value) {
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getKoreaTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function getNowTimeString() {
  const koreaTime = getKoreaTime();
  const hours = String(koreaTime.getHours()).padStart(2, "0");
  const minutes = String(koreaTime.getMinutes()).padStart(2, "0");
  const seconds = String(koreaTime.getSeconds()).padStart(2, "0");
  return `${hours}${minutes}${seconds}`;
}

// KST 평일 09:00~15:30 을 정규장으로 본다. 그 밖은 종가(마지막 체결가) 기준.
// naver basic의 marketStatus("OPEN"/"CLOSE" 등)가 오면 그것을 우선한다.
function resolveMarket(naverMarketStatus) {
  const status = String(naverMarketStatus || "").toUpperCase();
  if (status === "OPEN") return { marketOpen: true, priceBasis: "realtime" };
  if (status === "CLOSE" || status === "PREOPEN" || status === "EXPIRE") {
    return { marketOpen: false, priceBasis: "close" };
  }
  const kst = getKoreaTime();
  const day = kst.getDay(); // 0=일 6=토
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  const open = day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
  return { marketOpen: open, priceBasis: open ? "realtime" : "close" };
}

function normalizeMinuteItem(item) {
  const date = String(item.stck_bsop_date || "");
  const time = String(item.stck_cntg_hour || "");

  return {
    date,
    time,
    label: time.length >= 4 ? `${time.slice(0, 2)}:${time.slice(2, 4)}` : time,
    open: toNumber(item.stck_oprc || item.stck_prpr),
    high: toNumber(item.stck_hgpr || item.stck_prpr),
    low: toNumber(item.stck_lwpr || item.stck_prpr),
    close: toNumber(item.stck_prpr),
    volume: toNumber(item.cntg_vol || item.acml_vol),
  };
}

async function getAccessToken() {
  const now = Date.now();

  if (accessToken && now < expiredAt) return accessToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    const baseUrl = process.env.KIS_BASE_URL;
    const appKey = process.env.KIS_APP_KEY;
    const appSecret = process.env.KIS_APP_SECRET;

    if (!baseUrl || !appKey || !appSecret) {
      throw new Error("KIS 환경변수가 설정되지 않았습니다.");
    }

    const res = await fetch(`${baseUrl}/oauth2/tokenP`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: appKey,
        appsecret: appSecret,
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.access_token) {
      console.error("KIS token error:", data);
      throw new Error(data.msg1 || "KIS access token 발급 실패");
    }

    accessToken = data.access_token;
    expiredAt = now + Number(data.expires_in || 86400) * 1000 - 60000;
    return accessToken;
  })();

  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

async function fetchNaverBasic(code) {
  const apiUrl = `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/basic`;

  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 compatible; DemoTradeBot/1.0",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data || !data.stockName) {
    console.error("Naver basic fallback error:", data);
    throw new Error("대체 시세 조회 실패");
  }

  return {
    ok: true,
    source: "NAVER_BASIC",
    name: data.stockName || "",
    price: toNumber(data.closePrice),
    change: toNumber(data.compareToPreviousClosePrice),
    rate: toNumber(data.fluctuationsRatio),
    marketStatus: data.marketStatus || "",
    localTradedAt: data.localTradedAt || "",
    raw: data,
  };
}

async function fetchNaverDailyCandles(code) {
  const today = new Date();
  const end = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const start = new Date(end);
  start.setDate(start.getDate() - 45);

  const fmt = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  };

  const apiUrl = `https://api.finance.naver.com/siseJson.naver?symbol=${encodeURIComponent(code)}&requestType=1&startTime=${fmt(start)}&endTime=${fmt(end)}&timeframe=day`;

  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "text/plain,*/*",
        "User-Agent": "Mozilla/5.0 compatible; DemoTradeBot/1.0",
      },
      cache: "no-store",
    });

    const text = await res.text();
    const normalized = text.trim().replace(/'/g, '"');
    const rows = JSON.parse(normalized);

    if (!Array.isArray(rows) || rows.length <= 1) return [];

    return rows
      .slice(1)
      .filter((row) => Array.isArray(row) && row.length >= 6)
      .slice(-30)
      .map((row) => {
        const date = String(row[0] || "").replace(/-/g, "");
        return {
          date,
          time: date,
          label: date.length === 8 ? `${date.slice(4, 6)}/${date.slice(6, 8)}` : date,
          open: toNumber(row[1]),
          high: toNumber(row[2]),
          low: toNumber(row[3]),
          close: toNumber(row[4]),
          volume: toNumber(row[5]),
        };
      })
      .filter((item) => item.close > 0);
  } catch (error) {
    console.warn("Naver daily candle fallback failed:", error);
    return [];
  }
}

async function fetchKisPrice({ baseUrl, token, appKey, appSecret, code }) {
  const apiUrl = new URL(`${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`);
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

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.rt_cd !== "0") {
    console.error("KIS price error:", data);
    throw new Error(data.msg1 || "KIS 현재가 조회 실패");
  }

  const output = data.output || {};

  return {
    ok: true,
    source: "KIS",
    name: output.hts_kor_isnm || "",
    price: toNumber(output.stck_prpr),
    change: toNumber(output.prdy_vrss),
    rate: toNumber(output.prdy_ctrt),
    raw: output,
  };
}

async function fetchKisMinute({ baseUrl, token, appKey, appSecret, code }) {
  const apiUrl = new URL(`${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`);
  apiUrl.searchParams.set("FID_ETC_CLS_CODE", "");
  apiUrl.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
  apiUrl.searchParams.set("FID_INPUT_ISCD", code);
  apiUrl.searchParams.set("FID_INPUT_HOUR_1", getNowTimeString());
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

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.rt_cd !== "0") {
    console.warn("KIS minute error:", data);
    return { candles: [], minuteError: data.msg1 || "분봉 조회 실패" };
  }

  const output2 = Array.isArray(data.output2) ? data.output2 : [];
  const candles = output2.map(normalizeMinuteItem).filter((item) => item.close > 0).reverse();

  return { candles, minuteError: "" };
}

async function getKisQuote(code) {
  const baseUrl = process.env.KIS_BASE_URL;
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!baseUrl || !appKey || !appSecret) {
    throw new Error("KIS 환경변수가 설정되지 않았습니다.");
  }

  const token = await getAccessToken();
  const priceData = await fetchKisPrice({ baseUrl, token, appKey, appSecret, code });
  const minuteData = await fetchKisMinute({ baseUrl, token, appKey, appSecret, code });

  // 핵심 보정: KIS는 가격은 성공해도 hts_kor_isnm 이름이 빈 값인 경우가 있다.
  // 이 경우 종목코드가 화면 제목으로 표시되므로 네이버 basic으로 이름만 보강한다.
  let resolvedName = priceData.name;
  let nameSource = "KIS";

  if (!resolvedName) {
    try {
      const naverName = await fetchNaverBasic(code);
      resolvedName = naverName.name || "";
      nameSource = "NAVER_BASIC";
    } catch (error) {
      console.warn("Name fallback failed:", error.message);
    }
  }

  const market = resolveMarket("");

  return {
    ok: true,
    source: "KIS",
    code,
    name: resolvedName || code,
    nameSource,
    price: priceData.price,
    change: priceData.change,
    rate: priceData.rate,
    candles: minuteData.candles,
    candleInterval: "minute",
    minuteError: minuteData.minuteError,
    fallbackUsed: false,
    marketOpen: market.marketOpen,
    priceBasis: market.priceBasis,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = onlyDigits(searchParams.get("code"));

  if (!code || code.length !== 6) {
    return NextResponse.json(
      { ok: false, error: "종목코드 code는 6자리 숫자여야 합니다." },
      { status: 400 }
    );
  }

  try {
    const kisQuote = await getKisQuote(code);
    return NextResponse.json(kisQuote);
  } catch (kisError) {
    console.warn("KIS quote failed. fallback to Naver:", kisError.message);

    try {
      const naverPrice = await fetchNaverBasic(code);
      const fallbackCandles = await fetchNaverDailyCandles(code);

      const market = resolveMarket(naverPrice.marketStatus);

      return NextResponse.json({
        ok: true,
        source: naverPrice.source,
        code,
        name: naverPrice.name || code,
        nameSource: "NAVER_BASIC",
        price: naverPrice.price,
        change: naverPrice.change,
        rate: naverPrice.rate,
        candles: fallbackCandles,
        // 네이버 폴백은 1분봉이 아니라 일봉이다. 화면에서 "장중 표시" 문구를
        // 띄우지 않도록 daily 플래그를 준다.
        candleInterval: "day",
        minuteError: fallbackCandles.length > 0 ? "KIS 분봉 대신 네이버 일봉 데이터를 표시합니다." : "분봉 데이터를 불러오지 못했습니다.",
        fallbackUsed: true,
        fallbackReason: kisError.message || "KIS 조회 실패",
        marketStatus: naverPrice.marketStatus,
        localTradedAt: naverPrice.localTradedAt,
        marketOpen: market.marketOpen,
        priceBasis: market.priceBasis,
      });
    } catch (fallbackError) {
      console.error("All quote sources failed:", {
        kisError: kisError.message,
        fallbackError: fallbackError.message,
      });

      return NextResponse.json(
        {
          ok: false,
          code,
          error: "현재 시세를 불러오지 못했습니다.",
          detail: {
            kisError: kisError.message,
            fallbackError: fallbackError.message,
          },
        },
        { status: 500 }
      );
    }
  }
}
