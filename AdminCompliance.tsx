import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { fmtDate } from "@/lib/format";
import { ClipboardCheck, Download, BellRing, Search } from "lucide-react";

const PLAN_BADGE: Record<string, string> = {
  basic: "bg-neutral-100 text-neutral-600",
  pro: "bg-blue-50 text-blue-700",
  elite: "bg-purple-50 text-purple-700",
  executive: "bg-amber-50 text-amber-700",
};

export default function AdminCompliance() {
  const utils = trpc.useUtils();
  const [courseId, setCourseId] = useState<string>("");
  const [planCode, setPlanCode] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");

  const { data: plans } = trpc.admin.plansList.useQuery();
  const { data, isLoading } = trpc.admin.trainingCompliance.useQuery({
    courseId: courseId ? Number(courseId) : undefined,
    planCode: planCode || undefined,
    search: search || undefined,
  });
  const remind = trpc.admin.remindTraining.useMutation({
    onSuccess: () => utils.admin.trainingCompliance.invalidate(),
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (!stage) return all;
    return all.filter((r) => {
      if (stage === "not_started") return r.lessonsDone === 0 && r.attempts === 0;
      if (stage === "in_progress") return (r.lessonsDone > 0 || r.attempts > 0) && !r.passed;
      if (stage === "passed") return r.passed;
      if (stage === "certified") return r.certificates.length > 0;
      return true;
    });
  }, [data, stage]);

  const exportCsv = () => {
    const head = ["Realtor", "Code", "Plan", "Status", "Lessons done", "Lessons total", "Progress %", "Exam attempts", "Best score", "Exam passed", "Certificates", "Last activity"];
    const lines = rows.map((r) =>
      [
        `${r.member.firstName} ${r.member.lastName}`,
        r.member.membershipCode,
        r.member.category,
        r.member.status,
        r.lessonsDone,
        r.lessonsTotal,
        r.pct,
        r.attempts,
        r.bestScore ?? "",
        r.passed ? "yes" : "no",
        r.certificates.map((c) => c.verificationCode).join(" | "),
        r.lastActivity ? fmtDate(r.lastActivity) : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `training-compliance${courseId ? "-course-" + courseId : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const summary = data?.summary;
  const sel = "rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Admin</p>
          <h1 className="text-3xl font-black text-ink flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-[#a8842b]" /> Training Compliance
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Confirm realtors are following through with the training — per course, per plan, per person.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-300 bg-white font-bold text-sm text-ink hover:bg-neutral-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* summary cards — clickable stage filters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: "", label: "All realtors", value: summary?.realtors ?? 0 },
          { key: "not_started", label: "Not started", value: summary?.notStarted ?? 0 },
          { key: "in_progress", label: "In progress", value: summary?.inProgress ?? 0 },
          { key: "passed", label: "Exam passed", value: summary?.examPassed ?? 0 },
        ].map((c) => (
          <button
            key={c.key}
            onClick={() => setStage(c.key)}
            className={`rounded-2xl border p-4 text-left transition ${
              stage === c.key ? "border-[#a8842b] bg-[#e9dcbb]/30" : "border-neutral-200 bg-white hover:bg-neutral-50"
            }`}
          >
            <p className="text-2xl font-black text-ink">{c.value}</p>
            <p className="text-xs font-black uppercase tracking-wider text-neutral-400">{c.label}</p>
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-2.5 items-center">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={sel}>
          <option value="">All courses (combined)</option>
          {(data?.courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title} ({c.lessonCount} lessons{c.passMark ? ` · pass ${c.passMark}%` : ""})
            </option>
          ))}
        </select>
        <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={sel}>
          <option value="">All plans</option>
          {(plans ?? []).map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or code…"
            className={`${sel} pl-9`}
          />
        </div>
        {(courseId || planCode || search || stage) && (
          <button
            onClick={() => { setCourseId(""); setPlanCode(""); setSearch(""); setStage(""); }}
            className="rounded-full border border-[#a8842b]/40 px-3.5 py-2 text-xs font-bold text-[#7c6117] hover:bg-[#e9dcbb]/40"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs font-bold text-neutral-400">
          {rows.length} realtor{rows.length === 1 ? "" : "s"}
          {data && !courseId ? ` · ${data.lessonsTotal} lessons across all courses` : ""}
        </span>
      </div>

      {/* table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No realtors match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Realtor</th>
                  <th className="px-5 py-3">Lessons</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3">Exam</th>
                  <th className="px-5 py-3">Certificate</th>
                  <th className="px-5 py-3">Last activity</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => (
                  <tr key={r.member.id} className="hover:bg-neutral-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink">{r.member.firstName} {r.member.lastName}</p>
                      <p className="text-xs text-neutral-400">
                        {r.member.membershipCode}{" "}
                        <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${PLAN_BADGE[r.member.category] ?? "bg-neutral-100 text-neutral-600"}`}>
                          {r.member.category}
                        </span>{" "}
                        <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${r.member.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {r.member.status}
                        </span>
                      </p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-neutral-600">
                      {r.lessonsDone} / {r.lessonsTotal}
                    </td>
                    <td className="px-5 py-3.5 w-44">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.pct === 100 ? "bg-emerald-500" : "gold-bg-grad"}`}
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-ink w-9 text-right">{r.pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {r.attempts === 0 ? (
                        <span className="text-xs text-neutral-400">Not taken</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${r.passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                          {r.passed ? "Passed" : "Failed"} · best {r.bestScore}%{r.attempts > 1 ? ` · ${r.attempts} tries` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.certificates.length === 0 ? (
                        <span className="text-xs text-neutral-400">—</span>
                      ) : (
                        <span className="text-xs font-bold text-[#7c6117]">
                          {r.certificates.map((c) => c.verificationCode).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-neutral-500 text-xs">
                      {r.lastActivity ? fmtDate(r.lastActivity) : "Never"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {!r.passed && (
                        <button
                          onClick={() => remind.mutate({ memberId: r.member.id, courseId: courseId ? Number(courseId) : undefined })}
                          disabled={remind.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#a8842b]/40 px-3 py-1.5 text-xs font-bold text-[#7c6117] hover:bg-[#e9dcbb]/40 disabled:opacity-60"
                          title="Send an in-app training reminder"
                        >
                          <BellRing className="w-3.5 h-3.5" /> Remind
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
    </div>
  );
}
