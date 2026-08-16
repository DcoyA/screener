// app/stock/[code]/page.js
import { redirect } from "next/navigation";

export default async function StockDetailRedirect({ params }) {
  const { code } = await params;
  redirect(`/diagnosis/${code}`);
}
