import { useState } from "react";
import { Link } from "react-router";
import { MapPin, ArrowRight, Ticket, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { naira } from "@/lib/format";
import { ProductCard } from "@/components/business/ProductCard";
import { CatalogueFilters, type CatalogueFilter } from "@/components/business/CatalogueFilters";

/** Realtor dashboard — browse the live catalogue filtered by category and location. */
export default function Properties() {
  const [filter, setFilter] = useState<CatalogueFilter>({});
  const { data: products, isLoading } = trpc.catalog.products.useQuery(filter);
  const { data: me } = trpc.member.me.useQuery();
  const [voucherFor, setVoucherFor] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker kicker-line">The Catalogue</p>
          <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Products to sell</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-gold" /> Filter by category, country and state to see what's near you.
          </p>
        </div>
        <Link
          to="/app/earnings"
          className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-ink"
        >
          Report a sale <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <CatalogueFilters value={filter} onChange={setFilter} />
      </div>

      {isLoading ? null : (products ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          No products match this filter yet — try widening the location.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(products ?? []).map((p) => (
            <div key={p.id} className="flex flex-col">
              <ProductCard p={p} action="none" />
              {me?.status === "active" && (me.voucherBalance ?? 0) > 0 && (
                <button
                  onClick={() => setVoucherFor(voucherFor === p.id ? null : p.id)}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#a8842b]/40 bg-[#faf6ec] px-4 py-2.5 text-xs font-bold text-[#7a611f] hover:bg-[#f3ead2]"
                >
                  <Ticket className="w-4 h-4" />
                  {voucherFor === p.id ? "Close voucher" : `Use my ${naira(me.voucherBalance)} voucher on this`}
                </button>
              )}
              {voucherFor === p.id && (
                <VoucherPanel
                  productId={p.id}
                  price={p.price}
                  balance={me?.voucherBalance ?? 0}
                  onDone={() => setVoucherFor(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Apply part of the member's property voucher to a product. */
function VoucherPanel({ productId, price, balance, onDone }: { productId: number; price: number; balance: number; onDone: () => void }) {
  const utils = trpc.useUtils();
  const max = Math.min(balance, price);
  const [amount, setAmount] = useState(max);
  const spend = trpc.member.spendVoucher.useMutation({
    onSuccess: async () => {
      await utils.member.me.invalidate();
      await utils.member.myVoucher.invalidate();
      onDone();
    },
  });
  const valid = amount > 0 && amount <= max;

  return (
    <div className="mt-2 rounded-xl border border-[#a8842b]/40 bg-white p-4 space-y-3">
      <p className="text-xs font-bold text-ink">Apply your property voucher</p>
      <p className="text-[11px] text-neutral-500">
        Up to {naira(max)} on this property. The club confirms your purchase, then you pay the balance of{" "}
        {naira(Math.max(0, price - (amount || 0)))}.
      </p>
      <input
        type="number"
        min={1}
        max={max}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-[#a8842b]"
      />
      {spend.error && <p className="text-xs text-red-600">{spend.error.message}</p>}
      <button
        onClick={() => spend.mutate({ productId, amount })}
        disabled={!valid || spend.isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl gold-bg-grad px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {spend.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
        Apply {naira(amount || 0)} voucher
      </button>
    </div>
  );
}
