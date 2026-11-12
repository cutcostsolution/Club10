import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { uploadFile } from "@/lib/upload";
import { Plus, Pencil, Trash2, X, FileText, Link2, Upload, Loader2, PackageOpen } from "lucide-react";

type KitForm = {
  id?: number;
  title: string;
  description: string;
  kind: "file" | "link";
  url: string;
  sortOrder: number;
  isActive: boolean;
  plans: string[]; // empty = every member
};

const EMPTY: Omit<KitForm, "id"> = {
  title: "",
  description: "",
  kind: "file",
  url: "",
  sortOrder: 0,
  isActive: true,
  plans: [],
};

export default function AdminStarterKit() {
  const utils = trpc.useUtils();
  const { data: rows, isLoading } = trpc.admin.listStarterKit.useQuery();
  const { data: plans } = trpc.admin.plansList.useQuery();
  const [editing, setEditing] = useState<KitForm | null>(null);
  const [uploading, setUploading] = useState(false);

  const save = trpc.admin.saveStarterKit.useMutation({
    onSuccess: () => {
      utils.admin.listStarterKit.invalidate();
      utils.member.starterKit.invalidate();
      setEditing(null);
    },
  });
  const del = trpc.admin.deleteStarterKit.useMutation({
    onSuccess: () => utils.admin.listStarterKit.invalidate(),
  });

  const input =
    "w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Admin</p>
          <h1 className="text-3xl font-black text-ink">Starter Kit</h1>
          <p className="text-neutral-500 mt-1">
            Onboarding materials every member can open from their dashboard — scripts, presentations, forms, guides.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Add resource
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">
            Nothing in the starter kit yet — upload the first resource so new members have it on day one.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-6 py-4">
                <span className="shrink-0 w-10 h-10 rounded-xl bg-[#faf6ec] border border-[#e9dcbb] flex items-center justify-center">
                  {r.kind === "file" ? <FileText className="w-4.5 h-4.5 text-[#a8842b]" /> : <Link2 className="w-4.5 h-4.5 text-[#a8842b]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {r.title}
                    {!r.isActive && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">hidden</span>}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">{r.description || r.url}</p>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-[#a8842b]">
                    {r.plans && r.plans.trim() ? `Plans: ${r.plans}` : "All plans"}
                  </p>
                </div>
                <button onClick={() => setEditing({ ...r, kind: r.kind as "file" | "link", description: r.description ?? "", plans: r.plans ? r.plans.split(",").map((c: string) => c.trim()).filter(Boolean) : [] })} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${r.title}" from the starter kit?`)) del.mutate({ id: r.id }); }}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg flex items-center gap-2">
                <PackageOpen className="w-5 h-5 text-[#a8842b]" />
                {editing.id ? "Edit resource" : "New starter-kit resource"}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({
                  id: editing.id,
                  title: editing.title,
                  description: editing.description || undefined,
                  kind: editing.kind,
                  url: editing.url,
                  sortOrder: editing.sortOrder,
                  isActive: editing.isActive,
                  plans: editing.plans,
                });
              }}
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Title</label>
                <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Description (optional)</label>
                <textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["file", "link"] as const).map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setEditing({ ...editing, kind: k, url: "" })}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${editing.kind === k ? "border-[#a8842b] bg-[#faf6ec] text-ink" : "border-neutral-200 text-neutral-500"}`}
                    >
                      {k === "file" ? "Upload a file" : "External link"}
                    </button>
                  ))}
                </div>
              </div>
              {editing.kind === "file" ? (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">File</label>
                  <div className="flex items-center gap-3">
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl gold-bg-grad px-4 py-2.5 text-xs font-bold text-ink ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading ? "Uploading…" : "Choose file"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        className="hidden"
                        disabled={uploading}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setUploading(true);
                          try {
                            const url = await uploadFile(f, "starter");
                            setEditing((cur) => (cur ? { ...cur, url } : cur));
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                    {editing.url && <span className="text-xs text-emerald-600 font-bold truncate">✓ {editing.url.split("/").pop()}</span>}
                  </div>
                  <p className="mt-1.5 text-[11px] text-neutral-400">PDF or image, up to 25 MB.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Link URL</label>
                  <input required value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" className={input} />
                </div>
              )}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Who can access it</label>
                <div className="flex flex-wrap gap-2">
                  {(plans ?? []).map((pl) => {
                    const on = editing.plans.includes(pl.code);
                    return (
                      <button
                        type="button"
                        key={pl.code}
                        onClick={() =>
                          setEditing({
                            ...editing,
                            plans: on ? editing.plans.filter((c) => c !== pl.code) : [...editing.plans, pl.code],
                          })
                        }
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${on ? "border-[#a8842b] bg-[#faf6ec] text-ink" : "border-neutral-200 text-neutral-400"}`}
                      >
                        {pl.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-400">
                  {editing.plans.length === 0
                    ? "No plan selected — every member can access this resource."
                    : `Only ${editing.plans.length === 1 ? "the selected plan" : "the selected plans"} can access this resource.`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Sort order</label>
                  <input type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className={input} />
                </div>
                <label className="flex items-center gap-2.5 pt-6 text-sm font-bold text-ink">
                  <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="h-4 w-4 accent-[#a8842b]" />
                  Visible to members
                </label>
              </div>
              {save.error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{save.error.message}</p>}
              <button
                type="submit"
                disabled={save.isPending || !editing.title || !editing.url}
                className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60"
              >
                {save.isPending ? "Saving…" : editing.id ? "Save changes" : "Add to starter kit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
