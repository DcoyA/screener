import MeClient from "./MeClient";

export const metadata = {
  title: "마이페이지",
};

// 마이페이지 콘텐츠는 전부 클라이언트에서 세션 기준으로 불러온다
// (AccountModal → /api/me/overview + getWishlist). 서버에서 내려줄 게 없다.
export default function MePage() {
  return <MeClient />;
}
