/**
 * Referral attribution — bulletproof capture.
 *
 * A referral code can arrive as:
 *   - query param:   /join?ref=charity-wealth-a3f9
 *   - path:          /r/charity-wealth-a3f9
 * Once seen, it is persisted to a cookie (30 days) AND localStorage, so the
 * visitor cannot lose it by navigating away, closing the tab, or signing up
 * days later. First referrer wins — later codes never overwrite.
 */

export const REF_COOKIE = "club10_ref";
const REF_LS = "club10_ref";
const MAX_DAYS = 30;

export function refFromPath(pathname: string): string {
  const m = pathname.match(/^\/r\/([A-Za-z0-9-]+)/);
  return m?.[1] ?? "";
}

/** Persist a referral code (cookie + localStorage). First referrer wins. */
export function captureRef(code: string) {
  const clean = code.trim();
  if (!clean) return;
  if (getStoredRef()) return; // never overwrite the first referrer
  try {
    localStorage.setItem(REF_LS, clean);
  } catch {
    /* private mode */
  }
  const maxAge = MAX_DAYS * 24 * 3600;
  document.cookie = `${REF_COOKIE}=${encodeURIComponent(clean)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

/** Read the stored referral code (cookie first, then localStorage). */
export function getStoredRef(): string {
  const fromCookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${REF_COOKIE}=`))
    ?.split("=")[1];
  if (fromCookie) return decodeURIComponent(fromCookie);
  try {
    return localStorage.getItem(REF_LS) ?? "";
  } catch {
    return "";
  }
}

/** Build the member's personal referral link. */
export function referralLink(code: string): string {
  return `${window.location.origin}/r/${code}`;
}
