import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2, Map, Search, Sparkles,
  TrendingUp, Users, X, ClipboardList,
} from "lucide-react";

type TrackerRow = {
  planId: number | null;
  memberId: number;
  memberName: string;
  membershipCode: string;
  category: string;
  memberStatus: string;
  title: string;
  goal: string | null;
  productName: string | null;
  status: string;
  createdAt: string | Date | null;
  totalTasks: number;
  doneTasks: number;
  percent: number;
  currentDay: number;
  lastReportAt: string | null;
  generations: number;
  lastGenerationAt: string | null;
};

type Report = {
  id: number;
  day: number;
  taskIndex: number;
  feedback: string;
  contacted: number | null;
  responses: number | null;
  viewings: number | null;
  createdAt: string | Date;
};

function fmtD(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminMarketing() {
  const { data: rows, isLoading } = trpc.admin.aiTracker.useQuery();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | "active" | "completed" | "none">("all");
  const [detailFor, setDetailFor] = useState<number | null>(null);

  const list = (rows ?? []) as TrackerRow[];
  const filtered = useMemo(() => {
    return list.filter((r) => {
      if (stage === "active" && r.status !== "active") return false;
      if (stage === "completed" && r.status !== "completed") return false;
      if (stage === "none" && r.status !== "none") return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        return (
          r.memberName.toLowerCase().includes(needle) ||
          r.membershipCode.toLowerCase().includes(needle) ||
          r.title.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [list, q, stage]);

  const stats = useMemo(() => {
    const withPlan = list.filter((r) => r.planId != null);
    const active = withPlan.filter((r) => r.status === "active").length;
    const avg = withPlan.length ? Math.round(withPlan.reduce((s, r) => s + r.percent, 0) / withPlan.length) : 0;
    const reports = list.reduce((s, r) => s + r.doneTasks, 0);
    const gens = list.reduce((s, r) => s + r.generations, 0);
    return { realtors: new Set(list.map((r) => r.memberId)).size, active, avg, reports, gens };
  }, [list]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-ink">Marketing Tracker</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every paid member's 30-day plan progress, task reports and Marketing Studio usage — click a row to see the full plan and feedback.
        </p>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Realtors on the studio", value: stats.realtors, icon: Users },
          { label: "Active 30-day plans", value: stats.active, icon: Map },
          { label: "Average plan progress", value: `${stats.avg}%`, icon: TrendingUp },
          { label: "Task reports filed", value: stats.reports, icon: ClipboardList },
          { label: "Quick-tool generations", value: stats.gens, icon: Sparkles },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <c.icon className="w-4 h-4 text-[#a8842b] mb-2" />
            <p className="text-2xl font-black text-ink">{c.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search member, code or plan…"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
          />
        </div>
        {(["all", "active", "completed", "none"] as const).map((s2) => (
          <button
            key={s2}
            onClick={() => setStage(s2)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              stage === s2 ? "bg-ink text-white" : "bg-white border border-neutral-200 text-neutral-500 hover:text-ink"
            }`}
          >
            {s2 === "all" ? "All" : s2 === "active" ? "Active plans" : s2 === "completed" ? "Completed" : "Quick tools only"}
          </button>
        ))}
      </div>

      {/* table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#a8842b]" /></div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-neutral-400">
            No marketing activity yet — realtors on Pro and above will appear here the moment they build a plan or generate content.
          </p>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left">
                <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-400">Realtor</th>
                <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-400">Plan</th>
                <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-400">Progress</th>
                <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-400">Reports</th>
                <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-400">Generations</th>
                <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-400">Last activity</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((r) => (
                <tr key={`${r.memberId}-${r.planId ?? "none"}`} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-ink">{r.memberName}</p>
                    <p className="text-xs text-neutral-400">{r.membershipCode} · {r.category}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.planId ? (
                      <>
                        <p className="font-semibold text-ink max-w-[220px] truncate">{r.title}</p>
                        <p className="text-xs text-neutral-400">
                          {r.productName ?? "General"} · Day {r.currentDay}/30 ·{" "}
                          <span className={r.status === "completed" ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>{r.status}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-neutral-400">No 30-day plan — quick tools only</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 w-44">
                    {r.planId ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                          <div className="h-full rounded-full gold-bg-grad" style={{ width: `${r.percent}%` }} />
                        </div>
                        <span className="text-xs font-black text-ink w-9 text-right">{r.percent}%</span>
                      </div>
                    ) : <span className="text-xs text-neutral-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-bold text-neutral-500">
                    {r.planId ? `${r.doneTasks}/${r.totalTasks}` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-bold text-neutral-500">{r.generations}</td>
                  <td className="px-5 py-3.5 text-xs text-neutral-400">
                    {fmtD(r.lastReportAt ?? r.lastGenerationAt ?? r.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    {r.planId && (
                      <button
                        onClick={() => setDetailFor(r.memberId)}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold text-ink hover:bg-neutral-50"
                      >
                        View plan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailFor != null && <PlanDetailModal memberId={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  );
}

function PlanDetailModal({ memberId, onClose }: { memberId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.admin.aiPlanDetail.useQuery({ memberId });
  const [openDay, setOpenDay] = useState<number | null>(null);

  const reportMap = useMemo(() => {
    const m: Record<string, Report> = {};
    for (const r of (data?.reports ?? []) as Report[]) m[`${r.day}:${r.taskIndex}`] = r;
    return m;
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 my-8" onClick={(e) => e.stopPropagation()}>
        {isLoading || !data ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#a8842b]" /></div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="font-black text-ink text-lg">{data.member.name}'s 30-day plan</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  {data.member.code} · {data.member.category} · {data.plan.title}
                  {data.productName ? ` · pushing ${data.productName}` : ""} · started {fmtD(data.plan.createdAt)}
                  {" · "}
                  <span className={data.plan.status === "completed" ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                    {data.plan.status}
                  </span>
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="rounded-xl border border-neutral-200 p-4 mb-5">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-neutral-500">{data.stats.doneTasks} of {data.stats.totalTasks} tasks reported</span>
                <span className="text-[#7c6117] text-base font-black">{data.stats.percent}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full rounded-full gold-bg-grad" style={{ width: `${data.stats.percent}%` }} />
              </div>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {data.days.map((d) => {
                const open = openDay === d.day;
                const doneCount = d.tasks.filter((_, i) => reportMap[`${d.day}:${i}`]).length;
                const allDone = doneCount === d.tasks.length;
                return (
                  <div key={d.id} className={`rounded-xl border ${allDone ? "border-emerald-200" : "border-neutral-200"}`}>
                    <button onClick={() => setOpenDay(open ? null : d.day)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                      <span className={`shrink-0 w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                        <span className="text-[8px] uppercase leading-none">Day</span>
                        <span className="text-sm leading-tight">{d.day}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-ink truncate">{d.title}</p>
                        <p className="text-xs text-neutral-400">{doneCount}/{d.tasks.length} reported</p>
                      </div>
                      {open ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                    </button>
                    {open && (
                      <div className="border-t border-neutral-100 px-4 py-3 space-y-2">
                        {d.tasks.map((task, i) => {
                          const r = reportMap[`${d.day}:${i}`];
                          return (
                            <div key={i} className={`rounded-lg border p-3 ${r ? "border-emerald-200 bg-emerald-50/40" : "border-neutral-100"}`}>
                              <div className="flex items-start gap-2.5">
                                {r ? <CheckCircle2 className="w-4.5 h-4.5 w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-neutral-300 shrink-0" />}
                                <div className="min-w-0 flex-1">
                                  <p className={`text-xs ${r ? "text-neutral-500" : "text-ink font-medium"}`}>{task}</p>
                                  {r && (
                                    <div className="mt-1.5 rounded-md bg-white border border-emerald-100 p-2.5">
                                      <p className="text-xs text-neutral-600 whitespace-pre-wrap leading-relaxed">{r.feedback}</p>
                                      <p className="mt-1 text-[10px] font-bold text-neutral-400">
                                        {[
                                          r.contacted != null ? `contacted ${r.contacted}` : null,
                                          r.responses != null ? `responses ${r.responses}` : null,
                                          r.viewings != null ? `viewings ${r.viewings}` : null,
                                          fmtD(r.createdAt),
                                        ].filter(Boolean).join(" · ")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
