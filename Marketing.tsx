import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { fmtDate } from "@/lib/format";
import {
  Sparkles, FileText, Megaphone, MessageSquareHeart, Compass, Copy, Check,
  Trash2, Loader2, ChevronDown, ChevronUp, Wand2, Map, Wrench, Lock,
} from "lucide-react";
import MarketingPlan from "./MarketingPlan";

type Tool = "listing" | "script" | "followup" | "guide";

const TOOL_META: Record<Tool, { label: string; icon: typeof Sparkles; blurb: string }> = {
  guide: { label: "Daily Guide", icon: Compass, blurb: "Your AI marketing plan for today — focus, action, ready-to-post caption." },
  listing: { label: "Listing", icon: FileText, blurb: "A polished property listing description, ready to post anywhere." },
  script: { label: "Broadcast", icon: Megaphone, blurb: "A WhatsApp broadcast script for your contact list." },
  followup: { label: "Follow-up", icon: MessageSquareHeart, blurb: "A personal follow-up message that moves a client forward." },
};

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "urgent", label: "Urgent" },
  { value: "luxury", label: "Luxury" },
] as const;

const STAGES = [
  { value: "new_lead", label: "New lead — just enquired" },
  { value: "inspected", label: "Has inspected the property" },
  { value: "negotiating", label: "Negotiating price / terms" },
  { value: "payment_pending", label: "Agreed — payment pending" },
  { value: "after_sale", label: "Past client — after sale" },
] as const;

type Asset = {
  id: number;
  tool: string;
  title: string;
  content: string;
  createdAt: string | Date;
};

export default function Marketing() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.member.me.useQuery();
  const { data: products } = trpc.catalog.products.useQuery();
  const { data: usage } = trpc.ai.usage.useQuery();
  const { data: history, isLoading: histLoading } = trpc.ai.history.useQuery();

  const [tab, setTab] = useState<"plan" | "tools">("plan");
  const [tool, setTool] = useState<Tool>("guide");
  const [result, setResult] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | "new" | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<Tool | "all">("all");

  // form state
  const [productId, setProductId] = useState<number | "">("");
  const [brief, setBrief] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [clientName, setClientName] = useState("");
  const [stage, setStage] = useState<(typeof STAGES)[number]["value"]>("new_lead");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["value"]>("professional");
  const [focus, setFocus] = useState("");

  const generate = trpc.ai.generate.useMutation({
    onSuccess: (asset) => {
      setResult(asset as Asset);
      setError(null);
      utils.ai.history.invalidate();
      utils.ai.usage.invalidate();
    },
    onError: (e) => {
      setError(e.message);
      setResult(null);
    },
  });

  const remove = trpc.ai.remove.useMutation({
    onSuccess: () => utils.ai.history.invalidate(),
  });

  const todayGuide = useMemo(() => {
    if (!history) return null;
    const today = new Date().toDateString();
    return (history as Asset[]).find(
      (a) => a.tool === "guide" && new Date(a.createdAt).toDateString() === today
    ) ?? null;
  }, [history]);

  if (!me) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // The whole Marketing Studio is a Pro-and-above tool.
  if (me.category === "basic") {
    return (
      <div className="space-y-8">
        <div>
          <p className="kicker mb-2">Growth tools</p>
          <h1 className="text-3xl font-black text-ink flex items-center gap-3">
            Marketing Studio <Sparkles className="w-7 h-7 text-[#a8842b]" />
          </h1>
        </div>
        <div className="rounded-2xl bg-white border border-neutral-200 p-10 text-center max-w-xl mx-auto space-y-4">
          <span className="inline-flex w-14 h-14 rounded-2xl bg-ink items-center justify-center">
            <Lock className="w-7 h-7 text-[#e9dcbb]" />
          </span>
          <h2 className="text-xl font-black text-ink">A Pro membership unlocks the Marketing Studio</h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            The Marketing Studio — your 30-day step-by-step marketing plan, daily execution guides,
            and the listing / broadcast / follow-up writers — is available from the <strong>Pro</strong> seat and above.
            Upgrade your membership to unlock it.
          </p>
        </div>
      </div>
    );
  }

  const canGenerate = !generate.isPending && (usage ? usage.used < usage.limit : true);

  const run = () => {
    setError(null);
    const pid = productId === "" ? undefined : Number(productId);
    if (tool === "guide") generate.mutate({ tool, focus: focus.trim() || undefined, productId: pid });
    else if (tool === "listing") generate.mutate({ tool, productId: pid, brief: brief.trim() || undefined, tone });
    else if (tool === "script") {
      if (topic.trim().length < 3) { setError("Tell the AI what this broadcast is about first."); return; }
      generate.mutate({ tool, topic: topic.trim(), productId: pid, audience: audience.trim() || undefined, tone });
    } else {
      if (!clientName.trim()) { setError("Enter the client's name — the message is personal."); return; }
      generate.mutate({ tool, clientName: clientName.trim(), stage, context: context.trim() || undefined });
    }
  };

  const copy = async (id: number | "new", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = ((history ?? []) as Asset[]).filter((a) => filter === "all" || a.tool === filter);

  const inputCls =
    "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-[#a8842b] transition-colors";

  return (
    <div className="space-y-8">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Growth tools</p>
          <h1 className="text-3xl font-black text-ink flex items-center gap-3">
            Marketing Studio <Sparkles className="w-7 h-7 text-[#a8842b]" />
          </h1>
          <p className="text-neutral-500 mt-1">
            Your personal AI marketer — listings, broadcasts, follow-ups and a daily action plan, written in the Club 10 voice.
          </p>
        </div>
        {usage && (
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm">
            <span className="font-black text-ink">{usage.limit - usage.used}</span>
            <span className="text-neutral-500"> of {usage.limit} generations left today</span>
          </div>
        )}
      </div>

      {me.status !== "active" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          The Marketing Studio unlocks once your membership is approved and active. You can explore the tools below, but generation is disabled for now.
        </div>
      )}

      {/* studio tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("plan")}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-colors ${
            tab === "plan" ? "bg-ink text-white" : "bg-white border border-neutral-200 text-neutral-500 hover:text-ink"
          }`}
        >
          <Map className="w-4 h-4" /> 30-Day Plan
        </button>
        <button
          onClick={() => setTab("tools")}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-colors ${
            tab === "tools" ? "bg-ink text-white" : "bg-white border border-neutral-200 text-neutral-500 hover:text-ink"
          }`}
        >
          <Wrench className="w-4 h-4" /> Quick tools
        </button>
      </div>

      {tab === "plan" && <MarketingPlan />}

      {tab === "tools" && (<>

      {/* tool picker */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(TOOL_META) as Tool[]).map((t) => {
          const M = TOOL_META[t];
          const active = tool === t;
          return (
            <button
              key={t}
              onClick={() => { setTool(t); setError(null); }}
              className={`rounded-2xl border p-4 text-left transition-all ${
                active
                  ? "border-[#a8842b] bg-ink text-white night-glow"
                  : "border-neutral-200 bg-white hover:border-[#a8842b]/50"
              }`}
            >
              <M.icon className={`w-5 h-5 mb-2 ${active ? "text-[#e9dcbb]" : "text-[#a8842b]"}`} />
              <p className={`font-black text-sm ${active ? "text-white" : "text-ink"}`}>{M.label}</p>
              <p className={`text-xs mt-1 leading-snug ${active ? "text-white/60" : "text-neutral-400"}`}>{M.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* builder */}
      <div className="rounded-2xl bg-white border border-neutral-200 p-6 sm:p-8 space-y-5">
        <h2 className="font-black text-ink text-lg flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-[#a8842b]" />
          {TOOL_META[tool].label} builder
        </h2>

        {tool === "guide" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Product you're pushing <span className="text-neutral-300 normal-case font-medium">(optional — the whole guide is built around it)</span>
              </label>
              <select
                className={inputCls}
                value={productId}
                onChange={(e) => setProductId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">— General marketing day —</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.location ? `· ${p.location}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {todayGuide && (
              <div className="rounded-xl bg-[#faf6ec] border border-[#e9dcbb] px-4 py-3 text-sm text-ink">
                Today's guide is already in your library below — you can regenerate a fresh angle if you want one.
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Focus for today <span className="text-neutral-300 normal-case font-medium">(optional)</span>
              </label>
              <input
                className={inputCls}
                placeholder='e.g. "follow up with weekend inspection clients" or "push the Lekki plots"'
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                maxLength={300}
              />
            </div>
          </div>
        )}

        {(tool === "listing" || tool === "script") && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Property <span className="text-neutral-300 normal-case font-medium">(optional — from the live catalog)</span>
              </label>
              <select
                className={inputCls}
                value={productId}
                onChange={(e) => setProductId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">— No specific property —</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.location ? `· ${p.location}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Tone</label>
              <select className={inputCls} value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tool === "listing" && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
              Your brief <span className="text-neutral-300 normal-case font-medium">(optional details to weave in)</span>
            </label>
            <textarea
              className={`${inputCls} min-h-[110px]`}
              placeholder="e.g. corner plot, 5 mins from the expressway, flexible payment plan — mention December promo"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={2000}
            />
          </div>
        )}

        {tool === "script" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                What is this broadcast about? <span className="text-red-400">*</span>
              </label>
              <input
                className={inputCls}
                placeholder="e.g. new plots opened in Epe with launch pricing this week"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Audience <span className="text-neutral-300 normal-case font-medium">(optional)</span>
              </label>
              <input
                className={inputCls}
                placeholder="e.g. past clients, church group, warm leads from last month"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
        )}

        {tool === "followup" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Client name <span className="text-red-400">*</span>
              </label>
              <input
                className={inputCls}
                placeholder="e.g. Mrs. Adebayo"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Where are they?</label>
              <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Context <span className="text-neutral-300 normal-case font-medium">(optional)</span>
              </label>
              <textarea
                className={`${inputCls} min-h-[90px]`}
                placeholder="e.g. she inspected the Sangotedo plot on Saturday, liked it but worried about documentation"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                maxLength={1500}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={run}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generate.isPending ? "Writing…" : `Generate ${TOOL_META[tool].label.toLowerCase()}`}
        </button>
      </div>

      {/* fresh result */}
      {result && (
        <div className="rounded-2xl bg-ink night-glow p-6 sm:p-8 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b]">Fresh from your AI</p>
              <h3 className="font-black text-lg mt-1">{result.title}</h3>
            </div>
            <button
              onClick={() => copy("new", result.content)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
            >
              {copiedId === "new" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedId === "new" ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/90 bg-white/5 border border-white/10 rounded-xl p-5">
            {result.content}
          </pre>
          <p className="mt-3 text-xs text-white/40">Saved to your library below — it stays available even after you close this page.</p>
        </div>
      )}

      {/* library */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-black text-ink">Your saved library</h2>
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "guide", "listing", "script", "followup"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === f ? "bg-ink text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
              >
                {f === "all" ? "All" : TOOL_META[f].label}
              </button>
            ))}
          </div>
        </div>

        {histLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">
            Nothing saved yet — generate your first {filter === "all" ? "asset" : TOOL_META[filter].label.toLowerCase()} above.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((a) => {
              const M = TOOL_META[a.tool as Tool] ?? TOOL_META.listing;
              const open = expanded === a.id;
              return (
                <li key={a.id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 w-9 h-9 rounded-xl bg-[#faf6ec] border border-[#e9dcbb] flex items-center justify-center">
                      <M.icon className="w-4 h-4 text-[#a8842b]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-ink truncate">{a.title}</p>
                      <p className="text-xs text-neutral-400">{M.label} · {fmtDate(a.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => copy(a.id, a.content)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-[#a8842b] hover:bg-neutral-50"
                      title="Copy"
                    >
                      {copiedId === a.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setExpanded(open ? null : a.id)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-ink hover:bg-neutral-50"
                      title={open ? "Collapse" : "View"}
                    >
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this saved asset?")) remove.mutate({ id: a.id }); }}
                      className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {open && (
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-xl p-4">
                      {a.content}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </>)}
    </div>
  );
}
