import { useState } from "react";
import { BadgeCheck, Loader2, MessageCircle, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useContent } from "@/lib/content";
import { ExportBar } from "@/components/admin/ExportBar";
import { naira } from "@/lib/format";


const TYPE_LABEL: Record<string, string> = {
  membership: "Membership fee",
  property: "Property payment",
  commission_claim: "Commission claim",
};

const STATUS_BADGE: Record<string, string> = {
  approved: "text-emerald-700",
  rejected: "text-red-600",
};

export default function AdminPayments() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<string>("");
  const { data: rows, isLoading } = trpc.admin.paymentsList.useQuery({ status: status || undefined });
  const c = useContent("payments");
  const g = useContent("global");
  const whatsapp = (g("global.whatsapp.number", "2349019857226") || "").replace(/[^0-9]/g, "");

  const review = trpc.admin.reviewPayment.useMutation({
    onSuccess: async () => {
      await utils.admin.paymentsList.invalidate();
      await utils.admin.overview.invalidate();
      setRejecting(null);
      setReason("");
    },
  });
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-2">Admin</p>
        <h1 className="text-3xl font-black text-ink">Payments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Members pay into the official accounts and send screenshots on WhatsApp. Confirm a payment here to unlock access.
        </p>
      </div>

      {/* official accounts — editable under Site Content (payments.*) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["membership", "properties"] as const).map((k) => (
          <div key={k} className="rounded-2xl bg-ink p-5 text-ivory">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold">{c(`payments.${k}.label`)}</p>
            <p className="mt-2 font-mono text-xl font-extrabold">{c(`payments.${k}.account`)}</p>
            <p className="mt-1 text-sm text-ivory/60">
              {c(`payments.${k}.bank`)} · {c(`payments.${k}.name`)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-400">
        Account details and the WhatsApp number ({whatsapp}) are editable under <strong>Site Content → payments.* / global.whatsapp.number</strong>.
      </p>

      <div className="flex gap-2">
        {["", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${
              status === s ? "gold-bg-grad text-ink" : "border border-neutral-300 text-neutral-500 hover:text-ink"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <ExportBar datasets={["payments", "sales", "commissions"]} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#a8842b]" /></div>
      ) : (rows ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center text-sm text-neutral-400">
          No {status ? `${status} ` : ""}payments recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {(rows ?? []).map(({ payment: p, member: m, reviewer, expected }) => (
            <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">
                    {m ? `${m.firstName} ${m.lastName}` : `Member #${p.memberId}`}
                    <span className="ml-2 rounded bg-[#e9dcbb]/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7c6117]">
                      {TYPE_LABEL[p.type] ?? p.type}{p.planCode ? ` · ${p.planCode}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {m?.membershipCode} · {new Date(p.createdAt).toLocaleString("en-NG")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-[#7c6117]">{naira(p.amount)}</p>
                  {expected && (
                    <p className={`mt-0.5 text-[11px] font-semibold ${p.amount < expected.amount ? "text-red-600" : "text-neutral-400"}`}>
                      Expected: {naira(expected.amount)} — {expected.label}
                    </p>
                  )}
                </div>
              </div>
              {p.note && <p className="mt-3 whitespace-pre-line rounded-xl bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">{p.note}</p>}

              {p.status === "pending" ? (
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => review.mutate({ id: p.id, approve: true })}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-brand px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    <BadgeCheck className="h-4 w-4" /> Approve{p.type === "membership" ? " & activate" : ""}
                  </button>
                  {rejecting === p.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                      />
                      <button
                        onClick={() => review.mutate({ id: p.id, approve: false, reason: reason || undefined })}
                        disabled={review.isPending}
                        className="rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white"
                      >
                        Confirm reject
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRejecting(p.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-red-300 px-5 py-2.5 text-xs font-bold text-red-600"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                  )}
                  {m?.phone && (
                    <a
                      href={`https://wa.me/${m.phone.replace(/[^0-9]/g, "").replace(/^0/, "234")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-brand/40 px-4 py-2.5 text-xs font-bold text-emerald-brand"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp member
                    </a>
                  )}
                </div>
              ) : (
                <p className={`mt-3 text-xs font-bold uppercase tracking-widest ${STATUS_BADGE[p.status] ?? ""}`}>
                  {p.status}
                  {reviewer ? ` · by ${reviewer}` : ""}
                  {p.reviewedAt ? ` · ${new Date(p.reviewedAt).toLocaleString("en-NG")}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
