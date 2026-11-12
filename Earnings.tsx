import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { naira, fmtDate } from "@/lib/format";
import { uploadFile } from "@/lib/upload";
import { Wallet, TrendingUp, Users, Banknote, Plus, X, ArrowDownToLine, Ticket, ImagePlus, Loader2 } from "lucide-react";

const LEVEL_LABEL: Record<number, string> = { "-1": "Referral", 0: "Direct" };
const levelLabel = (l: number) => LEVEL_LABEL[l] ?? `Level ${l}`;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  paid: "bg-neutral-100 text-neutral-500",
  rejected: "bg-red-50 text-red-600",
};

export default function Earnings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.member.earnings.useQuery();
  const { data: me } = trpc.member.me.useQuery();
  const { data: mySales } = trpc.sales.mine.useQuery();
  const { data: myWithdrawals } = trpc.sales.myWithdrawals.useQuery();
  const { data: productList } = trpc.catalog.products.useQuery();
  const { data: voucher } = trpc.member.myVoucher.useQuery();

  const [saleOpen, setSaleOpen] = useState(false);
  const [wdFor, setWdFor] = useState<number | null>(null);
  const emptySale = { productId: "", salePrice: "", paymentDate: "", senderName: "", description: "", buyerName: "" };
  const [form, setForm] = useState(emptySale);
  const [receipt, setReceipt] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submitSale = trpc.sales.submit.useMutation({
    onSuccess: async () => {
      await utils.sales.mine.invalidate();
      setSaleOpen(false);
      setForm(emptySale);
      setReceipt(null);
      setUploadErr("");
    },
  });

  const pickReceipt = async (file: File) => {
    setUploadErr("");
    setUploading(true);
    try {
      const url = await uploadFile(file, "receipt");
      setReceipt({ url, preview: URL.createObjectURL(file) });
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  };

  const withdraw = trpc.sales.requestWithdrawal.useMutation({
    onSuccess: async () => {
      await utils.member.earnings.invalidate();
      await utils.sales.myWithdrawals.invalidate();
      setWdFor(null);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: "Available to withdraw", value: naira(data.available), icon: Wallet, dark: true },
    { label: "Total earned", value: naira(data.totalEarned), icon: TrendingUp, dark: false },
    { label: "Direct commissions", value: naira(data.direct), icon: Banknote, dark: false },
    { label: "Chain commissions", value: naira(data.chain), icon: Users, dark: false },
  ];

  return (
    <div className="space-y-8">
      {/* property voucher wallet — visible, ledgered, spendable */}
      {voucher && voucher.planVoucher > 0 && (
        <div className="rounded-2xl bg-ink night-glow p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl gold-bg-grad">
                <Ticket className="h-6 w-6 text-ink" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b]">Your property voucher</p>
                <p className="text-sm text-white/60">
                  {voucher.planName} plan · credited {naira(voucher.credited)} · used {naira(voucher.spent)}
                </p>
              </div>
            </div>
            <p className="text-3xl font-black text-[#e9dcbb]">{naira(voucher.balance)}</p>
          </div>
          <p className="mt-3 text-xs text-white/50">
            Apply it to any product in the catalogue (Products → “Use my voucher”). The club confirms the purchase, then you pay the balance.
          </p>
          {voucher.rows.length > 0 && (
            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5">
              {voucher.rows.slice(0, 6).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <span className="text-white/70 min-w-0 flex-1 truncate">{tx.note ?? "Voucher movement"}</span>
                  <span className={`shrink-0 font-black ${tx.amount > 0 ? "text-emerald-300" : "text-[#e9dcbb]"}`}>
                    {tx.amount > 0 ? "+" : "−"}{naira(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Money room</p>
          <h1 className="text-3xl font-black text-ink">Earnings</h1>
        </div>
        <button
          onClick={() => setSaleOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Report a sale
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl p-5 ${s.dark ? "bg-ink text-white night-glow" : "bg-white border border-neutral-200"}`}>
            <s.icon className={`w-5 h-5 mb-3 ${s.dark ? "text-[#e9dcbb]" : "text-[#a8842b]"}`} />
            <p className={`text-xl sm:text-2xl font-black ${s.dark ? "" : "text-ink"}`}>{s.value}</p>
            <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${s.dark ? "text-white/50" : "text-neutral-400"}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Commission ledger */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-black text-ink">Commission ledger</h2>
        </div>
        {data.rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No commissions yet. Share your link or report your first sale.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.rows.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/60">
                    <td className="px-6 py-3.5 text-neutral-500 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                    <td className="px-6 py-3.5 font-bold text-ink">
                      {c.sale
                        ? c.sale.product
                        : c.note?.startsWith("Renewal")
                          ? "Membership renewal"
                          : c.note?.startsWith("Upgrade")
                            ? "Membership upgrade"
                            : "Membership registration"}
                      {c.sale && <span className="block text-xs font-medium text-neutral-400">{naira(c.sale.salePrice)}</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex text-xs font-bold rounded-full px-2.5 py-1 bg-[#a8842b]/10 text-[#7c6117]">
                        {levelLabel(c.level)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-black text-ink whitespace-nowrap">{naira(c.amount)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[c.status] ?? STATUS_BADGE.pending}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {c.status === "approved" && (
                        <button
                          onClick={() => setWdFor(c.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#a8842b] hover:underline"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" /> Withdraw
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My sales + withdrawals */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h2 className="font-black text-ink">My reported sales</h2>
          </div>
          {!mySales || mySales.length === 0 ? (
            <p className="px-6 py-8 text-center text-neutral-400 text-sm">No sales reported yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {mySales.map(({ sale, product }) => (
                <li key={sale.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-ink">{product?.name ?? "Product"}</p>
                    <p className="text-xs text-neutral-400">
                      {naira(sale.salePrice)}{sale.paymentDate ? ` · paid ${sale.paymentDate}` : ""} · reported {fmtDate(sale.createdAt)}
                    </p>
                    {sale.receiptUrl && (
                      <a href={sale.receiptUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#a8842b] hover:underline">
                        View receipt
                      </a>
                    )}
                  </div>
                  <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[sale.status] ?? STATUS_BADGE.pending}`}>
                    {sale.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h2 className="font-black text-ink">Withdrawal history</h2>
          </div>
          {!myWithdrawals || myWithdrawals.length === 0 ? (
            <p className="px-6 py-8 text-center text-neutral-400 text-sm">No withdrawals yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {myWithdrawals.map((w) => (
                <li key={w.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-ink">{naira(w.amount)}</p>
                    <p className="text-xs text-neutral-400">{fmtDate(w.createdAt)}</p>
                  </div>
                  <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[w.status] ?? STATUS_BADGE.pending}`}>
                    {w.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Report a sale modal — every field is compulsory evidence for finance */}
      {saleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setSaleOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-black text-ink text-lg">Report a sale</h3>
              <button onClick={() => setSaleOpen(false)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-neutral-400 mb-5">All fields are compulsory — the finance office confirms your payment from this evidence.</p>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!receipt) {
                  setUploadErr("Upload the payment receipt image — it is compulsory.");
                  return;
                }
                submitSale.mutate({
                  productId: Number(form.productId),
                  salePrice: Number(form.salePrice.replace(/[^\d]/g, "")),
                  paymentDate: form.paymentDate,
                  senderName: form.senderName,
                  description: form.description,
                  receiptUrl: receipt.url,
                  buyerName: form.buyerName || undefined,
                });
              }}
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Product *</label>
                <select
                  required
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                >
                  <option value="">Select a product…</option>
                  {productList?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.categoryName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Amount paid (₦) *</label>
                <input
                  required
                  inputMode="numeric"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                  placeholder="e.g. 19,000,000"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Date of payment *</label>
                <input
                  required
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Name of sender *</label>
                <input
                  required
                  minLength={2}
                  value={form.senderName}
                  onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                  placeholder="Name on the account that sent the money"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Buyer name (optional)</label>
                <input
                  value={form.buyerName}
                  onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                  placeholder="If different from the sender"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Description *</label>
                <textarea
                  required
                  minLength={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="e.g. Full payment for 1 plot, transfer from GTBank, ref 003921…"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Payment receipt image *</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickReceipt(f);
                    e.target.value = "";
                  }}
                />
                {receipt ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                    <div className="flex items-center gap-3">
                      {receipt.url.endsWith(".pdf") ? (
                        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-[10px] font-black text-neutral-500 border border-neutral-200">PDF</span>
                      ) : (
                        <img src={receipt.preview} alt="Receipt" className="h-14 w-14 rounded-lg object-cover border border-neutral-200" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-emerald-700">Receipt attached</p>
                        <p className="text-[11px] text-neutral-400 truncate">{receipt.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="text-xs font-bold text-[#a8842b] hover:underline shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-6 text-sm font-bold text-neutral-500 hover:border-[#a8842b]/60 hover:text-[#a8842b] disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {uploading ? "Uploading…" : "Tap to upload the receipt (any image or PDF)"}
                  </button>
                )}
                {uploadErr && <p className="mt-1.5 text-xs text-red-600">{uploadErr}</p>}
              </div>
              {submitSale.error && <p className="text-sm text-red-600">{submitSale.error.message}</p>}
              <button
                type="submit"
                disabled={submitSale.isPending || uploading}
                className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60"
              >
                {submitSale.isPending ? "Submitting…" : "Submit for approval"}
              </button>
              <p className="text-xs text-neutral-400 text-center">An authorised admin reviews your evidence and forwards it to the finance office for confirmation, then your commission chain posts.</p>
            </form>
          </div>
        </div>
      )}

      {/* Withdrawal modal */}
      {wdFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setWdFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg">Request withdrawal</h3>
              <button onClick={() => setWdFor(null)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            {(() => {
              const savedBank = (me as { bankName?: string | null; accountNumber?: string | null; accountName?: string | null } | undefined);
              const hasAccount = !!(savedBank?.bankName && savedBank?.accountNumber && savedBank?.accountName);
              if (!hasAccount) {
                return (
                  <div className="space-y-4">
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      You haven't set up your payout bank account yet. Add it once in your profile and every
                      withdrawal after that is one tap.
                    </p>
                    <a
                      href="/app/profile"
                      className="block w-full rounded-xl gold-bg-grad py-3.5 text-center text-sm font-black text-white hover:opacity-90"
                    >
                      Set up my bank account
                    </a>
                  </div>
                );
              }
              return (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    withdraw.mutate({ commissionId: wdFor });
                  }}
                >
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Payout goes to</p>
                    <p className="mt-1 text-sm font-black text-ink">{savedBank!.bankName} · {savedBank!.accountNumber}</p>
                    <p className="text-xs text-neutral-500">{savedBank!.accountName}</p>
                    <a href="/app/profile" className="mt-1.5 inline-block text-xs font-bold text-[#a8842b] hover:underline">
                      Change account
                    </a>
                  </div>
                  {withdraw.error && <p className="text-sm text-red-600">{withdraw.error.message}</p>}
                  <button
                    type="submit"
                    disabled={withdraw.isPending}
                    className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60"
                  >
                    {withdraw.isPending ? "Requesting…" : "Request payout"}
                  </button>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
