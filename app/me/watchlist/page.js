import { redirect } from "next/navigation";

// "내 관심종목" 네비 항목의 목적지. /me 페이지의 관심종목 탭으로 보낸다.
export default function WatchlistRedirect() {
  redirect("/me?section=wishlist");
}
