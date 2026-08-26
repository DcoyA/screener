// app/alternative/page.js
// TASK 3(디자인·IA 개편): /screener가 랭킹/실전투자/리스크체크/대안투자를
// 탭으로 묶는 정식 경로가 됐다. 실제 콘텐츠는
// app/components/search/AlternativeTab.js로 옮겼고, 여기는 리다이렉트만 한다.
import { redirect } from "next/navigation";

export default function AlternativeRedirect() {
  redirect("/screener?tab=alternative");
}
