export const responsiveCss = `
  body { overflow-x: hidden; }
  @media (max-width: 1100px) {
    .dt-trade-grid { grid-template-columns: 240px 1fr !important; }
    .dt-trade-grid > aside:last-child { grid-column: 1 / -1; }
    .dt-bottom-grid { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 768px) {
    main { padding: 16px !important; }
    .dt-demo-header { align-items: flex-start !important; }
    .dt-demo-nav-wrap { width: 100% !important; justify-content: flex-start !important; overflow-x: auto; padding-bottom: 4px; }
    .dt-demo-nav { width: max-content; min-width: max-content; }
    .dt-topbar { flex-direction: column !important; }
    .dt-account-box { width: 100% !important; min-width: 0 !important; box-sizing: border-box; }
    .dt-login-panel { grid-template-columns: 1fr 1fr !important; }
    .dt-asset-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .dt-trade-grid { grid-template-columns: 1fr !important; }
    .dt-quote-header { align-items: flex-start !important; gap: 12px; }
    .dt-real-chart { height: 280px !important; }
    .dt-chart-toolbar { flex-direction: column !important; align-items: flex-start !important; gap: 8px; }
    .dt-position-table { min-width: 0 !important; }
    .dt-position-head, .dt-position-row { grid-template-columns: 1.1fr 0.45fr 0.9fr 0.9fr !important; }
    .dt-position-head span:nth-child(5), .dt-position-row span:nth-child(5) { display: none; }
    .dt-position-head span:nth-child(3), .dt-position-row span:nth-child(3) { display: none; }
  }
  @media (max-width: 520px) {
    .dt-login-panel { grid-template-columns: 1fr !important; }
    .dt-asset-grid { grid-template-columns: 1fr !important; }
    .dt-real-chart { height: 240px !important; }
    .dt-position-head, .dt-position-row { grid-template-columns: 1fr 0.45fr 0.9fr 0.9fr !important; font-size: 12px !important; }
    .dt-order-item { flex-direction: column !important; }
  }
`;

export const styles = {
  page: { maxWidth: "1440px", margin: "0 auto", padding: "24px", background: "#f3f4f6", color: "#111827", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif", minHeight: "100vh", overflowX: "hidden" },
  demoHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", marginBottom: "28px", flexWrap: "wrap" },
  demoBrand: { display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "#0f172a" },
  demoLogo: { width: "32px", height: "32px", objectFit: "contain" },
  demoBrandText: { fontSize: "1.05rem", fontWeight: "900", letterSpacing: "-0.02em" },
  demoNavWrap: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" },
  topBar: { display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "stretch", marginBottom: "16px" },
  logo: { fontSize: "14px", fontWeight: "800", color: "#0369a1", marginBottom: "6px" },
  title: { margin: 0, fontSize: "34px", fontWeight: "900" },
  subTitle: { margin: "8px 0 0", color: "#4b5563", lineHeight: 1.55 },
  accountBox: { minWidth: "260px", background: "#111827", color: "white", borderRadius: "18px", padding: "18px", boxShadow: "0 10px 26px rgba(15,23,42,0.16)" },
  linkButton: { marginTop: "8px", fontSize: "13px", background: "none", border: "none", color: "#0369a1", textDecoration: "underline", cursor: "pointer", padding: 0 },
  orderLockOverlay: { position: "absolute", inset: 0, background: "rgba(255,255,255,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", textAlign: "center", padding: "24px", zIndex: 5, borderRadius: "18px" },
  orderPanelDisabled: { opacity: 0.35, pointerEvents: "none", filter: "grayscale(0.3)" },
  fomoTip: { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "12px 16px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", fontSize: "13px", color: "#1e3a8a" },
  accountLine: { fontSize: "13px", color: "#9ca3af", marginBottom: "8px" },
  accountId: { fontSize: "20px", fontWeight: "900", letterSpacing: "-0.02em" },
  accountPin: { marginTop: "8px", color: "#fbbf24", fontWeight: "800" },
  primaryButton: { border: 0, background: "#2563eb", color: "white", borderRadius: "12px", padding: "12px 16px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
  tradeGrid: { display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 340px", gap: "16px", alignItems: "stretch" },
  leftPanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", minWidth: 0 },
  centerPanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", minWidth: 0 },
  orderPanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", position: "relative", minWidth: 0 },
  panelTitle: { fontSize: "18px", fontWeight: "900", margin: 0 },
  panelTitleWithMargin: { fontSize: "18px", fontWeight: "900", margin: "0 0 14px" },
  smallTitle: { fontSize: "13px", color: "#6b7280", margin: "18px 0 8px" },
  searchBox: { display: "grid", gridTemplateColumns: "1fr 48px", gap: "8px" },
  input: { width: "100%", border: "1px solid #d1d5db", borderRadius: "12px", padding: "11px 12px", fontSize: "14px", boxSizing: "border-box", minWidth: 0 },
  searchButton: { border: 0, background: "#0f766e", color: "white", borderRadius: "12px", padding: "0 10px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap", wordBreak: "keep-all", minWidth: "48px" },
  stockList: { display: "grid", gap: "8px" },
  stockButton: { border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: "14px", padding: "12px", display: "flex", justifyContent: "space-between", cursor: "pointer", fontWeight: "800" },
  stockButtonActive: { borderColor: "#2563eb", background: "#eff6ff", color: "#1d4ed8", boxShadow: "inset 0 0 0 1px #2563eb" },
  quoteHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "16px", marginBottom: "16px" },
  stockName: { fontSize: "26px", fontWeight: "900" },
  stockCode: { color: "#6b7280", marginTop: "4px" },
  priceArea: { textAlign: "right" },
  nowPrice: { fontSize: "32px", fontWeight: "900" },
  upText: { color: "#dc2626" },
  downText: { color: "#2563eb" },
  chartPanel: { background: "#0b1220", borderRadius: "18px", padding: "16px", overflow: "hidden" },
  chartToolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", marginBottom: "12px" },
  chartSubText: { marginLeft: "8px", color: "#9ca3af", fontSize: "12px" },
  chartWarning: { background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24", borderRadius: "10px", padding: "8px 10px", fontSize: "12px", marginBottom: "10px" },
  chartRefreshButton: { border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: "10px", padding: "8px 10px", fontSize: "12px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
  realChart: { height: "330px", position: "relative", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.18)" },
  chartEmpty: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "14px" },
  candleChart: { height: "100%", display: "flex", gap: "6px", alignItems: "stretch", padding: "10px 4px 28px", boxSizing: "border-box", position: "relative" },
  realCandleWrap: { flex: 1, minWidth: "6px", position: "relative" },
  wick: { position: "absolute", left: "50%", width: "2px", transform: "translateX(-50%)", borderRadius: "999px" },
  realCandle: { position: "absolute", left: "18%", right: "18%", borderRadius: "3px" },
  timeLabel: { position: "absolute", left: "50%", bottom: "-22px", transform: "translateX(-50%)", color: "#9ca3af", fontSize: "10px", whiteSpace: "nowrap" },
  tradeMarker: { position: "absolute", transform: "translate(-50%, -50%)", zIndex: 5, borderRadius: "999px", padding: "4px 7px", color: "white", fontSize: "10px", fontWeight: "900", boxShadow: "0 4px 10px rgba(0,0,0,0.35)", pointerEvents: "auto" },
  buyMarker: { background: "#dc2626" },
  sellMarker: { background: "#2563eb" },
  fomoBox: { marginTop: "16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "16px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  fomoScore: { width: "64px", height: "64px", borderRadius: "999px", background: "#f59e0b", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", fontWeight: "900", flex: "0 0 auto" },
  tabRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" },
  tabButton: { border: "1px solid #d1d5db", background: "#f9fafb", borderRadius: "12px", padding: "12px", fontWeight: "900", cursor: "pointer" },
  buyTabActive: { border: "1px solid #ef4444", background: "#fee2e2", color: "#dc2626", borderRadius: "12px", padding: "12px", fontWeight: "900", cursor: "pointer" },
  sellTabActive: { border: "1px solid #2563eb", background: "#dbeafe", color: "#2563eb", borderRadius: "12px", padding: "12px", fontWeight: "900", cursor: "pointer" },
  label: { display: "block", fontSize: "13px", fontWeight: "800", color: "#374151", margin: "12px 0 6px" },
  holdingInfo: { marginTop: "8px", padding: "10px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "12px", color: "#1d4ed8", fontSize: "13px", fontWeight: "800" },
  orderInfo: { marginTop: "12px", background: "#f9fafb", borderRadius: "14px", padding: "12px", display: "grid", gap: "8px" },
  textarea: { width: "100%", minHeight: "86px", border: "1px solid #d1d5db", borderRadius: "12px", padding: "11px 12px", fontSize: "14px", resize: "vertical", boxSizing: "border-box" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  buyButton: { width: "100%", border: 0, background: "#dc2626", color: "white", borderRadius: "14px", padding: "15px", fontSize: "16px", fontWeight: "900", marginTop: "16px", cursor: "pointer" },
  sellButton: { width: "100%", border: 0, background: "#2563eb", color: "white", borderRadius: "14px", padding: "15px", fontSize: "16px", fontWeight: "900", marginTop: "16px", cursor: "pointer" },
  orderStatus: { marginTop: "12px", textAlign: "center", fontWeight: "900", color: "#0f766e" },
  bottomGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" },
  tablePanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", overflowX: "hidden", minWidth: 0 },
  empty: { padding: "30px", background: "#f9fafb", borderRadius: "14px", color: "#6b7280", textAlign: "center" },
  table: { display: "grid", gap: "8px", minWidth: 0 },
  tableHead: { display: "grid", gridTemplateColumns: "1.1fr 0.45fr 0.9fr 0.9fr 0.9fr 0.9fr", padding: "10px", color: "#6b7280", fontSize: "13px", borderBottom: "1px solid #e5e7eb", gap: "8px" },
  tableRow: { display: "grid", gridTemplateColumns: "1.1fr 0.45fr 0.9fr 0.9fr 0.9fr 0.9fr", padding: "12px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", gap: "8px", alignItems: "center" },
  codeText: { color: "#6b7280", fontSize: "12px", fontStyle: "normal" },
  orderList: { display: "grid", gap: "10px" },
  orderItem: { display: "flex", justifyContent: "space-between", gap: "14px", background: "#f9fafb", borderRadius: "14px", padding: "14px" },
  orderItemRight: { textAlign: "right", whiteSpace: "nowrap" },
  panelTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" },
  miniButton: { border: "1px solid #d1d5db", background: "white", color: "#111827", borderRadius: "10px", padding: "7px 10px", fontSize: "12px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
};
