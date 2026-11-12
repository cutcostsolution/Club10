import { useMemo, useState } from "react";
import { Calculator, ArrowUpCircle, Sparkles, Trophy, Wand2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { naira, points as fmtPoints } from "@/lib/format";

/**
 * Live target calculator — plan-aware and intelligent. Two modes:
 *  1. Money target (₦) → the calculator WORKS OUT the route: how many recruits
 *     per plan, how much in own sales, and the team-sales level needed — all
 *     from the admin-configured engine (registration %, plan fees, category
 *     commission averages, chain split).
 *  2. Points target → how to get there from the live point rules (recruits,
 *     commissions, lessons, exams) with the member's plan multiplier applied.
 *
 * The sliders are the plan itself: whatever you commit with them is counted
 * toward the target, and the "Suggested route" instantly re-plans only the
 * REMAINING gap. "Apply this route" loads the suggestion into the sliders so
 * you can watch the plan close to 100% — then reshape any lever by hand.
 */
export function TargetCalculator() {
  const { data: me } = trpc.member.me.useQuery();
  const { data: plans } = trpc.member.plans.useQuery();
  const [mode, setMode] = useState<"money" | "points">("money");
  const [target, setTarget] = useState(5_000_000);
  const [pointsTarget, setPointsTarget] = useState(5_000);
  const [recruits, setRecruits] = useState<Record<string, number>>({});
  const [salesVol, setSalesVol] = useState(0);
  const [teamVol, setTeamVol] = useState(0);

  const paidPlans = useMemo(() => (plans ?? []).filter((p) => p.fee > 0), [plans]);
  const engine = me?.engine;

  const regPct = engine?.regPct ?? 30;
  const chainSplit = useMemo(() => engine?.chainSplit ?? [], [engine]);
  const chainDepth = me?.plan?.chainDepth ?? 0;
  const pointsEligible = me?.plan?.pointsEligible ?? false;
  const mult = parseFloat(me?.plan?.pointsMultiplier ?? "1") || 1;
  const AVG_PCT = engine?.avgSalesPct ?? 10;
  const rules = engine?.pointRules ?? { recruit: 150, commissionPer1m: 400, lesson: 25, exam: 300, linkClick: 1 };

  const perRecruit = (fee: number) => Math.round((fee * regPct) / 100);

  /* ---------------- money mode — live projection from the sliders ---------------- */
  const recruitIncome = paidPlans.reduce((s, p) => s + (recruits[p.code] ?? 0) * perRecruit(p.fee), 0);
  const salesIncome = Math.round((salesVol * AVG_PCT) / 100);
  const teamIncome =
    chainDepth > 0 ? Math.round((((teamVol * AVG_PCT) / 100) * (chainSplit[0] ?? 0)) / 100) : 0;
  const projected = recruitIncome + salesIncome + teamIncome;
  const progress = target > 0 ? Math.min(projected / target, 1) : 0;
  const shortfall = Math.max(target - projected, 0);

  /* ---------------- money mode — the intelligent suggested route ----------------
   * Plans ONLY the gap your sliders have not covered yet. Move any slider and
   * the route shrinks around your commitment in real time. Split of the gap:
   * recruits 50% · own sales 30% · team sales 20% (team share folds into own
   * sales when the plan has no chain). */
  const suggestion = useMemo(() => {
    const gap = Math.max(target - projected, 0);
    if (gap <= 0 || paidPlans.length === 0) return null;
    const hasChain = chainDepth > 0;
    const recruitShare = hasChain ? 0.5 : 0.6;
    const salesShare = hasChain ? 0.3 : 0.4;
    const teamShare = hasChain ? 0.2 : 0;

    const recruitTarget = Math.round(gap * recruitShare);
    const salesTargetN = Math.round(gap * salesShare);
    const teamTargetN = Math.round(gap * teamShare);

    const sorted = [...paidPlans].sort((a, b) => a.fee - b.fee);
    const per = sorted.map((p) => ({ plan: p, each: Math.max(perRecruit(p.fee), 1) }));
    const mix: Array<{ code: string; name: string; count: number; income: number }> = [];
    let remaining = recruitTarget;
    // greedy from the TOP plan down for a fast route, but cap so it stays human
    const topDown = [...per].reverse();
    for (const tier of topDown) {
      if (remaining <= 0) break;
      const maxHere = tier.plan.fee >= 1_000_000 ? 5 : tier.plan.fee >= 250_000 ? 10 : 99;
      const n = Math.min(Math.ceil(remaining / tier.each), maxHere);
      if (n > 0) {
        mix.push({ code: tier.plan.code, name: tier.plan.name, count: n, income: n * tier.each });
        remaining -= n * tier.each;
      }
    }
    if (remaining > 0 && per.length) {
      const cheapest = per[0];
      const n = Math.ceil(remaining / cheapest.each);
      const existing = mix.find((m) => m.code === cheapest.plan.code);
      if (existing) { existing.count += n; existing.income += n * cheapest.each; }
      else mix.push({ code: cheapest.plan.code, name: cheapest.plan.name, count: n, income: n * cheapest.each });
    }

    const ownSalesVol = Math.ceil(salesTargetN / (AVG_PCT / 100));
    const teamSalesVol = hasChain ? Math.ceil(teamTargetN / ((AVG_PCT / 100) * ((chainSplit[0] ?? 0) / 100))) : 0;
    const covered = mix.reduce((s, m) => s + m.income, 0) + salesTargetN + (hasChain ? teamTargetN : 0);
    return { gap, mix, ownSalesVol, teamSalesVol, salesTargetN, teamTargetN, covered, hasChain };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, projected, paidPlans, chainDepth, regPct, AVG_PCT, chainSplit[0]]);

  /** Load the suggested route into the sliders — the plan becomes editable. */
  const applySuggestion = () => {
    if (!suggestion) return;
    setRecruits((r) => {
      const next = { ...r };
      for (const m of suggestion.mix) next[m.code] = (next[m.code] ?? 0) + m.count;
      return next;
    });
    setSalesVol((v) => v + suggestion.ownSalesVol);
    setTeamVol((v) => v + suggestion.teamSalesVol);
  };

  const resetSliders = () => {
    setRecruits({});
    setSalesVol(0);
    setTeamVol(0);
  };

  /* ---------------- points mode — intelligent route to a points target ---------------- */
  const pointsSuggestion = useMemo(() => {
    if (!pointsEligible || pointsTarget <= 0) return null;
    const perRecruitPts = Math.round(rules.recruit * mult);
    const perLessonPts = Math.round(rules.lesson * mult);
    const perExamPts = Math.round(rules.exam * mult);
    // split: recruits 50% · sales commissions 30% · academy 20%
    const recruitTarget = Math.round(pointsTarget * 0.5);
    const salesTargetPts = Math.round(pointsTarget * 0.3);
    const academyTarget = pointsTarget - recruitTarget - salesTargetPts;
    const recruitsNeeded = perRecruitPts > 0 ? Math.ceil(recruitTarget / perRecruitPts) : 0;
    // points per ₦1m of YOUR commission → commission ₦ needed → sales volume at avg %
    const commissionNeeded = rules.commissionPer1m > 0 ? (salesTargetPts / (rules.commissionPer1m * mult)) * 1_000_000 : 0;
    const salesVolNeeded = Math.ceil(commissionNeeded / (AVG_PCT / 100));
    const exams = perExamPts > 0 ? Math.floor(academyTarget / perExamPts) : 0;
    const lessons = perLessonPts > 0 ? Math.ceil((academyTarget - exams * perExamPts) / perLessonPts) : 0;
    return { recruitsNeeded, perRecruitPts, salesVolNeeded, salesTargetPts, exams, lessons, perExamPts, perLessonPts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsTarget, pointsEligible, mult, rules.recruit, rules.commissionPer1m, rules.lesson, rules.exam, AVG_PCT]);

  if (!me || !engine) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl gold-bg-grad">
          <Calculator className="h-5 w-5 text-ink" />
        </span>
        <div>
          <h3 className="font-bold text-ink">Target calculator</h3>
          <p className="text-xs text-muted-foreground">
            Tell it where you're going — it works out the route from the live engine rates.
          </p>
        </div>
      </div>

      {/* mode switch */}
      <div className="mt-4 flex gap-2 rounded-full bg-muted p-1">
        <button
          onClick={() => setMode("money")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${mode === "money" ? "gold-bg-grad text-ink" : "text-muted-foreground hover:text-ink"}`}
        >
          <Calculator className="h-3.5 w-3.5" /> Money target (₦)
        </button>
        <button
          onClick={() => setMode("points")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${mode === "points" ? "gold-bg-grad text-ink" : "text-muted-foreground hover:text-ink"}`}
        >
          <Trophy className="h-3.5 w-3.5" /> Points target
        </button>
      </div>

      {mode === "money" ? (
        <>
          {/* target input */}
          <div className="mt-5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              My financial target (₦)
            </label>
            <input
              type="number"
              min={0}
              step={100000}
              value={target}
              onChange={(e) => setTarget(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-lg font-extrabold text-ink focus:border-gold focus:outline-none"
            />
          </div>

          {/* intelligent route — plans whatever gap the sliders leave open */}
          {suggestion ? (
            <div className="mt-4 rounded-2xl border border-gold-soft bg-champagne/40 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold-deep">
                <Sparkles className="h-3.5 w-3.5" />
                {suggestion.gap >= target
                  ? `Suggested route to ${naira(target)}`
                  : `Suggested route for the remaining ${naira(suggestion.gap)}`}
              </p>
              <ul className="mt-2.5 space-y-1.5 text-sm text-ink">
                {suggestion.mix.map((m) => (
                  <li key={m.code} className="flex justify-between gap-3">
                    <span>
                      <b>{m.count}</b> {m.name} recruit{m.count === 1 ? "" : "s"}
                    </span>
                    <span className="font-bold text-gold-deep">{naira(m.income)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3">
                  <span>
                    Sell <b>{naira(suggestion.ownSalesVol)}</b> of property yourself
                  </span>
                  <span className="font-bold text-gold-deep">≈ {naira(suggestion.salesTargetN)}</span>
                </li>
                {suggestion.hasChain && (
                  <li className="flex justify-between gap-3">
                    <span>
                      Team sells <b>{naira(suggestion.teamSalesVol)}</b> (level-1 bonus)
                    </span>
                    <span className="font-bold text-gold-deep">≈ {naira(suggestion.teamTargetN)}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2.5 border-t border-gold-soft/60 pt-2 text-[11px] text-muted-foreground">
                Covers ≈ {naira(suggestion.covered)} at today's rates — recruits pay {regPct}% of plan fees,
                sales pay an average {AVG_PCT}%{suggestion.hasChain ? `, and level-1 team sales pay you ${chainSplit[0] ?? 0}% of their commission` : ""}.
              </p>
              <button
                onClick={applySuggestion}
                className="gold-bg-grad mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-ink transition hover:opacity-90"
              >
                <Wand2 className="h-3.5 w-3.5" /> Apply this route to my plan below
              </button>
            </div>
          ) : (
            projected > 0 && (
              <div className="mt-4 rounded-2xl border border-emerald-brand/40 bg-emerald-brand/10 p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-brand">
                  <Sparkles className="h-3.5 w-3.5" /> Target fully planned
                </p>
                <p className="mt-1.5 text-sm text-ink">
                  Your slider plan already covers <b>{naira(target)}</b>. Raise the target to dream bigger, or{" "}
                  <button onClick={resetSliders} className="font-bold text-emerald-brand underline underline-offset-2">
                    start a fresh plan
                  </button>
                  .
                </p>
              </div>
            )
          )}

          {/* levers — the plan itself; the route above re-plans around them live */}
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Your plan — drag to commit, the route adjusts
              </p>
              {(projected > 0) && (
                <button onClick={resetSliders} className="text-[10px] font-bold text-muted-foreground underline underline-offset-2 hover:text-ink">
                  Reset
                </button>
              )}
            </div>
            {paidPlans.map((p) => (
              <Slider
                key={p.code}
                label={`Recruit ${p.name} members`}
                hint={`${naira(perRecruit(p.fee))} each (${regPct}% of ${naira(p.fee)})`}
                value={recruits[p.code] ?? 0}
                max={Math.max(50, recruits[p.code] ?? 0)}
                step={1}
                onChange={(v) => setRecruits((r) => ({ ...r, [p.code]: v }))}
                fmt={(v) => `${v}`}
              />
            ))}
            <Slider
              label="Your own product sales"
              hint={`avg ${AVG_PCT}% commission across the catalogue`}
              value={salesVol}
              max={Math.max(20_000_000, target, salesVol)}
              step={250_000}
              onChange={setSalesVol}
              fmt={(v) => naira(v)}
            />
            {chainDepth > 0 && (
              <Slider
                label="Team sales one level below you"
                hint={`level-1 split pays you ${chainSplit[0] ?? 0}% of their commission — you earn from ${chainDepth} level${chainDepth === 1 ? "" : "s"}`}
                value={teamVol}
                max={Math.max(20_000_000, target, teamVol)}
                step={250_000}
                onChange={setTeamVol}
                fmt={(v) => naira(v)}
              />
            )}
          </div>

          {/* projection */}
          <div className="mt-6 rounded-2xl bg-ink p-5 text-ivory night-glow">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ivory/50">Your plan projects</p>
                <p className="mt-1 text-2xl font-black text-[#e9dcbb]">{naira(projected)}</p>
              </div>
              <p className="text-right text-xs text-ivory/60">
                target {naira(target)}
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progress >= 1 ? "bg-emerald-400" : "gold-bg-grad"}`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-ivory/60">
              {shortfall === 0
                ? "Target hit on this plan — set it higher and keep going."
                : `${naira(shortfall)} still open — drag the levers or apply the suggested route above.`}
            </p>
          </div>

          {chainDepth === 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-gold-soft bg-champagne/50 p-3 text-xs text-neutral-700">
              <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
              Your {me.plan?.name ?? "Basic"} seat earns direct commissions only. Upgrade to earn chain
              commissions from your team's sales{!pointsEligible ? " and to join the points rankings" : ""}.
            </p>
          )}
        </>
      ) : (
        <>
          {/* points target */}
          <div className="mt-5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              My points target
            </label>
            <input
              type="number"
              min={0}
              step={500}
              value={pointsTarget}
              onChange={(e) => setPointsTarget(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-lg font-extrabold text-ink focus:border-gold focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              You hold {fmtPoints(me.pointsBalance)} now · your {me.plan?.name ?? me.category} seat earns points at ×{mult}.
            </p>
          </div>

          {pointsEligible && pointsSuggestion ? (
            <div className="mt-4 rounded-2xl border border-gold-soft bg-champagne/40 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold-deep">
                <Sparkles className="h-3.5 w-3.5" /> Suggested route to {fmtPoints(pointsTarget)}
              </p>
              <ul className="mt-2.5 space-y-1.5 text-sm text-ink">
                <li className="flex justify-between gap-3">
                  <span>
                    Recruit <b>{pointsSuggestion.recruitsNeeded}</b> paid member{pointsSuggestion.recruitsNeeded === 1 ? "" : "s"}
                  </span>
                  <span className="font-bold text-gold-deep">{pointsSuggestion.perRecruitPts} each</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>
                    Sell <b>{naira(pointsSuggestion.salesVolNeeded)}</b> of property
                  </span>
                  <span className="font-bold text-gold-deep">≈ {fmtPoints(pointsSuggestion.salesTargetPts)}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>
                    Pass <b>{pointsSuggestion.exams}</b> exam{pointsSuggestion.exams === 1 ? "" : "s"} + <b>{pointsSuggestion.lessons}</b> lesson{pointsSuggestion.lessons === 1 ? "" : "s"}
                  </span>
                  <span className="font-bold text-gold-deep">
                    {pointsSuggestion.perExamPts}/{pointsSuggestion.perLessonPts} pts each
                  </span>
                </li>
              </ul>
              <p className="mt-2.5 border-t border-gold-soft/60 pt-2 text-[11px] text-muted-foreground">
                From the live point rules: {rules.recruit} pts per recruit, {rules.commissionPer1m} pts per ₦1m of
                your sales commission, {rules.lesson} pts per lesson, {rules.exam} pts per exam — all ×{mult} on your plan.
              </p>
            </div>
          ) : (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-gold-soft bg-champagne/50 p-3 text-xs text-neutral-700">
              <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
              Points unlock from the Pro membership — upgrade to earn points on recruits, sales and academy progress, and to join the rankings.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  hint: string;
  value: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold text-ink">{label}</label>
        <span className="shrink-0 text-sm font-extrabold text-gold-deep">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[#a8842b]"
      />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
