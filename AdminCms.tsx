import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { FileText, Search, Plus, X, Check, ImagePlus, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/upload";

/** Human labels for the keys admins most often need — shown above the raw key
 *  so nobody has to guess what "global.social.x" means. */
const KEY_LABELS: Record<string, string> = {
  "global.social.instagram": "Instagram profile URL — shows the Instagram icon on the blog & footer",
  "global.social.whatsapp": "WhatsApp channel/chat link — shows the WhatsApp icon on the blog & footer",
  "global.social.linkedin": "LinkedIn page URL",
  "global.social.facebook": "Facebook page URL",
  "global.social.x": "X (Twitter) profile URL",
  "global.social.youtube": "YouTube channel URL",
  "global.social.tiktok": "TikTok profile URL",
  "global.whatsapp.number": "WhatsApp number for enquiries (digits only, e.g. 2349019857226)",
  "chairman.website": "Chairman's website URL — shows a 'Visit his website' button on the Brand page",
  "chairman.website.label": "Chairman's website button label (e.g. 'Visit his website')",
  "chairman.photo": "Chairman's photo",
  "chairman.name": "Chairman's name",
  "chairman.role": "Chairman's titles/role line",
  "chairman.bio": "Chairman's bio (blank line between paragraphs)",
};

const PREFIX_LABELS: Record<string, string> = {
  global: "Global & footer",
  home: "Home page",
  brand: "Brand page",
  business: "Business page",
  academy: "Academy page",
  join: "Join page",
};

export default function AdminCms() {
  const utils = trpc.useUtils();
  const { data: rows, isLoading } = trpc.admin.getContent.useQuery();
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState({ key: "", value: "" });
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const setContent = trpc.admin.setContent.useMutation({
    onSuccess: async (_r, vars) => {
      await utils.admin.getContent.invalidate();
      await utils.cms.page.invalidate();
      setSavedKey(vars.key);
      setTimeout(() => setSavedKey(null), 2000);
      setEdits((s) => { const n = { ...s }; delete n[vars.key]; return n; });
    },
  });

  const grouped = useMemo(() => {
    if (!rows) return [];
    const filtered = rows.filter((r) => r.key.toLowerCase().includes(search.toLowerCase()));
    const groups = new Map<string, typeof filtered>();
    for (const r of filtered) {
      const prefix = r.key.split(".")[0];
      const arr = groups.get(prefix) ?? [];
      arr.push(r);
      groups.set(prefix, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, search]);

  if (isLoading) {
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
          <h1 className="text-3xl font-black text-ink">Site Content (CMS)</h1>
          <p className="text-neutral-500 mt-1">Every word on the public site is editable here. Nothing is hardcoded.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New key
        </button>
      </div>

      <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4">
        <Search className="w-4 h-4 text-neutral-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter keys… (e.g. home.hero)"
          className="w-full py-3 text-sm focus:outline-none"
        />
      </label>

      {grouped.map(([prefix, items]) => (
        <div key={prefix} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-6 py-3 border-b border-neutral-100 bg-neutral-50/60 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#a8842b]" />
            <h2 className="font-black text-ink text-sm">{PREFIX_LABELS[prefix] ?? prefix}</h2>
            <span className="text-xs text-neutral-400">{items.length} keys</span>
          </div>
          <ul className="divide-y divide-neutral-100">
            {items.map((row) => {
              const value = edits[row.key] ?? row.value ?? "";
              const dirty = edits[row.key] !== undefined && edits[row.key] !== (row.value ?? "");
              const isLong = (row.value ?? "").length > 90 || row.type === "textarea";
              return (
                <li key={row.id} className="px-6 py-4">
                  {KEY_LABELS[row.key] && (
                    <p className="mb-1.5 text-xs font-bold text-ink">{KEY_LABELS[row.key]}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <code className="text-xs font-mono font-bold text-[#7c6117] bg-[#a8842b]/10 rounded-md px-2 py-1">{row.key}</code>
                    {savedKey === row.key && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Check className="w-3 h-3" /> Saved</span>
                    )}
                    <button
                      onClick={() => setContent.mutate({ key: row.key, value })}
                      disabled={!dirty || setContent.isPending}
                      className="ml-auto px-4 py-1.5 rounded-lg gold-bg-grad text-white text-xs font-bold hover:opacity-90 disabled:opacity-30"
                    >
                      Save
                    </button>
                  </div>
                  {isLong ? (
                    <textarea
                      rows={3}
                      value={value}
                      onChange={(e) => setEdits({ ...edits, [row.key]: e.target.value })}
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setEdits({ ...edits, [row.key]: e.target.value })}
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                    />
                  )}
                  {/* image keys — upload straight from the device, with a live preview */}
                  {(row.type === "image" || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value) || value.startsWith("/uploads/")) && (
                    <div className="mt-2 flex items-center gap-3">
                      {value && <img src={value} alt="" className="h-16 w-24 rounded-lg object-cover border border-neutral-200" />}
                      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-bold text-ink hover:bg-neutral-50 ${uploadingKey === row.key ? "opacity-60 pointer-events-none" : ""}`}>
                        {uploadingKey === row.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                        {uploadingKey === row.key ? "Uploading…" : "Upload image"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setUploadingKey(row.key);
                            try {
                              const url = await uploadFile(f, "cms");
                              setEdits((s) => ({ ...s, [row.key]: url }));
                              // save straight away — an upload should take effect immediately
                              setContent.mutate({ key: row.key, value: url });
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "Upload failed");
                            } finally {
                              setUploadingKey(null);
                              e.target.value = "";
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {grouped.length === 0 && (
        <p className="text-center text-neutral-400 text-sm py-10">No content keys match “{search}”.</p>
      )}

      {/* Add key modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAdding(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg">New content key</h3>
              <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setContent.mutate({ key: newKey.key.trim(), value: newKey.value }, { onSuccess: () => { setAdding(false); setNewKey({ key: "", value: "" }); } });
              }}
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Key (e.g. home.hero.headline)</label>
                <input
                  required
                  value={newKey.key}
                  onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Value</label>
                <textarea
                  rows={3}
                  value={newKey.value}
                  onChange={(e) => setNewKey({ ...newKey, value: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </div>
              <button type="submit" disabled={setContent.isPending}
                className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60">
                {setContent.isPending ? "Saving…" : "Create key"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
