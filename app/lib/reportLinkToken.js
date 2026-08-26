import crypto from "crypto";

// 프리미엄 리포트 이메일 웹뷰 링크용 서명 토큰. DB 조회 없이 검증 가능하고
// 유효기간을 걸 수 있어야 해서(수신자가 메일을 며칠 뒤에 열어볼 수 있음)
// 무작위 문자열이 아니라 reportId+만료시각을 HMAC-SHA256으로 서명한다.
const SECRET_ENV_VAR = "REPORT_LINK_SECRET";
const DEFAULT_EXPIRES_IN_DAYS = 30;

function getSecret() {
  return process.env[SECRET_ENV_VAR] || null;
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

// 발급 시점에 키가 없으면 null을 반환한다 - 호출 측(send-report-email.mjs)이
// 이 경우를 감지해 처리해야 한다(토큰 없는 링크를 그대로 보내면 누구나
// 못 여는 링크가 되므로, 발송 자체를 막거나 슬랙 경고를 남기는 식으로).
export function createReportLinkToken(reportId, { expiresInDays = DEFAULT_EXPIRES_IN_DAYS } = {}) {
  const secret = getSecret();
  if (!secret) return null;

  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const payload = `${reportId}.${expiresAt}`;
  const signature = sign(payload, secret);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

// { valid: true } | { valid: false, reason: "secret_missing"|"no_token"|"malformed"|"report_mismatch"|"expired"|"bad_signature" }
export function verifyReportLinkToken(token, reportId) {
  const secret = getSecret();
  if (!secret) return { valid: false, reason: "secret_missing" };
  if (!token) return { valid: false, reason: "no_token" };

  let decoded;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const parts = decoded.split(".");
  if (parts.length !== 3) return { valid: false, reason: "malformed" };
  const [tokenReportId, expiresAtStr, signature] = parts;

  if (String(tokenReportId) !== String(reportId)) return { valid: false, reason: "report_mismatch" };

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return { valid: false, reason: "expired" };

  const expectedSignature = sign(`${tokenReportId}.${expiresAtStr}`, secret);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: "bad_signature" };
  }

  return { valid: true };
}
