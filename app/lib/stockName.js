// CLAUDE.md: "종목명은 DART 원본('XX보통주')을 그대로 쓰지 말고 정제해서
// 노출한다." DART 원본은 보통주엔 "보통주", 우선주엔 "N우선주"/"제N우선주"
// 접미사가 붙는다(예: "더블유게임즈보통주", "한화머시너리앤서비스홀딩스3우선주").
//
// 종목명을 화면(또는 리포트/이메일)에 출력하는 모든 경로는 이 함수 하나만
// 경유한다. 개별 컴포넌트에서 raw name을 직접 렌더하면 안 된다
// (scripts/test/check-upside-display.mjs가 회귀를 잡는다).
export function normalizeStockName(rawName) {
  if (!rawName) return rawName || "";

  let name = String(rawName).trim();

  name = name.replace(/보통주$/, "");

  const numberedPreferredMatch = name.match(/(?:제)?(\d+)우선주$/);
  if (numberedPreferredMatch) {
    name = `${name.slice(0, numberedPreferredMatch.index)}(${numberedPreferredMatch[1]}우)`;
  } else if (/우선주$/.test(name)) {
    name = name.replace(/우선주$/, "(우)");
  }

  return name.trim();
}

// 기존 호출부(13곳) 하위호환용 별칭. 신규 코드는 normalizeStockName을 쓴다.
export { normalizeStockName as cleanStockName };
