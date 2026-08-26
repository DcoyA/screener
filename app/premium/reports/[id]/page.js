// app/premium/reports/[id]/page.js
// TASK 3-2/TASK 7(디자인·IA 개편): 실제 열람 권한 판정이 있는 /reports/[id]로
// 통합했다. 이메일에 이미 나간 링크의 토큰(?token=)을 그대로 보존해서 넘긴다.
import { redirect } from "next/navigation";

export default async function PremiumReportDetailRedirect({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const params2 = new URLSearchParams();
  if (sp?.token) params2.set("token", String(sp.token));
  const query = params2.toString();
  redirect(`/reports/${id}${query ? `?${query}` : ""}`);
}
