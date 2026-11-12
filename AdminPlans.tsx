import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { naira } from "@/lib/format";
import { CreditCard, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { CommissionSettings } from "@/components/admin/CommissionSettings";

const label = "block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5";
const input =
  "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40";

type PlanForm = {
  code: string;
  name: string;
  fee: string;
  renewalDiscountPct: string;
  voucherAmount: string;
  chainDepth: string;
  pointsEligible: boolean;
  pointsMultiplier: string;
  features: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY: PlanForm = {
  code: "",
  name: "",
  fee: "0",
  renewalDiscountPct: "50",
  voucherAmount: "0",
  chainDepth: "0",
  pointsEligible: false,
  pointsMultiplier: "1",
  features: "",
  sortOrder: "0",
  isActive: true,
};

function num(s: string) {
  return Number(s.replace(/[^\d]/g, "")) || 0;
}

export default function AdminPlans() {
  const utils = trpc.useUtils();
  const { data: plans, isLoading } = trpc.admin.plansList.useQuery();
  const [editing, setEditing] = useState<{ id: number | null; form: PlanForm } | null>(null);

  const invalidate = async () => {
    await utils.admin.plansList.invalidate();
    await utils.member.plans.invalidate();
  };

  const save = trpc.admin.savePlan.useMutation({
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });
  const del = trpc.admin.deletePlan.useMutation({ onSuccess: invalidate });

  const openEdit = (p: NonNullable<typeof plans>[number]) =>
    setEditing({
      id: p.id,
      form: {
        code: p.code,
        name: p.name,
        fee: String(p.fee),
        renewalDiscountPct: String(p.renewalDiscountPct),
        voucherAmount: String(p.voucherAmount),
        chainDepth: String(p.chainDepth),
        pointsEligible: p.pointsEligible,
        pointsMultiplier: p.pointsMultiplier,
        features: (p.features ?? []).join("\n"),
        sortOrder: String(p.sortOrder),
        isActive: p.isActive,
      },
    });

  const submit = () => {
    if (!editing) return;
    const f = editing.form;
    save.mutate({
      id: editing.id ?? undefined,
      code: f.code.trim().toLowerCase(),
      name: f.name.trim(),
      fee: num(f.fee),
      renewalDiscountPct: num(f.renewalDiscountPct),
      voucherAmount: num(f.voucherAmount),
      chainDepth: Math.min(10, num(f.chainDepth)),
      pointsEligible: f.pointsEligible,
      pointsMultiplier: f.pointsMultiplier.trim() || "1",
      features: f.features.split("\n").map((s) => s.trim()).filter(Boolean),
      sortOrder: num(f.sortOrder),
      isActive: f.isActive,
    });
  };

  if (isLoading || !plans) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Admin</p>
          <h1 className="text-3xl font-black text-ink">Membership Plans</h1>
          <p className="text-neutral-500 mt-1">
            Plans are fully dynamic — add, edit or retire levels. Fees are yearly; rank controls which plan is "higher"
            (academy access, upgrade direction). Changes apply to new registrations immediately.
          </p>
        </div>
        <button
          onClick={() => setEditing({ id: null, form: { ...EMPTY, sortOrder: String((plans.at(-1)?.sortOrder ?? 0) + 1) } })}
          className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-ink"
        >
          <Plus className="w-4 h-4" /> Add new plan
        </button>
      </div>

      {/* recruit commission — the % of the plan fee paid when a recruit activates */}
      <CommissionSettings />

      <div className="grid md:grid-cols-2 gap-5">
        {plans.map((p) => (
          <div key={p.id} className={`rounded-2xl border bg-white p-6 ${p.isActive ? "border-neutral-200" : "border-dashed border-neutral-300 opacity-70"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gold-bg-grad flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-black text-ink">
                  {p.name} {!p.isActive && <span className="ml-1 text-[10px] font-black uppercase text-red-500">(inactive)</span>}
                </p>
                <p className="text-xs text-neutral-400 font-mono uppercase">{p.code} · rank {p.sortOrder}</p>
              </div>
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Edit plan">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete the ${p.name} plan? Only possible while no member is on it.`)) del.mutate({ id: p.id });
                  }}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  title="Delete plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <p><span className="text-neutral-400">Fee:</span> <b className="text-ink">{naira(p.fee)}/yr</b></p>
              <p><span className="text-neutral-400">Renewal disc:</span> <b className="text-ink">{p.renewalDiscountPct}%</b></p>
              <p><span className="text-neutral-400">Voucher:</span> <b className="text-ink">{naira(p.voucherAmount)}</b></p>
              <p><span className="text-neutral-400">Chain depth:</span> <b className="text-ink">{p.chainDepth} levels</b></p>
              <p className="col-span-2">
                <span className="text-neutral-400">Points:</span>{" "}
                <b className="text-ink">{p.pointsEligible ? `Yes (×${p.pointsMultiplier})` : "No"}</b>
              </p>
            </div>
            <ul className="mt-3 space-y-1">
              {(p.features ?? []).slice(0, 4).map((f, i) => (
                <li key={i} className="text-xs text-neutral-500">• {f}</li>
              ))}
              {(p.features ?? []).length > 4 && <li className="text-xs text-neutral-400">+{p.features.length - 4} more…</li>}
            </ul>
          </div>
        ))}
      </div>
      {del.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{del.error.message}</p>}

      {/* ------------------------------ edit modal ------------------------------ */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-ink">{editing.id ? `Edit ${editing.form.name}` : "Add new plan"}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Plan code {editing.id ? "(locked)" : "(unique, lowercase)"}</label>
                <input
                  className={`${input} font-mono ${editing.id ? "bg-neutral-100 text-neutral-400" : ""}`}
                  value={editing.form.code}
                  disabled={!!editing.id}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, code: e.target.value.replace(/[^a-z0-9_]/g, "") } })}
                  placeholder="e.g. diamond"
                />
              </div>
              <div>
                <label className={label}>Display name</label>
                <input className={input} value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} placeholder="e.g. Diamond" />
              </div>
              <div>
                <label className={label}>Fee (₦/year)</label>
                <input inputMode="numeric" className={input} value={editing.form.fee} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, fee: e.target.value } })} />
                <p className="text-[10px] text-neutral-400 mt-1">{naira(num(editing.form.fee))}</p>
              </div>
              <div>
                <label className={label}>Rank / sort order (higher = more senior)</label>
                <input inputMode="numeric" className={input} value={editing.form.sortOrder} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, sortOrder: e.target.value } })} />
              </div>
              <div>
                <label className={label}>Renewal discount %</label>
                <input inputMode="numeric" className={input} value={editing.form.renewalDiscountPct} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, renewalDiscountPct: e.target.value } })} />
              </div>
              <div>
                <label className={label}>Property voucher (₦)</label>
                <input inputMode="numeric" className={input} value={editing.form.voucherAmount} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, voucherAmount: e.target.value } })} />
              </div>
              <div>
                <label className={label}>Chain depth (0–10 upline levels)</label>
                <input inputMode="numeric" className={input} value={editing.form.chainDepth} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, chainDepth: e.target.value } })} />
                <p className="text-[10px] text-neutral-400 mt-1">How many upline levels a member on this plan earns chain commission from.</p>
              </div>
              <div>
                <label className={label}>Points multiplier (e.g. 1.5)</label>
                <input className={input} value={editing.form.pointsMultiplier} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, pointsMultiplier: e.target.value } })} disabled={!editing.form.pointsEligible} />
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={editing.form.pointsEligible}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, pointsEligible: e.target.checked } })}
                  className="h-4 w-4 accent-[#a8842b]"
                />
                <span className="text-sm font-bold text-ink">Members on this plan earn points</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={editing.form.isActive}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, isActive: e.target.checked } })}
                  className="h-4 w-4 accent-[#a8842b]"
                />
                <span className="text-sm font-bold text-ink">Active (joinable)</span>
              </label>
              <div className="sm:col-span-2">
                <label className={label}>Features (one per line)</label>
                <textarea
                  rows={5}
                  className={input}
                  value={editing.form.features}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, features: e.target.value } })}
                />
              </div>
            </div>

            {save.error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{save.error.message}</p>}
            <div className="mt-5 flex gap-3">
              <button
                onClick={submit}
                disabled={save.isPending || !editing.form.name.trim() || (!editing.id && editing.form.code.trim().length < 2)}
                className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-ink disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing.id ? "Save changes" : "Create plan"}
              </button>
              <button onClick={() => setEditing(null)} className="rounded-full border border-neutral-300 px-7 py-3 text-sm font-bold text-neutral-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
