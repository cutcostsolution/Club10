import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Loader2, Check, Percent } from "lucide-react";

const label = "text-xs font-black uppercase tracking-wider text-neutral-500";
const input =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:border-[#a8842b]";

/* ------------------------------ commissions -------------------------------- */

export function CommissionSettings() {
  const utils = trpc.useUtils();
  const { data } = trpc.admin.commissionSettings.useQuery();
  const { data: plans } = trpc.admin.plansList.useQuery();
  const [pct, setPct] = useState("30");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setPct(String(data.registrationPct));
  }, [data]);

  const save = trpc.admin.saveCommissionSettings.useMutation({
    onSuccess: async () => {
      await utils.admin.commissionSettings.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const num = parseFloat(pct);
  const valid = !isNaN(num) && num >= 0 && num <= 100;
  const paid = (plans ?? []).filter((p) => p.fee > 0);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Percent className="h-5 w-5 text-[#a8842b]" />
        <h2 className="text-lg font-black text-ink">Registration commission</h2>
        <span className="rounded-full gold-bg-grad px-3 py-1 text-[10px] font-black uppercase tracking-widest text-ink">
          editable
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        This is the percentage a member earns the moment someone joins a paid plan through their referral link
        (currently applied to Pro, Elite and Executive activations). Change it here — new activations pay at the
        new rate immediately.
      </p>

      <div className="mt-5 max-w-xs">
        <p className={`${label} mb-1.5`}>Registration commission (% of plan fee)</p>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            className={`${input} pr-10`}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">%</span>
        </div>
        {!valid && <p className="mt-1.5 text-xs font-semibold text-red-600">Enter a number between 0 and 100.</p>}
      </div>

      {valid && paid.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {paid.map((p) => (
            <span key={p.code} className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-xs font-bold text-ink">
              {p.name}: ₦{Math.round((p.fee * num) / 100).toLocaleString()} per recruit
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => save.mutate({ registrationPct: num })}
          disabled={save.isPending || !valid}
          className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-ink disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved — new rate is live" : "Save commission rate"}
        </button>
        {save.error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{save.error.message}</p>}
      </div>
    </section>
  );
}

