// app/wishlist/page.js
// TASK 3(디자인·IA 개편): /me가 정식 경로가 됐다(관심종목 + 구독관리 +
// 알림설정 탭). 실제 콘텐츠는 app/me/page.js로 옮겼고, 여기는 리다이렉트만 한다.
import { redirect } from "next/navigation";

export default function WishlistRedirect() {
  redirect("/me?tab=wishlist");
}
