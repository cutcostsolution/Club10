import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { naira, fmtDate } from "@/lib/format";
import { Users, Banknote, TrendingUp, Sparkles, Building2, UserCheck, ArrowRight, Activity, BarChart3 } from "lucide-react";
import { Leaderboards } from "@/components/business/Leaderboards";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

function Analytics() {
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [memberId, setMemberId] = useState<number | undefined>();
  const { data: a } = trpc.admin.analytics.useQuery({ categoryId, memberId });
  if (!a) return null;

  const maxMonth = Math.max(1, ...a.salesByMonth.map((m) => m.value));
  const maxRealtor = Math.max(1, ...a.topRealtors.map((r) => r.value));
  const maxProduct = Math.max(1, ...a.salesByProduct.map((p) => p.value));
  const totalPlanMembers = Math.max(1, a.membersByPlan.reduce((s, p) => s + p.count, 0));

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
        <BarChart3 className="w-5 h-5 text-[#a8842b]" />
        <h2 className="font-black text-ink flex-1">Analytics</h2>
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        >
          <option value="">All communities</option>
          {a.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={memberId ?? ""}
          onChange={(e) => setMemberId(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        >
          <option value="">All realtors</option>
          {a.realtors.map((r) => <option key={r.id} value={r.id}>{r.firstName} {r.lastName}</option>)}
        </select>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {/* members by plan */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Members by plan</p>
          <div className="space-y-2.5">
            {a.membersByPlan.map((p) => (
              <div key={p.code}>
                <div className="flex justify-between text-xs font-bold text-ink">
                  <span>{p.name}</span><span>{p.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-neutral-100">
                  <div className="h-2 rounded-full gold-bg-grad" style={{ width: `${(p.count / totalPlanMembers) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* sales by month */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Approved sales — last months</p>
          {a.salesByMonth.length === 0 ? (
            <p className="text-sm text-neutral-400">No approved sales in this selection.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {a.salesByMonth.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <p className="text-[10px] font-bold text-neutral-500">{naira(m.value)}</p>
                  <div className="w-full rounded-t-lg gold-bg-grad" style={{ height: `${Math.max(4, (m.value / maxMonth) * 110)}px` }} />
                  <p className="text-[10px] font-bold text-neutral-400">{monthLabel(m.month)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* top realtors */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Top realtors by approved sales</p>
          {a.topRealtors.length === 0 ? (
            <p className="text-sm text-neutral-400">No approved sales in this selection.</p>
          ) : (
            <div className="space-y-2.5">
              {a.topRealtors.map((r) => (
                <div key={r.name}>
                  <div className="flex justify-between text-xs font-bold text-ink">
                    <span>{r.name} <span className="font-normal text-neutral-400">({r.count})</span></span>
                    <span>{naira(r.value)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-neutral-100">
                    <div className="h-2 rounded-full bg-ink" style={{ width: `${(r.value / maxRealtor) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* sales by product + pipeline */}
        <div className="space-y-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Sales by community / product</p>
            {a.salesByProduct.length === 0 ? (
              <p className="text-sm text-neutral-400">No approved sales in this selection.</p>
            ) : (
              <div className="space-y-2.5">
                {a.salesByProduct.map((p) => (
                  <div key={p.name}>
                    <div className="flex justify-between text-xs font-bold text-ink">
                      <span>{p.name} <span className="font-normal text-neutral-400">({p.count})</span></span>
                      <span>{naira(p.value)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-neutral-100">
                      <div className="h-2 rounded-full bg-[#a8842b]" style={{ width: `${(p.value / maxProduct) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">Pipeline (this selection)</p>
            <div className="grid grid-cols-3 gap-3">
              {(["pending", "approved", "rejected"] as const).map((s) => (
                <div key={s} className="rounded-xl border border-neutral-200 p-3 text-center">
                  <p className="text-xl font-black text-ink">{a.statusCount[s]}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 capitalize">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const { data, isLoading } = trpc.admin.overview.useQuery();
  const { data: plans } = trpc.admin.plansList.useQuery();
  const utils = trpc.useUtils();
  const approve = trpc.admin.approveMember.useMutation({
    onSuccess: () => utils.admin.overview.invalidate(),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const planName = (code: string) => plans?.find((p) => p.code === code)?.name ?? code;

  const stats = [
    { label: "Total realtors", value: data.totalMembers.toLocaleString(), icon: Users, sub: `${data.activeMembers} active` },
    { label: "Pending registrations", value: data.pendingRegs.toLocaleString(), icon: UserCheck, sub: "awaiting approval" },
    { label: "Pending sales", value: data.pendingSales.toLocaleString(), icon: Banknote, sub: naira(data.pendingValue) + " in queue" },
    { label: "Approved sales value", value: naira(data.totalSalesValue), icon: TrendingUp, sub: `${data.totalSalesCount} sales` },
    { label: "Points in circulation", value: data.pointsInCirculation.toLocaleString(), icon: Sparkles, sub: "points-earning plans" },
    { label: "Live properties", value: data.propsLive.toLocaleString(), icon: Building2, sub: "in the catalogue" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-2">Admin console</p>
        <h1 className="text-3xl font-black text-ink">Overview</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-neutral-200 p-5">
            <s.icon className="w-5 h-5 mb-3 text-[#a8842b]" />
            <p className="text-2xl font-black text-ink">{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mt-1">{s.label}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Deeper analytics with filters */}
      <Analytics />

      {/* Live rankings — points champions and top recruiters (Pro and above) */}
      <Leaderboards />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending registrations */}
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="font-black text-ink">Pending registrations</h2>
            <Link to="/admin/realtors" className="text-xs font-bold text-[#a8842b] hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.pendingMembers.length === 0 ? (
            <p className="px-6 py-8 text-center text-neutral-400 text-sm">No registrations waiting.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.pendingMembers.map((m) => (
                <li key={m.id} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink text-sm truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-xs text-neutral-400">
                      {planName(m.category)} · {m.membershipCode} · {fmtDate(m.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => approve.mutate({ id: m.id })}
                    disabled={approve.isPending}
                    className="shrink-0 px-4 py-2 rounded-lg gold-bg-grad text-white text-xs font-bold hover:opacity-90 disabled:opacity-60"
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent sales */}
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="font-black text-ink">Recent sales</h2>
            <Link to="/admin/commissions" className="text-xs font-bold text-[#a8842b] hover:underline inline-flex items-center gap-1">
              Review queue <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.recentSales.length === 0 ? (
            <p className="px-6 py-8 text-center text-neutral-400 text-sm">No sales yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.recentSales.map(({ sale, product, seller }) => (
                <li key={sale.id} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink text-sm truncate">{product?.name ?? "Product"} — {naira(sale.salePrice)}</p>
                    <p className="text-xs text-neutral-400">
                      by {seller ? `${seller.firstName} ${seller.lastName}` : "—"} · {fmtDate(sale.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${
                    sale.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                    sale.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
                  }`}>
                    {sale.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#a8842b]" />
          <h2 className="font-black text-ink">Admin activity</h2>
        </div>
        {data.activity.length === 0 ? (
          <p className="px-6 py-8 text-center text-neutral-400 text-sm">No activity logged yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.activity.map((a) => (
              <li key={a.id} className="px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-bold text-ink capitalize">{a.action.replace(/_/g, " ")}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#a8842b]">{a.module}</span>
                {a.details && <span className="text-neutral-500 text-xs">{a.details}</span>}
                <span className="ml-auto text-xs text-neutral-400">{fmtDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
