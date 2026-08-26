// app/risk/page.js
import { redirect } from "next/navigation";

export default function RiskRedirectPage({ searchParams }) {
  const params = new URLSearchParams();
  params.set("tab", "risk");
  if (searchParams?.code) params.set("code", String(searchParams.code));
  if (searchParams?.name) params.set("name", String(searchParams.name));
  if (searchParams?.level) params.set("level", String(searchParams.level));
  redirect(`/screener?${params.toString()}`);
}
