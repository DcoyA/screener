// app/ranking/page.js
import { redirect } from "next/navigation";

export default function RankingRedirectPage({ searchParams }) {
  const params = new URLSearchParams();
  params.set("tab", "ranking");
  if (searchParams?.view) params.set("view", String(searchParams.view));
  if (searchParams?.risk) params.set("risk", String(searchParams.risk));
  redirect(`/screener?${params.toString()}`);
}
