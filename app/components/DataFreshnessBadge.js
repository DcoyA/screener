"use client";

import { useEffect, useState } from "react";
import { getDataFreshness } from "../lib/dataFreshness";

// 데이터 기준일 바 - 신뢰도 직결 요소라 항상 노출한다. 정상 상태는 루비 톤,
// 지연/경고 상태만 앰버/레드 시맨틱을 쓴다.
const LEVEL_STYLE = {
  ok: {
    background: "var(--ruby-100)",
    color: "var(--ruby-950)",
  },
  stale: {
    background: "#fffbeb",
    color: "#92400e",
  },
  delayed: {
    background: "#fef2f2",
    color: "#991b1b",
  },
};

const wrapStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  fontSize: "0.78rem",
  fontWeight: 700,
  textAlign: "center",
  flexWrap: "wrap",
};

// 배지 상태(오늘 대비 며칠 지연됐는지)는 페이지가 빌드/배포된 시점이 아니라
// 지금 이 순간(뷰어의 실제 시각) 기준이어야 하므로 클라이언트에서 계산한다
// - 서버에서 굳혀 내려주면 주말처럼 재배포가 없는 구간에 값이 낡는다.
export default function DataFreshnessBadge({ basisDate }) {
  const [freshness, setFreshness] = useState(null);

  useEffect(() => {
    if (!basisDate) return;
    setFreshness(getDataFreshness(basisDate));
  }, [basisDate]);

  if (!basisDate || !freshness) return null;

  const style = { ...wrapStyle, ...LEVEL_STYLE[freshness.level] };

  return (
    <div style={style} role="status">
      <span>
        데이터 기준 {freshness.basisDate} 종가 · 다음 갱신 {freshness.nextUpdateLabel}
      </span>
      {freshness.level === "delayed" ? (
        <span>데이터 갱신이 지연되고 있습니다</span>
      ) : null}
    </div>
  );
}
