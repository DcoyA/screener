import { createSupabaseBrowserClient } from "./supabase/client";

const supabase = createSupabaseBrowserClient();

export async function getMyDemoAccountLink() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("demo_accounts")
    .select("account_id, pin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("계좌 연결 조회 실패", error);
    return null;
  }
  return data ? { accountId: data.account_id, pin: data.pin } : null;
}

export async function saveMyDemoAccountLink(accountId, pin) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, reason: "NOT_LOGGED_IN" };

  const { error } = await supabase
    .from("demo_accounts")
    .upsert({ user_id: user.id, account_id: accountId, pin });

  if (error) {
    console.error("계좌 연결 저장 실패", error);
    return { ok: false, reason: "ERROR" };
  }
  return { ok: true };
}

export async function resetMyDemoAccountLink() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, reason: "NOT_LOGGED_IN" };

  const { error } = await supabase
    .from("demo_accounts")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("계좌 리셋 실패", error);
    return { ok: false, reason: "ERROR" };
  }
  return { ok: true };
}
