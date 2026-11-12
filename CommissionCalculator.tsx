import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { naira } from "@/lib/format";

/**
 * Live commission calculator — reads the real catalogue, plans and rates from the API.
 * Both pickers are dropdowns (space-friendly) on every page. In the member
 * dashboard (`variant="member"`) the seat defaults to the member's own plan.
 */
export function CommissionCalculator({ variant = "public" }: { variant?: "public" | "member" }) {
  const { data: products } = trpc.catalog.products.useQuery();
  const { data: plans } = trpc.member.plans.useQuery();
  const { data: me } = trpc.member.me.useQuery(undefined, { retry: false, enabled: variant === "member" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cat, setCat] = useState<string>("");
  const pid = selectedId ?? products?.[0]?.id;
  const defaultPlan = variant === "member" ? me?.plan?.code : undefined;
  const plan = plans?.find((p) => p.code === (cat || defaultPlan)) ?? plans?.[plans.length - 1];
  const planCode = plan?.code ?? "pro";
  const { data: calc } = trpc.catalog.calculator.useQuery(
    { productId: pid!, category: planCode },
    { enabled: pid != null }
  );
  const sel = products?.find((p) => p.id === pid);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="kicker mb-1.5 block">Select product</label>
          <select
            value={pid ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink focus:border-gold focus:outline-none"
          >
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.categoryName} · {p.priceLabel ?? naira(p.price)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="kicker mb-1.5 block">Your seat</label>
          <select
            value={planCode}
            onChange={(e) => setCat(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink focus:border-gold focus:outline-none"
          >
            {(plans ?? []).map((t) => (
              <option key={t.code} value={t.code}>
                {t.name} · {t.chainDepth > 0 ? `chain to L${t.chainDepth}` : "direct only"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sel && calc && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ink">
                {sel.name} · {sel.location}
              </h3>
              <p className="text-sm text-muted-foreground">
                Selected · sale price {naira(calc.product.price)}
              </p>
            </div>
            <span className={`rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
              calc.typeName === "House"
                ? "border-emerald-brand/40 bg-emerald-brand/10 text-emerald-brand"
                : "border-gold-soft bg-champagne text-gold-deep"
            }`}>
              Auto-detected: {calc.typeName} · {calc.pct}% direct
            </span>
          </div>

          <div className="mt-5 space-y-2.5">
            <Row label="DIRECT" pct={`${calc.pct}%`} amount={calc.direct} strong maxPct={10} />
            {calc.chain.map((l) => (
              <Row
                key={l.level}
                label={`L${l.level}`}
                pct={`${l.pct}%`}
                amount={l.amount}
                dimmed={!l.eligible}
                maxPct={10}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Direct to seller</p>
              <p className="mt-1 text-lg font-extrabold text-gold-deep sm:text-xl">{naira(calc.direct)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Through your chain {calc.depth > 0 ? `(L1–L${calc.depth})` : "(direct only at this plan)"}
              </p>
              <p className="mt-1 text-lg font-extrabold text-ink sm:text-xl">{naira(calc.chainTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total movement</p>
              <p className="mt-1 text-lg font-extrabold gold-text-grad sm:text-xl">{naira(calc.total)}</p>
            </div>
          </div>
          {calc.depth < 10 && (
            <p className="mt-4 rounded-xl bg-muted px-4 py-2.5 text-xs text-muted-foreground">
              Greyed levels are outside the {plan?.name ?? planCode} chain — upgrade your seat to unlock them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, pct, amount, strong, dimmed, maxPct }: { label: string; pct: string; amount: number; strong?: boolean; dimmed?: boolean; maxPct: number }) {
  const width = Math.min(100, (parseFloat(pct) / maxPct) * 100);
  return (
    <div className={`flex items-center gap-3 ${dimmed ? "opacity-35" : ""}`}>
      <span className={`w-14 shrink-0 text-xs font-extrabold ${strong ? "text-gold-deep" : "text-muted-foreground"}`}>{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${strong ? "gold-bg-grad" : "bg-gold/70"}`}
          style={{ width: `${Math.max(4, width)}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-bold text-muted-foreground">{pct}</span>
      <span className={`w-24 shrink-0 text-right text-sm ${strong ? "font-extrabold text-ink" : "font-semibold text-ink/80"}`}>
        {naira(amount)}
      </span>
    </div>
  );
}
