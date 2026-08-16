import { createSupabaseBrowserClient } from "./supabase/client";

const supabase = createSupabaseBrowserClient();

let cachedList = null;
let cachedUserId = null;
let inflightPromise = null;

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

async function fetchWishlistFromServer(user) {
  const { data, error } = await supabase
    .from("wishlists")
    .select("code, name, added_at")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (error) {
    console.error("위시리스트 조회 실패", error);
    return [];
  }
  return (data || []).map((row) => ({ code: row.code, name: row.name, addedAt: row.added_at }));
}

export async function getWishlist() {
  const user = await getCurrentUser();
  if (!user) {
    cachedList = null;
    cachedUserId = null;
    return [];
  }

  if (cachedUserId === user.id && cachedList) {
    return cachedList;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = fetchWishlistFromServer(user).then((list) => {
    cachedList = list;
    cachedUserId = user.id;
    inflightPromise = null;
    return list;
  });

  return inflightPromise;
}

export function invalidateWishlistCache() {
  cachedList = null;
}

export async function isInWishlist(code) {
  const list = await getWishlist();
  return list.some((item) => item.code === String(code));
}

export async function addToWishlist(code, name) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "NOT_LOGGED_IN" };

  const { error } = await supabase
    .from("wishlists")
    .insert({ user_id: user.id, code: String(code), name: name || "" });

  if (error && error.code !== "23505") {
    console.error("위시리스트 추가 실패", error);
    return { ok: false, reason: "ERROR" };
  }
  invalidateWishlistCache();
  return { ok: true };
}

export async function removeFromWishlist(code) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "NOT_LOGGED_IN" };

  const { error } = await supabase
    .from("wishlists")
    .delete()
    .eq("user_id", user.id)
    .eq("code", String(code));

  if (error) {
    console.error("위시리스트 삭제 실패", error);
    return { ok: false, reason: "ERROR" };
  }
  invalidateWishlistCache();
  return { ok: true };
}

export async function toggleWishlist(code, name) {
  const already = await isInWishlist(code);
  return already ? removeFromWishlist(code) : addToWishlist(code, name);
}
