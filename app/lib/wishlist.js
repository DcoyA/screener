const STORAGE_KEY = "wishlistStocks";
const EVENT_NAME = "wishlist:change";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getWishlist() {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWishlist(list) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: list }));
}

export function isInWishlist(code) {
  return getWishlist().some((item) => item.code === String(code));
}

export function addToWishlist(code, name) {
  const list = getWishlist();
  if (list.some((item) => item.code === String(code))) return list;
  const next = [...list, { code: String(code), name: name || "", addedAt: new Date().toISOString() }];
  saveWishlist(next);
  return next;
}

export function removeFromWishlist(code) {
  const next = getWishlist().filter((item) => item.code !== String(code));
  saveWishlist(next);
  return next;
}

export function toggleWishlist(code, name) {
  return isInWishlist(code) ? removeFromWishlist(code) : addToWishlist(code, name);
}

export function subscribeWishlist(callback) {
  if (!isBrowser()) return () => {};
  const handler = (event) => callback(event.detail || getWishlist());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}
