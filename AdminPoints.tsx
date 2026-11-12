import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { uploadFile } from "@/lib/upload";
import { fmtDate, points as fmtPoints, naira } from "@/lib/format";
import { Sparkles, Gift, ListChecks, Pencil, X, Plus, Trash2 } from "lucide-react";
import { ExportBar } from "@/components/admin/ExportBar";


export default function AdminPoints() {
  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.admin.getPointRules.useQuery();
  const { data: rewardRows } = trpc.admin.rewardsList.useQuery();
  const { data: redemptions } = trpc.admin.redemptionsQueue.useQuery();
  const { data: ledgerRows } = trpc.admin.pointsLedgerList.useQuery();
  const delEntry = trpc.admin.deletePointsEntry.useMutation({ onSuccess: () => utils.admin.pointsLedgerList.invalidate() });

  const [ruleEdits, setRuleEdits] = useState<Record<string, string>>({});
  const [rewardEditing, setRewardEditing] = useState<{
    id?: number; name: string; description: string; imageUrl: string; pointCost: string; voucherCost: string; stock: string; status: "live" | "paused";
  } | null>(null);
  const [rewardUploading, setRewardUploading] = useState(false);

  const saveRule = trpc.admin.savePointRule.useMutation({ onSuccess: () => utils.admin.getPointRules.invalidate() });
  const addRule = trpc.admin.addPointRule.useMutation({
    onSuccess: () => { utils.admin.getPointRules.invalidate(); setRuleAdding(null); },
  });
  const deleteRule = trpc.admin.deletePointRule.useMutation({ onSuccess: () => utils.admin.getPointRules.invalidate() });
  const [ruleAdding, setRuleAdding] = useState<{ key: string; label: string; value: string; note: string } | null>(null);
  const saveReward = trpc.admin.saveReward.useMutation({
    onSuccess: () => { utils.admin.rewardsList.invalidate(); utils.points.rewards.invalidate(); setRewardEditing(null); },
  });
  const setRedemption = trpc.admin.setRedemptionStatus.useMutation({ onSuccess: () => utils.admin.redemptionsQueue.invalidate() });


  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Admin</p>
          <h1 className="text-3xl font-black text-ink">Points & Rewards</h1>
        </div>

      </div>

      {/* Point rules */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex flex-wrap items-center gap-2">
          <ListChecks className="w-5 h-5 text-[#a8842b]" />
          <div className="flex-1">
            <h2 className="font-black text-ink">Point rules</h2>
            <p className="text-xs text-neutral-400">Points per sale (per ₦1m), per referral, per lesson/exam, per link click. Which plans earn points is set per plan under Membership Plans.</p>
          </div>
          <button
            onClick={() => setRuleAdding({ key: "", label: "", value: "", note: "" })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg gold-bg-grad text-ink text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Add rule
          </button>
        </div>
        <ul className="divide-y divide-neutral-100">
          {rules?.map((r) => {
            const value = ruleEdits[r.key] ?? r.value;
            const dirty = ruleEdits[r.key] !== undefined && ruleEdits[r.key] !== r.value;
            return (
              <li key={r.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-bold text-ink text-sm">{r.label}</p>
                  <p className="text-xs text-neutral-400 font-mono">{r.key}{r.note ? ` — ${r.note}` : ""}</p>
                </div>
                <input
                  value={value}
                  onChange={(e) => setRuleEdits({ ...ruleEdits, [r.key]: e.target.value })}
                  className="w-28 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
                <button
                  onClick={() => saveRule.mutate({ key: r.key, value }, { onSuccess: () => setRuleEdits((s) => { const n = { ...s }; delete n[r.key]; return n; }) })}
                  disabled={!dirty || saveRule.isPending}
                  className="px-4 py-2 rounded-lg gold-bg-grad text-white text-xs font-bold hover:opacity-90 disabled:opacity-30"
                >
                  Save
                </button>
                <button
                  onClick={() => { if (confirm(`Delete the rule "${r.label}" (${r.key})?`)) deleteRule.mutate({ key: r.key }); }}
                  className="rounded-lg p-2 text-red-400 hover:bg-red-50"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>

        {/* add rule form */}
        {ruleAdding && (
          <div className="border-t border-neutral-100 bg-champagne/30 px-6 py-5">
            <p className="text-sm font-black text-ink mb-3">New point rule</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                placeholder="key (e.g. webinar)"
                value={ruleAdding.key}
                onChange={(e) => setRuleAdding({ ...ruleAdding, key: e.target.value.replace(/[^a-z0-9_]/g, "") })}
                className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
              <input
                placeholder="Label (e.g. Points per webinar)"
                value={ruleAdding.label}
                onChange={(e) => setRuleAdding({ ...ruleAdding, label: e.target.value })}
                className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
              <input
                placeholder="Value (e.g. 50)"
                value={ruleAdding.value}
                onChange={(e) => setRuleAdding({ ...ruleAdding, value: e.target.value })}
                className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
              <input
                placeholder="Note (optional)"
                value={ruleAdding.note}
                onChange={(e) => setRuleAdding({ ...ruleAdding, note: e.target.value })}
                className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
            </div>
            {addRule.error && <p className="mt-2 text-sm text-red-600">{addRule.error.message}</p>}
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => addRule.mutate({ key: ruleAdding.key, label: ruleAdding.label, value: ruleAdding.value, note: ruleAdding.note || undefined })}
                disabled={addRule.isPending || !ruleAdding.key || !ruleAdding.label || !ruleAdding.value}
                className="px-5 py-2.5 rounded-lg gold-bg-grad text-ink text-xs font-bold hover:opacity-90 disabled:opacity-40"
              >
                Add rule
              </button>
              <button onClick={() => setRuleAdding(null)} className="px-5 py-2.5 rounded-lg border border-neutral-300 text-xs font-bold text-neutral-600">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rewards */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3">
          <Gift className="w-5 h-5 text-[#a8842b]" />
          <h2 className="font-black text-ink flex-1">Rewards catalogue</h2>
          <button
            onClick={() => setRewardEditing({ name: "", description: "", imageUrl: "", pointCost: "", voucherCost: "", stock: "1", status: "live" })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg gold-bg-grad text-white text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Add reward
          </button>
        </div>
        {!rewardRows || rewardRows.length === 0 ? (
          <p className="px-6 py-8 text-center text-neutral-400 text-sm">No rewards configured.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rewardRows.map((r) => (
              <li key={r.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                {r.imageUrl && <img src={r.imageUrl} alt="" className="h-12 w-16 rounded-lg border border-neutral-200 object-cover" />}
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-ink">{r.name}</p>
                  {r.description && <p className="text-xs text-neutral-400">{r.description}</p>}
                </div>
                <span className="font-black text-[#a8842b] text-sm">{fmtPoints(r.pointCost)} pts</span>
                {r.voucherCost ? <span className="font-bold text-emerald-700 text-xs">or {naira(r.voucherCost)} voucher</span> : null}
                <span className="text-xs text-neutral-400">stock {r.stock}</span>
                <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${r.status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {r.status}
                </span>
                <button
                  onClick={() => setRewardEditing({ id: r.id, name: r.name, description: r.description ?? "", imageUrl: r.imageUrl ?? "", pointCost: String(r.pointCost), voucherCost: r.voucherCost ? String(r.voucherCost) : "", stock: String(r.stock), status: r.status })}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Redemptions */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#a8842b]" />
          <h2 className="font-black text-ink">Redemption queue</h2>
        </div>
        {!redemptions || redemptions.length === 0 ? (
          <p className="px-6 py-8 text-center text-neutral-400 text-sm">No redemptions yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {redemptions.map(({ redemption, member, reward }) => (
              <li key={redemption.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-ink text-sm">
                    {reward?.name ?? "Reward"} — {redemption.voucherSpent > 0 ? `${naira(redemption.voucherSpent)} voucher` : `${fmtPoints(redemption.pointsSpent)}`}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {member ? `${member.firstName} ${member.lastName} (${member.membershipCode})` : "—"} · {fmtDate(redemption.createdAt)}
                  </p>
                </div>
                <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${
                  redemption.status === "fulfilled" ? "bg-emerald-50 text-emerald-700" :
                  redemption.status === "declined" ? "bg-red-50 text-red-600" :
                  redemption.status === "processing" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {redemption.status}
                </span>
                {redemption.status === "pending" && (
                  <div className="flex gap-1.5">
                    {(["processing", "fulfilled", "declined"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setRedemption.mutate({ id: redemption.id, status: s })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
                          s === "fulfilled" ? "gold-bg-grad text-white" :
                          s === "declined" ? "border border-red-200 text-red-600 hover:bg-red-50" :
                          "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reward modal */}
      {rewardEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setRewardEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg">{rewardEditing.id ? "Edit reward" : "New reward"}</h3>
              <button onClick={() => setRewardEditing(null)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveReward.mutate({
                  id: rewardEditing.id,
                  name: rewardEditing.name,
                  description: rewardEditing.description || undefined,
                  imageUrl: rewardEditing.imageUrl || null,
                  pointCost: Number(rewardEditing.pointCost.replace(/[^\d]/g, "")),
                  voucherCost: rewardEditing.voucherCost ? Number(rewardEditing.voucherCost.replace(/[^\d]/g, "")) || null : null,
                  stock: Number(rewardEditing.stock.replace(/[^\d]/g, "") || "0"),
                  status: rewardEditing.status,
                });
              }}
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Name</label>
                <input required value={rewardEditing.name} onChange={(e) => setRewardEditing({ ...rewardEditing, name: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Description</label>
                <textarea rows={2} value={rewardEditing.description} onChange={(e) => setRewardEditing({ ...rewardEditing, description: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Reward image</label>
                <div className="flex items-center gap-3">
                  {rewardEditing.imageUrl ? (
                    <img src={rewardEditing.imageUrl} alt="" className="h-20 w-32 rounded-xl border border-neutral-200 object-cover" />
                  ) : (
                    <div className="flex h-20 w-32 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-[10px] font-bold uppercase tracking-widest text-neutral-300">
                      No image
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-bold text-ink hover:bg-neutral-50 ${rewardUploading ? "opacity-60 pointer-events-none" : ""}`}>
                      {rewardUploading ? "Uploading…" : rewardEditing.imageUrl ? "Replace image" : "Upload image"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setRewardUploading(true);
                          try {
                            const url = await uploadFile(f, "cms");
                            setRewardEditing((cur) => (cur ? { ...cur, imageUrl: url } : cur));
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setRewardUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                    {rewardEditing.imageUrl && (
                      <button type="button" onClick={() => setRewardEditing({ ...rewardEditing, imageUrl: "" })}
                        className="block text-xs font-bold text-red-500 hover:underline">
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-400">The full photo members see on the reward card in their dashboard store.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Points</label>
                  <input required inputMode="numeric" value={rewardEditing.pointCost} onChange={(e) => setRewardEditing({ ...rewardEditing, pointCost: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Voucher ₦ (optional)</label>
                  <input inputMode="numeric" value={rewardEditing.voucherCost} onChange={(e) => setRewardEditing({ ...rewardEditing, voucherCost: e.target.value })}
                    placeholder="—" className="w-full rounded-xl border border-neutral-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Stock</label>
                  <input required inputMode="numeric" value={rewardEditing.stock} onChange={(e) => setRewardEditing({ ...rewardEditing, stock: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Status</label>
                  <select value={rewardEditing.status} onChange={(e) => setRewardEditing({ ...rewardEditing, status: e.target.value as "live" | "paused" })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40">
                    <option value="live">Live</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saveReward.isPending}
                className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60">
                {saveReward.isPending ? "Saving…" : "Save reward"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Points ledger — every entry ever posted, with error-correction delete */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-black text-ink">Points ledger</h2>
          <p className="text-xs text-neutral-400">Every points entry posted to a member. Deleting an entry adjusts the member's balance by its value — use only to correct an error.</p>
        </div>
        {!ledgerRows || ledgerRows.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No points posted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3 text-right">Points</th>
                  <th className="px-5 py-3">Detail</th>
                  <th className="px-5 py-3">Posted</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ledgerRows.slice(0, 100).map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3 font-bold text-ink">{r.memberName} <span className="text-neutral-400 font-mono text-xs">{r.memberCode}</span></td>
                    <td className="px-5 py-3 text-neutral-500 capitalize">{r.action.replace(/_/g, " ")}</td>
                    <td className={`px-5 py-3 text-right font-extrabold ${r.points >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {r.points >= 0 ? "+" : ""}{fmtPoints(r.points)}
                    </td>
                    <td className="px-5 py-3 text-neutral-400 text-xs">{r.meta ?? "—"}</td>
                    <td className="px-5 py-3 text-neutral-400 text-xs">{fmtDate(r.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => { if (confirm(`Delete this ${r.points} pts entry for ${r.memberName}? Their balance will be adjusted by ${-r.points} pts.`)) delEntry.mutate({ id: r.id }); }}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExportBar datasets={["points"]} title="Export points ledger (CSV)" />
    </div>
  );
}
