// 이모지 대신 쓰는 최소 라인 아이콘 세트. 색은 currentColor를 따라가므로
// 부모의 color만 바꾸면 아이콘 색도 같이 바뀐다.
const ICONS = {
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  chart: (
    <>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </>
  ),
  newspaper: (
    <>
      <rect x="4" y="5" width="13" height="15" rx="1.5" />
      <line x1="7" y1="9" x2="14" y2="9" />
      <line x1="7" y1="12.5" x2="14" y2="12.5" />
      <line x1="7" y1="16" x2="11" y2="16" />
      <path d="M17 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4Z" />
      <path d="M3.5 8v8L12 20l8.5-4V8" />
      <line x1="12" y1="12" x2="12" y2="20" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 4 21.5 20h-19L12 4Z" />
      <line x1="12" y1="10.5" x2="12" y2="15" />
      <circle cx="12" cy="17.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l7 4V5L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M17 9.5a3.2 3.2 0 0 1 0 5" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="11" width="13" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  trendingUp: (
    <>
      <polyline points="4,17 10,11 14,15 20,7" />
      <polyline points="14,7 20,7 20,13" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" />
    </>
  ),
};

export default function Icon({ name, size = 20, strokeWidth = 2, style, className }) {
  const content = ICONS[name];
  if (!content) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
