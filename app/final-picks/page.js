// app/final-picks/page.js
import { redirect } from "next/navigation";

export default function FinalPicksRedirectPage() {
  redirect("/search?tab=final");
}
