export function naira(n: number | null | undefined): string {
  if (n == null) return "₦0";
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

export function compactNaira(n: number | null | undefined): string {
  if (n == null) return "₦0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `₦${Number.isInteger(m) ? m : m.toFixed(1)}m`;
  }
  if (n >= 1_000) return `₦${Math.round(n / 1000)}k`;
  return naira(n);
}

export function points(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-NG") + " pts";
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export const CATEGORY_LABEL: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  elite: "Elite",
  executive: "Executive",
};

export const CATEGORY_BADGE: Record<string, string> = {
  basic: "bg-secondary text-secondary-foreground",
  pro: "bg-gold/15 text-gold-deep border border-gold-soft",
  elite: "bg-emerald-brand/10 text-emerald-brand border border-emerald-brand/30",
  executive: "bg-ink text-gold border border-gold-soft",
};

export const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border border-amber-300",
  active: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  approved: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  paid: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  live: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  suspended: "bg-red-100 text-red-800 border border-red-300",
  rejected: "bg-red-100 text-red-800 border border-red-300",
  expired: "bg-stone-200 text-stone-600 border border-stone-300",
  draft: "bg-stone-200 text-stone-600 border border-stone-300",
  sold: "bg-ink text-gold border border-gold-soft",
  coming_soon: "bg-amber-100 text-amber-800 border border-amber-300",
  processing: "bg-blue-100 text-blue-800 border border-blue-300",
  fulfilled: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  cancelled: "bg-stone-200 text-stone-600 border border-stone-300",
};
