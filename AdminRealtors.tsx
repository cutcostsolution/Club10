import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { fmtDate, naira } from "@/lib/format";
import {
  Search, Download, CheckCircle2, Eye, X, Link2, Users, Network, Copy, Check, BadgeDollarSign,
  GitBranch, ShieldCheck, Ticket,
} from "lucide-react";

const STATUS_OPTS = ["", "pending", "active", "suspended", "expired"];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-red-50 text-red-600",
  expired: "bg-neutral-100 text-neutral-500",
};

function referralLink(code: string) {
  return `${window.location.origin}/r/${code}`;
}

/* ------------------------------ detail drawer ------------------------------ */

function MemberDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.memberDetail.useQuery({ id });
  const { data: allMembers } = trpc.admin.membersList.useQuery({});
  const [copied, setCopied] = useState(false);
  const [newUpline, setNewUpline] = useState("");
  const [moveMsg, setMoveMsg] = useState("");

  const invalidate = () => {
    utils.admin.memberDetail.invalidate({ id });
    utils.admin.membersList.invalidate();
  };
  const moveUpline = trpc.admin.moveMemberUpline.useMutation({
    onSuccess: () => {
      setMoveMsg("Upline updated.");
      setNewUpline("");
      invalidate();
      setTimeout(() => setMoveMsg(""), 3000);
    },
  });
  const grantAdmin = trpc.admin.grantAdminByMember.useMutation({ onSuccess: invalidate });
  const revokeAdmin = trpc.admin.revokeAdmin.useMutation({ onSuccess: invalidate });

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-6 py-4">
          <h2 className="text-lg font-black text-ink">Realtor profile</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 px-6 py-6">
            {/* bio-data */}
            <section>
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Bio-data</p>
              <div className="rounded-2xl border border-neutral-200 p-5">
                <div className="flex items-center gap-4">
                  {(data.member as any).photoUrl ? (
                    <img src={(data.member as any).photoUrl} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-[#a8842b]/30" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full gold-bg-grad text-xl font-black text-white">
                      {data.member.firstName[0]}{data.member.lastName[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-black text-ink">{data.member.firstName} {data.member.lastName}</p>
                    <p className="text-xs font-mono text-neutral-400">{data.member.membershipCode}</p>
                  </div>
                  <span className={`ml-auto inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_BADGE[data.member.status] ?? ""}`}>
                    {data.member.status}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  <div><dt className="text-xs text-neutral-400">Plan</dt><dd className="font-bold text-ink">{data.plan?.name ?? data.member.category}</dd></div>
                  <div><dt className="text-xs text-neutral-400">Phone</dt><dd className="font-semibold text-ink">{data.member.phone || data.user?.phone || "—"}</dd></div>
                  <div><dt className="text-xs text-neutral-400">Email</dt><dd className="font-semibold text-ink break-all">{data.user?.email ?? "—"}</dd></div>
                  <div><dt className="text-xs text-neutral-400">Joined</dt><dd className="font-semibold text-ink">{fmtDate(data.member.createdAt)}</dd></div>
                  <div><dt className="text-xs text-neutral-400">Points</dt><dd className="font-semibold text-ink">{data.member.pointsBalance.toLocaleString()}</dd></div>
                  <div><dt className="text-xs text-neutral-400">Voucher balance</dt><dd className="font-semibold text-ink">{naira(data.member.voucherBalance)}</dd></div>
                  <div><dt className="text-xs text-neutral-400">Total commission earned</dt><dd className="font-semibold text-ink">{naira(data.totalEarned)}</dd></div>
                  <div><dt className="text-xs text-neutral-400">Expires</dt><dd className="font-semibold text-ink">{data.member.expiresAt ? fmtDate(data.member.expiresAt) : "—"}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-neutral-400">Address</dt><dd className="font-semibold text-ink">{[(data.member as any).address, (data.member as any).city, (data.member as any).state, (data.member as any).country].filter(Boolean).join(", ") || "—"}</dd></div>
                </dl>
                {data.member.bio && <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600 whitespace-pre-line">{data.member.bio}</p>}
              </div>
            </section>

            {/* who invited them */}
            <section>
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Who invited them</p>
              {data.inviter ? (
                <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
                  <Network className="w-5 h-5 text-[#a8842b]" />
                  <div>
                    <p className="font-bold text-ink">{data.inviter.firstName} {data.inviter.lastName}</p>
                    <p className="text-xs font-mono text-neutral-400">{data.inviter.membershipCode} · ref code {data.inviter.referralCode}</p>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-400">
                  No inviter on record — joined directly.
                </p>
              )}
              {/* move to another upline — for fixing registrations that went wrong */}
              <div className="mt-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 shrink-0 text-[#a8842b]" />
                <select
                  value={newUpline}
                  onChange={(e) => setNewUpline(e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                >
                  <option value="">Move under another realtor…</option>
                  {(allMembers ?? [])
                    .filter((mm) => mm.id !== data.member.id)
                    .map((mm) => (
                      <option key={mm.id} value={mm.id}>
                        {mm.firstName} {mm.lastName} ({mm.membershipCode})
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => newUpline && moveUpline.mutate({ id: data.member.id, newUplineId: Number(newUpline) })}
                  disabled={!newUpline || moveUpline.isPending}
                  className="shrink-0 rounded-lg gold-bg-grad px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Move
                </button>
              </div>
              {moveUpline.error && <p className="mt-2 text-xs text-red-600">{moveUpline.error.message}</p>}
              {moveMsg && <p className="mt-2 text-xs font-semibold text-emerald-600">{moveMsg}</p>}
            </section>

            {/* voucher wallet */}
            <section>
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Property voucher</p>
              <div className="rounded-2xl border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-[#a8842b]" />
                    <span className="text-sm font-bold text-ink">Balance</span>
                  </div>
                  <span className="text-lg font-black text-ink">{naira(data.member.voucherBalance)}</span>
                </div>
                {(data as any).voucherTx?.length > 0 && (
                  <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 pt-1">
                    {(data as any).voucherTx.slice(0, 8).map((tx: any) => (
                      <li key={tx.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <span className="min-w-0 flex-1 truncate text-neutral-500">{tx.note}</span>
                        <span className={`shrink-0 font-black ${tx.amount > 0 ? "text-emerald-600" : "text-neutral-700"}`}>
                          {tx.amount > 0 ? "+" : "−"}{naira(Math.abs(tx.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* 30-day AI marketing plan progress */}
            {(data as any).aiPlan && (
              <section>
                <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">30-day marketing plan</p>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                      {(data as any).aiPlan.title}
                      {(data as any).aiPlan.status === "completed" && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Completed</span>
                      )}
                    </p>
                    <span className="shrink-0 text-sm font-black text-[#7c6117]">{(data as any).aiPlan.percent}%</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full rounded-full gold-bg-grad" style={{ width: `${(data as any).aiPlan.percent}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-400">
                    {(data as any).aiPlan.doneTasks} of {(data as any).aiPlan.totalTasks} tasks reported
                  </p>
                  {(data as any).aiPlan.recentReports?.length > 0 && (
                    <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 pt-1">
                      {(data as any).aiPlan.recentReports.slice(0, 6).map((r: any) => (
                        <li key={r.id} className="py-2 text-xs">
                          <p className="font-bold text-neutral-500">Day {r.day} · task {r.taskIndex + 1}</p>
                          <p className="mt-0.5 text-neutral-600 leading-relaxed">{r.feedback}</p>
                          <p className="mt-0.5 text-[10px] font-bold text-neutral-400">
                            {[
                              r.contacted != null ? `contacted ${r.contacted}` : null,
                              r.responses != null ? `responses ${r.responses}` : null,
                              r.viewings != null ? `viewings ${r.viewings}` : null,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {/* admin access */}
            <section>
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Back-office access</p>
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
                <ShieldCheck className="w-5 h-5 shrink-0 text-[#a8842b]" />
                {(data.user as any)?.role === "admin" ? (
                  <>
                    <p className="flex-1 text-sm font-bold text-ink">
                      {(data.user as any).adminRole === "central" ? "Central Admin" : "Admin (manager)"}
                    </p>
                    <button
                      onClick={() => data.user && revokeAdmin.mutate({ userId: (data.member as any).userId })}
                      disabled={revokeAdmin.isPending}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Revoke access
                    </button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-xs text-neutral-500">Member account only — grant back-office access:</p>
                    <button
                      onClick={() => grantAdmin.mutate({ memberId: data.member.id, adminRole: "manager" })}
                      disabled={grantAdmin.isPending}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold text-ink hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Make admin
                    </button>
                    <button
                      onClick={() => grantAdmin.mutate({ memberId: data.member.id, adminRole: "central" })}
                      disabled={grantAdmin.isPending}
                      className="rounded-lg gold-bg-grad px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Central Admin
                    </button>
                  </>
                )}
                {(grantAdmin.error || revokeAdmin.error) && (
                  <p className="text-xs text-red-600">{(grantAdmin.error ?? revokeAdmin.error)?.message}</p>
                )}
              </div>
            </section>

            {/* referral link */}
            <section>
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Their referral link</p>
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 p-4">
                <Link2 className="w-4 h-4 shrink-0 text-[#a8842b]" />
                <code className="flex-1 truncate text-xs font-semibold text-ink">{referralLink(data.member.referralCode)}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(referralLink(data.member.referralCode));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </section>

            {/* downline */}
            <section>
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">
                Their team — direct downline ({data.downline.length})
              </p>
              {data.downline.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-400">No recruits yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
                  {data.downline.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      <Users className="w-4 h-4 shrink-0 text-neutral-300" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-ink">{d.firstName} {d.lastName}</p>
                        <p className="text-xs font-mono text-neutral-400">{d.membershipCode}</p>
                      </div>
                      <span className="text-xs font-semibold capitalize text-neutral-500">{d.category}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${STATUS_BADGE[d.status] ?? ""}`}>{d.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* their sales */}
            <section>
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Their sales ({data.sales.length})</p>
              {data.sales.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-400">No sales yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
                  {data.sales.map(({ sale, product }) => (
                    <li key={sale.id} className="flex items-center gap-3 px-4 py-3">
                      <BadgeDollarSign className="w-4 h-4 shrink-0 text-neutral-300" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-ink">{product?.name ?? "Product"}</p>
                        <p className="text-xs text-neutral-400">{fmtDate(sale.createdAt)}</p>
                      </div>
                      <span className="text-sm font-black text-ink">{naira(sale.salePrice)}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${STATUS_BADGE[sale.status] ?? ""}`}>{sale.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- page ----------------------------------- */

export default function AdminRealtors() {
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState({ status: "", category: "", search: "", from: "", to: "" });
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: plans } = trpc.admin.plansList.useQuery();
  const { data: members, isLoading } = trpc.admin.membersList.useQuery({
    status: filters.status || undefined,
    category: filters.category || undefined,
    search: filters.search || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  });

  const invalidate = () => {
    utils.admin.membersList.invalidate();
    if (detailId != null) utils.admin.memberDetail.invalidate({ id: detailId });
  };
  const approve = trpc.admin.approveMember.useMutation({ onSuccess: invalidate });
  const setStatus = trpc.admin.setMemberStatus.useMutation({ onSuccess: invalidate });
  const setCategory = trpc.admin.setMemberCategory.useMutation({ onSuccess: invalidate });


  // full biodata export — every field, incl. upline, status, address, bank and
  // plan dates — served by the back office as a ready-to-open CSV
  // quick export — honours the filters currently set on this dashboard
  // (status, plan and join-date range), served as a ready-to-open CSV
  const exportMembers = () => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.status) params.set("status", filters.status);
    if (filters.category) params.set("category", filters.category);
    window.open(`/api/export/members${params.size ? `?${params}` : ""}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Admin</p>
          <h1 className="text-3xl font-black text-ink">Realtors</h1>
          <p className="text-neutral-500 mt-1">Click the eye to see full bio-data, who invited them, their referral link and their team.</p>
        </div>
        <button
          onClick={exportMembers}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-300 bg-white font-bold text-sm text-ink hover:bg-neutral-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className="col-span-2 md:col-span-1 flex items-center gap-2 rounded-xl border border-neutral-200 px-3">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Name or code…"
            className="w-full py-2.5 text-sm focus:outline-none"
          />
        </label>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        >
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s ? `Status: ${s}` : "All statuses"}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        >
          <option value="">All plans</option>
          {(plans ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !members || members.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No members match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Invited by</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Points</th>
                  <th className="px-5 py-3 text-right">Voucher</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50/60 align-top">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-neutral-400 font-mono">{m.membershipCode}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {(m as any).inviter ? (
                        <>
                          <p className="font-semibold text-ink text-xs">{(m as any).inviter.name}</p>
                          <p className="text-[11px] text-neutral-400 font-mono">{(m as any).inviter.code}</p>
                        </>
                      ) : (
                        <span className="text-[11px] text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={m.category}
                        onChange={(e) => setCategory.mutate({ id: m.id, category: e.target.value })}
                        className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                      >
                        {(plans ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                        {plans && !plans.some((p) => p.code === m.category) && (
                          <option value={m.category}>{m.category} (retired)</option>
                        )}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[m.status] ?? ""}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold">{m.pointsBalance.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-neutral-500">{naira(m.voucherBalance)}</td>
                    <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setDetailId(m.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 text-ink text-xs font-bold hover:bg-neutral-50"
                          title="View full profile"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        {m.status === "pending" && (
                          <button
                            onClick={() => approve.mutate({ id: m.id })}
                            disabled={approve.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg gold-bg-grad text-white text-xs font-bold hover:opacity-90 disabled:opacity-60"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                        )}
                        {m.status === "active" && (
                          <button
                            onClick={() => setStatus.mutate({ id: m.id, status: "suspended" })}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                          >
                            Suspend
                          </button>
                        )}
                        {m.status === "suspended" && (
                          <button
                            onClick={() => setStatus.mutate({ id: m.id, status: "active" })}
                            className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId != null && <MemberDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
