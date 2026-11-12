import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  CalendarRange, Check, CheckCircle2, ChevronDown, ChevronUp, Circle, ClipboardList,
  Copy, Loader2, Map, Sparkles, Target, Trophy, Undo2, Wand2,
} from "lucide-react";

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

type PlanData = {
  plan: { id: number; title: string; goal: string | null; status: string; createdAt: string | Date };
  product: { id: number; name: string; location: string | null } | null;
  days: { id: number; day: number; title: string; tasks: string[]; hasGuide: boolean }[];
  reports: Report[];
  stats: { totalTasks: number; doneTasks: number; percent: number };
  currentDay: number;
};

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-[#a8842b] transition-colors";

export default function MarketingPlan() {
  const utils = trpc.useUtils();
  const { data: products } = trpc.catalog.products.useQuery();
  const { data, isLoading } = trpc.aiPlan.mine.useQuery();
  const plan = (data ?? null) as PlanData | null;

  const [productId, setProductId] = useState<number | "">("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [reportFor, setReportFor] = useState<{ day: number; taskIndex: number; task: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [contacted, setContacted] = useState("");
  const [responses, setResponses] = useState("");
  const [viewings, setViewings] = useState("");
  const [guideFor, setGuideFor] = useState<number | null>(null);
  const [guides, setGuides] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);

  const create = trpc.aiPlan.create.useMutation({
    onSuccess: () => {
      setError(null);
      utils.aiPlan.mine.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const report = trpc.aiPlan.reportTask.useMutation({
    onSuccess: () => {
      setReportFor(null);
      setFeedback(""); setContacted(""); setResponses(""); setViewings("");
      utils.aiPlan.mine.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const unreport = trpc.aiPlan.unreportTask.useMutation({
    onSuccess: () => utils.aiPlan.mine.invalidate(),
  });

  const dayGuide = trpc.aiPlan.dayGuide.useMutation({
    onSuccess: (r) => {
      setGuides((g) => ({ ...g, [r.day]: r.guide }));
      setGuideFor(r.day);
    },
    onError: (e) => setError(e.message),
  });

  const reportMap = useMemo(() => {
    const m: Record<string, Report> = {};
    for (const r of plan?.reports ?? []) m[`${r.day}:${r.taskIndex}`] = r;
    return m;
  }, [plan]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-[#a8842b]" />
      </div>
    );
  }

  /* ------------------------- no plan yet — create ------------------------- */
  if (!plan) {
    return (
      <div className="rounded-2xl bg-white border border-neutral-200 p-6 sm:p-10">
        <div className="max-w-xl mx-auto text-center space-y-5">
          <span className="inline-flex w-14 h-14 rounded-2xl gold-bg-grad items-center justify-center">
            <Map className="w-7 h-7 text-white" />
          </span>
          <h2 className="text-2xl font-black text-ink">Build your 30-day marketing plan</h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            The AI maps out your next 30 days — real tasks for every single day, a daily execution guide,
            and a progress tracker. You tick each task off by reporting back how it went, and watch your
            percentage climb.
          </p>
          <div className="text-left space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Property to push <span className="text-neutral-300 normal-case font-medium">(optional — plan is built around it)</span>
              </label>
              <select className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">— General client-acquisition plan —</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.location ? `· ${p.location}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Your goal for the 30 days <span className="text-neutral-300 normal-case font-medium">(optional)</span>
              </label>
              <input
                className={inputCls}
                placeholder='e.g. "close 2 plots" or "book 10 inspections"'
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={300}
              />
            </div>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button
              onClick={() => { setError(null); create.mutate({ productId: productId === "" ? undefined : Number(productId), goal: goal.trim() || undefined }); }}
              disabled={create.isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {create.isPending ? "The AI is mapping your 30 days…" : "Build my 30-day plan"}
            </button>
            {create.isPending && (
              <p className="text-center text-xs text-neutral-400">This takes about 20 seconds — the AI is writing all 30 days.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ active plan ----------------------------- */
  const { stats } = plan;
  const done = plan.plan.status === "completed";
  const expanded = expandedDay ?? plan.currentDay;

  const openReport = (day: number, taskIndex: number, task: string) => {
    const existing = reportMap[`${day}:${taskIndex}`];
    setReportFor({ day, taskIndex, task });
    setFeedback(existing?.feedback ?? "");
    setContacted(existing?.contacted != null ? String(existing.contacted) : "");
    setResponses(existing?.responses != null ? String(existing.responses) : "");
    setViewings(existing?.viewings != null ? String(existing.viewings) : "");
    setError(null);
  };

  const copyGuide = async (day: number) => {
    await navigator.clipboard.writeText(guides[day] ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* progress header */}
      <div className={`rounded-2xl p-6 sm:p-8 text-white ${done ? "bg-emerald-900" : "bg-ink night-glow"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b] flex items-center gap-2">
              <CalendarRange className="w-4 h-4" /> Your 30-day plan
            </p>
            <h2 className="font-black text-xl mt-2">{plan.plan.title}</h2>
            {plan.plan.goal && (
              <p className="text-sm text-white/60 mt-1 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Goal: {plan.plan.goal}
              </p>
            )}
          </div>
          <div className="text-right">
            {done ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-4 py-2 text-sm font-black text-emerald-300">
                <Trophy className="w-4 h-4" /> Plan completed!
              </p>
            ) : (
              <p className="text-sm text-white/60">Day <span className="font-black text-white">{plan.currentDay}</span> of 30</p>
            )}
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-white/70">{stats.doneTasks} of {stats.totalTasks} tasks reported</span>
            <span className="text-[#e9dcbb] text-base font-black">{stats.percent}%</span>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${done ? "bg-emerald-400" : "gold-bg-grad"}`}
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* days */}
      <div className="space-y-3">
        {plan.days.map((d) => {
          const dayReports = d.tasks.map((_, i) => reportMap[`${d.day}:${i}`]);
          const doneCount = dayReports.filter(Boolean).length;
          const allDone = doneCount === d.tasks.length;
          const open = expanded === d.day;
          const isToday = d.day === plan.currentDay && !done;
          return (
            <div
              key={d.id}
              className={`rounded-2xl border bg-white overflow-hidden transition-colors ${
                isToday ? "border-[#a8842b] shadow-md" : allDone ? "border-emerald-200" : "border-neutral-200"
              }`}
            >
              <button
                onClick={() => setExpandedDay(open ? null : d.day)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <span
                  className={`shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black ${
                    allDone ? "bg-emerald-100 text-emerald-700" : isToday ? "gold-bg-grad text-white" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  <span className="text-[9px] uppercase leading-none">Day</span>
                  <span className="text-base leading-tight">{d.day}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-ink truncate">
                    {d.title}
                    {isToday && <span className="ml-2 rounded-full bg-[#faf6ec] border border-[#e9dcbb] px-2 py-0.5 text-[10px] font-black uppercase text-[#7c6117]">Today</span>}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {doneCount}/{d.tasks.length} tasks reported
                  </p>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </button>

              {open && (
                <div className="border-t border-neutral-100 px-5 py-4 space-y-3">
                  {d.tasks.map((task, i) => {
                    const r = dayReports[i];
                    const taskOpen = reportFor?.day === d.day && reportFor?.taskIndex === i;
                    return (
                      <div key={i} className={`rounded-xl border p-4 ${r ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200"}`}>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => openReport(d.day, i, task)}
                            className="mt-0.5 shrink-0"
                            title={r ? "Edit your report" : "Report & tick done"}
                          >
                            {r ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <Circle className="w-6 h-6 text-neutral-300 hover:text-[#a8842b]" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${r ? "text-neutral-500 line-through decoration-emerald-400/60" : "text-ink font-medium"}`}>{task}</p>
                            {r && !taskOpen && (
                              <div className="mt-2 rounded-lg bg-white border border-emerald-100 p-3">
                                <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-wrap">{r.feedback}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-neutral-400">
                                  {r.contacted != null && <span>Contacted: {r.contacted}</span>}
                                  {r.responses != null && <span>Responses: {r.responses}</span>}
                                  {r.viewings != null && <span>Viewings: {r.viewings}</span>}
                                  <span>{new Date(r.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                                  <button
                                    onClick={() => { if (confirm("Untick this task? Its report will be removed.")) unreport.mutate({ day: d.day, taskIndex: i }); }}
                                    className="inline-flex items-center gap-1 text-neutral-400 hover:text-red-500"
                                  >
                                    <Undo2 className="w-3 h-3" /> Undo
                                  </button>
                                </div>
                              </div>
                            )}
                            {!r && !taskOpen && (
                              <button
                                onClick={() => openReport(d.day, i, task)}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#a8842b]/40 px-3 py-1.5 text-xs font-bold text-[#7c6117] hover:bg-[#faf6ec]"
                              >
                                <ClipboardList className="w-3.5 h-3.5" /> Report & tick done
                              </button>
                            )}
                            {taskOpen && (
                              <div className="mt-3 space-y-3 rounded-lg bg-[#faf6ec]/60 border border-[#e9dcbb] p-4">
                                <div>
                                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                    How did it go? <span className="text-red-400">*</span>
                                    <span className="text-neutral-400 normal-case font-medium"> — your report is required to tick this task</span>
                                  </label>
                                  <textarea
                                    rows={3}
                                    className={inputCls}
                                    placeholder="e.g. Sent the message to 15 contacts — 4 replied, one wants to inspect on Saturday…"
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    maxLength={2000}
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <label className="block">
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Contacted</span>
                                    <input inputMode="numeric" className={inputCls} placeholder="0" value={contacted} onChange={(e) => setContacted(e.target.value.replace(/\D/g, ""))} />
                                  </label>
                                  <label className="block">
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Responses</span>
                                    <input inputMode="numeric" className={inputCls} placeholder="0" value={responses} onChange={(e) => setResponses(e.target.value.replace(/\D/g, ""))} />
                                  </label>
                                  <label className="block">
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Viewings</span>
                                    <input inputMode="numeric" className={inputCls} placeholder="0" value={viewings} onChange={(e) => setViewings(e.target.value.replace(/\D/g, ""))} />
                                  </label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      if (feedback.trim().length < 10) { setError("Give a short report on how it went (at least a sentence) before ticking done."); return; }
                                      setError(null);
                                      report.mutate({
                                        day: d.day,
                                        taskIndex: i,
                                        feedback: feedback.trim(),
                                        contacted: contacted ? Number(contacted) : undefined,
                                        responses: responses ? Number(responses) : undefined,
                                        viewings: viewings ? Number(viewings) : undefined,
                                      });
                                    }}
                                    disabled={report.isPending}
                                    className="inline-flex items-center gap-2 rounded-lg gold-bg-grad px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                                  >
                                    {report.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    {r ? "Update report" : "Submit report & mark done"}
                                  </button>
                                  <button onClick={() => setReportFor(null)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-500">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* day guide */}
                  <div className="pt-1">
                    {guides[d.day] ? (
                      <div className="rounded-xl bg-ink night-glow p-5 text-white">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b]">Day {d.day} execution guide</p>
                          <button onClick={() => copyGuide(d.day)} className="inline-flex items-center gap-1.5 rounded-lg gold-bg-grad px-3 py-1.5 text-xs font-bold text-white">
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/90">{guides[d.day]}</pre>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setError(null); dayGuide.mutate({ day: d.day }); }}
                        disabled={dayGuide.isPending}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#a8842b]/40 px-4 py-2.5 text-xs font-bold text-[#7c6117] hover:bg-[#faf6ec] disabled:opacity-60"
                      >
                        {dayGuide.isPending && guideFor !== d.day ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        {dayGuide.isPending ? "Writing your guide…" : d.hasGuide ? "View this day's AI guide" : "Generate this day's AI guide"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
