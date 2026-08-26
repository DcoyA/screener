// app/premium/reports/page.js
// TASK 3-2/TASK 7(디자인·IA 개편): 프리미엄 아카이브를 /reports 하단
// 섹션으로 흡수했다. 여기는 리다이렉트만 한다.
import { redirect } from "next/navigation";

export default function PremiumReportsRedirect() {
  redirect("/reports");
}
