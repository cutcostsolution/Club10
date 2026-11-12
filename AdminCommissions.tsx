import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { naira, fmtDate } from "@/lib/format";
import { CheckCircle2, XCircle, Download, Banknote, ArrowDownToLine } from "lucide-react";
import { ExportBar } from "@/components/admin/ExportBar";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  revoked: "bg-red-100 text-red-700",
  paid: "bg-neutral-100 text-neutral-500",
  processing: "bg-blue-50 text-blue-700",
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminCommissions() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("pending");
  const { data: queue, isLoading } = trpc.admin.salesQueue.useQuery({ status: statusFilter || undefined });
  const { data: withdrawals } = trpc.admin.withdrawalsList.useQuery();
  const { data: ledger } = trpc.admin.commissionLedger.useQuery();

  const approve = trpc.admin.approveSale.useMutation({ onSuccess: () => { utils.admin.salesQueue.invalidate(); utils.admin.overview.invalidate(); } });
  const reject = trpc.admin.rejectSale.useMutation({ onSuccess: () => utils.admin.salesQueue.invalidate() });
  const revoke = trpc.admin.revokeSale.useMutation({
    onSuccess: (r) => {
      utils.admin.salesQueue.invalidate();
      utils.admin.commissionLedger.invalidate();
      utils.admin.overview.invalidate();
      if (r.paidOut > 0)
        alert(`Sale revoked — note: ${r.paidOut} commission(s) from it were already paid out via withdrawals. The finance office should recover those manually.`);
    },
  });
  const delCommission = trpc.admin.deleteCommission.useMutation({ onSuccess: () => utils.admin.commissionLedger.invalidate() });
  const setWd = trpc.admin.setWithdrawalStatus.useMutation({ onSuccess: () => utils.admin.withdrawalsList.invalidate() });

  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [refFor, setRefFor] = useState<{ id: number; status: "processing" | "paid" | "rejected" } | null>(null);
  const [reference, setReference] = useState("");

  const exportRows = async (type: "sales" | "commissions" | "withdrawals", name: string) => {
    const rows = await utils.admin.exportData.fetch({ type });
    downloadCsv(`club10-${name}-${new Date().toISOString().slice(0, 10)}.csv`, rows as unknown as Record<string, unknown>[]);
  };

  /** Export the current queue for the finance office — full payment evidence. */
  const exportForFinance = async () => {
    const rows = await utils.admin.financeExport.fetch({
      status: (statusFilter || "all") as "pending" | "approved" | "rejected" | "all",
    });
    downloadCsv(`club10-finance-${statusFilter || "all"}-${new Date().toISOString().slice(0, 10)}.csv`, rows as unknown as Record<string, unknown>[]);
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-2">Admin</p>
        <h1 className="text-3xl font-black text-ink">Commissions</h1>
        <p className="text-neutral-500 mt-1">
          Two separate flows: <b>Commission Submissions</b> are sales realtors reported (approve to pay the chain);
          <b> Withdrawal Requests</b> are approved commissions realtors are cashing out.
        </p>
      </div>

      {/* Commission submissions */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
          <Banknote className="w-5 h-5 text-[#a8842b]" />
          <div className="flex-1">
            <h2 className="font-black text-ink">Commission Submissions</h2>
            <p className="text-xs text-neutral-400">Sales reported by realtors, awaiting your approval</p>
          </div>
          <button
            onClick={exportForFinance}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl gold-bg-grad text-white font-bold text-xs hover:opacity-90"
          >
            <Download className="w-3.5 h-3.5" /> Export for finance office
          </button>
          <button
            onClick={() => exportRows("sales", "commission-submissions")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 bg-white font-bold text-xs text-ink hover:bg-neutral-50"
          >
            <Download className="w-3.5 h-3.5" /> Export submissions (CSV)
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !queue || queue.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">Nothing in this queue.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {queue.map(({ sale, product, seller, reviewer }) => (
              <li key={sale.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[220px]">
                    <p className="font-bold text-ink">{product?.name ?? "Product"} — {naira(sale.salePrice)}</p>
                    <p className="text-xs text-neutral-400">
                      by {seller ? `${seller.firstName} ${seller.lastName} (${seller.membershipCode})` : "—"} · {fmtDate(sale.createdAt)}
                      {sale.buyerName ? ` · Buyer: ${sale.buyerName}` : ""}
                    </p>
                    {(sale.paymentDate || sale.senderName || sale.description || sale.receiptUrl) && (
                      <div className="mt-1.5 text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2 space-y-1">
                        {sale.paymentDate && <p><span className="font-bold text-neutral-600">Paid on:</span> {sale.paymentDate}</p>}
                        {sale.senderName && <p><span className="font-bold text-neutral-600">Sent by:</span> {sale.senderName}</p>}
                        {sale.description && <p className="whitespace-pre-line"><span className="font-bold text-neutral-600">Description:</span> {sale.description}</p>}
                        {sale.receiptUrl && (
                          <a href={sale.receiptUrl} target="_blank" rel="noreferrer" className="inline-block font-bold text-[#a8842b] hover:underline">
                            View payment receipt
                          </a>
                        )}
                      </div>
                    )}
                    {sale.receiptNote && !sale.description && (
                      <p className="mt-1.5 text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2 whitespace-pre-line">{sale.receiptNote}</p>
                    )}
                    {reviewer && sale.status !== "pending" && (
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {sale.status === "approved" ? "Approved" : "Reviewed"} by <span className="font-bold text-neutral-500">{reviewer}</span>
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[sale.status] ?? ""}`}>
                    {sale.status}
                  </span>
                  {sale.status === "approved" && (
                    <button
                      onClick={() => {
                        const reason = prompt(
                          "Revoke this approved sale? The chain commissions will be reversed and points clawed back.\n\nReason (optional):"
                        );
                        if (reason !== null) revoke.mutate({ id: sale.id, reason: reason || undefined });
                      }}
                      disabled={revoke.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-60"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Revoke
                    </button>
                  )}
                  {sale.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => approve.mutate({ id: sale.id })}
                        disabled={approve.isPending}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg gold-bg-grad text-white text-xs font-bold hover:opacity-90 disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & pay chain
                      </button>
                      <button
                        onClick={() => { setRejectFor(sale.id); setReason(""); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Withdrawal requests */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
          <ArrowDownToLine className="w-5 h-5 text-[#a8842b]" />
          <div className="flex-1">
            <h2 className="font-black text-ink">Withdrawal Requests</h2>
            <p className="text-xs text-neutral-400">Approved commissions realtors are claiming as payout</p>
          </div>
          <button
            onClick={() => exportRows("withdrawals", "withdrawal-requests")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 bg-white font-bold text-xs text-ink hover:bg-neutral-50"
          >
            <Download className="w-3.5 h-3.5" /> Export withdrawal requests (CSV)
          </button>
          <button
            onClick={() => exportRows("commissions", "commission-ledger")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 bg-white font-bold text-xs text-ink hover:bg-neutral-50"
          >
            <Download className="w-3.5 h-3.5" /> Export full commission ledger (CSV)
          </button>
        </div>
        {!withdrawals || withdrawals.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No withdrawal requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Product sold</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Bank details</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {withdrawals.map(({ withdrawal: w, member, commission, product }) => (
                  <tr key={w.id} className="hover:bg-neutral-50/60 align-top">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink">{member ? `${member.firstName} ${member.lastName}` : "—"}</p>
                      <p className="text-xs text-neutral-400 font-mono">{member?.membershipCode}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink">{product?.name ?? (commission?.level === -1 ? "(membership referral)" : "—")}</p>
                      {commission && (
                        <p className="text-xs text-neutral-400">
                          {commission.level === -1
                            ? (commission as { note?: string | null }).note?.startsWith("Renewal")
                              ? "Renewal commission"
                              : (commission as { note?: string | null }).note?.startsWith("Upgrade")
                                ? "Upgrade commission"
                                : "Registration commission"
                            : commission.level === 0
                              ? "Direct sale"
                              : `Chain level ${commission.level}`}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-ink whitespace-nowrap">{naira(w.amount)}</td>
                    <td className="px-5 py-3.5 text-xs text-neutral-500 whitespace-pre-line max-w-[220px]">{w.bankDetails}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[w.status] ?? ""}`}>
                        {w.status}
                      </span>
                      {w.reference && <p className="text-xs text-neutral-400 mt-1">ref {w.reference}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{fmtDate(w.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      {w.status === "pending" && (
                        <div className="flex flex-wrap gap-1.5">
                          {(["processing", "paid", "rejected"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => { setRefFor({ id: w.id, status: s }); setReference(""); }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
                                s === "paid" ? "gold-bg-grad text-white" :
                                s === "rejected" ? "border border-red-200 text-red-600 hover:bg-red-50" :
                                "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setRejectFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-ink text-lg mb-4">Reject sale submission</h3>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (sent to the member)…"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setRejectFor(null)} className="flex-1 py-3 rounded-xl border border-neutral-200 font-bold text-sm text-ink hover:bg-neutral-50">
                Cancel
              </button>
              <button
                onClick={() => reject.mutate({ id: rejectFor, reason: reason || undefined }, { onSuccess: () => setRejectFor(null) })}
                disabled={reject.isPending}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-60"
              >
                Reject sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full commission ledger — error-correction control */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-black text-ink">Commission ledger</h2>
          <p className="text-xs text-neutral-400">Every commission ever posted — delete a row only to correct an error. Paid rows are protected; revoke the parent sale instead.</p>
        </div>
        {!ledger || ledger.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No commissions posted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Posted</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ledger.slice(0, 100).map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-bold text-ink">{c.memberName} <span className="text-neutral-400 font-mono text-xs">{c.memberCode}</span></td>
                    <td className="px-5 py-3 text-neutral-500">
                      {c.saleId
                        ? `Sale #${c.saleId}`
                        : (c as { note?: string | null }).note?.startsWith("Renewal")
                          ? "Renewal"
                          : (c as { note?: string | null }).note?.startsWith("Upgrade")
                            ? "Upgrade"
                            : "Registration"}
                      {" · "}{c.level === -1 ? "plan payment" : c.level === 0 ? "direct" : `chain L${c.level}`}
                    </td>
                    <td className="px-5 py-3 text-right font-extrabold text-ink">{naira(c.amount)}</td>
                    <td className="px-5 py-3"><span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[c.status] ?? ""}`}>{c.status}</span></td>
                    <td className="px-5 py-3 text-neutral-400 text-xs">{fmtDate(c.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {c.status !== "paid" && (
                        <button
                          onClick={() => { if (confirm(`Delete this ${naira(c.amount)} commission for ${c.memberName}? This cannot be undone.`)) delCommission.mutate({ id: c.id }); }}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50"
                        >
                          Delete
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

      <ExportBar datasets={["commissions", "sales"]} title="Export commissions & sales (CSV)" />

      {/* Withdrawal status modal */}
      {refFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setRefFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-ink text-lg mb-4 capitalize">Mark withdrawal as {refFor.status}</h3>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Payment reference (optional)"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setRefFor(null)} className="flex-1 py-3 rounded-xl border border-neutral-200 font-bold text-sm text-ink hover:bg-neutral-50">
                Cancel
              </button>
              <button
                onClick={() => setWd.mutate({ id: refFor.id, status: refFor.status, reference: reference || undefined }, { onSuccess: () => setRefFor(null) })}
                disabled={setWd.isPending}
                className="flex-1 py-3 rounded-xl gold-bg-grad text-white font-bold hover:opacity-90 disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
