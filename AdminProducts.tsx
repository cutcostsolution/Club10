import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { ExportBar } from "@/components/admin/ExportBar";
import { naira, fmtDate } from "@/lib/format";
import { Plus, Pencil, Trash2, X, ImagePlus, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/upload";

type ProductForm = {
  id?: number;
  categoryId: number;
  name: string;
  tag: string;
  description: string;
  price: string;
  priceLabel: string;
  location: string;
  country: string;
  state: string;
  titleStatus: string;
  commissionPct: string;
  sellingNotes: string;
  highlights: string;
  features: string;
  paymentPlan: string;
  imageUrl: string;
  imageTheme: string;
  status: "live" | "draft" | "sold" | "coming_soon";
};

const EMPTY: Omit<ProductForm, "id"> = {
  categoryId: 0,
  name: "",
  tag: "",
  description: "",
  price: "",
  priceLabel: "",
  location: "",
  country: "Nigeria",
  state: "",
  titleStatus: "Verified title",
  commissionPct: "",
  sellingNotes: "",
  highlights: "",
  features: "",
  paymentPlan: "",
  imageUrl: "",
  imageTheme: "dark",
  status: "draft",
};

const STATUS_BADGE: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700",
  draft: "bg-neutral-100 text-neutral-500",
  sold: "bg-blue-50 text-blue-700",
  coming_soon: "bg-amber-50 text-amber-700",
};

export default function AdminProducts() {
  const utils = trpc.useUtils();
  const { data: rows, isLoading } = trpc.admin.productsList.useQuery();
  const { data: categories } = trpc.catalog.categories.useQuery();
  const { data: locations } = trpc.admin.listLocations.useQuery();

  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [catEditing, setCatEditing] = useState<{ id?: number; name: string; description: string; commissionPct: string; sortOrder: number } | null>(null);
  const [locEditing, setLocEditing] = useState(false);
  const [locFilter, setLocFilter] = useState({ categoryId: "", country: "", state: "" });

  const countries = [...new Set([...(locations ?? []).map((l) => l.name), ...(rows ?? []).map((r) => r.product.country || "Nigeria")])].sort();
  const states = [...new Set(
    (rows ?? [])
      .filter((r) => !locFilter.country || (r.product.country || "Nigeria") === locFilter.country)
      .map((r) => r.product.state)
      .filter((s): s is string => !!s)
  )].sort();
  const filtered = (rows ?? []).filter(({ product: p }) => {
    if (locFilter.categoryId && p.categoryId !== Number(locFilter.categoryId)) return false;
    if (locFilter.country && (p.country || "Nigeria") !== locFilter.country) return false;
    if (locFilter.state && p.state !== locFilter.state) return false;
    return true;
  });

  const save = trpc.admin.saveProduct.useMutation({
    onSuccess: () => { utils.admin.productsList.invalidate(); utils.catalog.products.invalidate(); setEditing(null); },
  });
  const del = trpc.admin.deleteProduct.useMutation({ onSuccess: () => utils.admin.productsList.invalidate() });
  const saveCat = trpc.admin.saveCategory.useMutation({
    onSuccess: () => { utils.catalog.categories.invalidate(); utils.admin.productsList.invalidate(); setCatEditing(null); },
  });

  const openNew = () => setEditing({ ...EMPTY, categoryId: categories?.[0]?.id ?? 0 });

  const openEdit = (p: NonNullable<typeof rows>[number]["product"]) =>
    setEditing({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      tag: p.tag ?? "",
      description: p.description ?? "",
      price: String(p.price),
      priceLabel: p.priceLabel ?? "",
      location: p.location ?? "",
      country: p.country ?? "Nigeria",
      state: p.state ?? "",
      titleStatus: p.titleStatus ?? "",
      commissionPct: p.commissionPct == null ? "" : String(p.commissionPct),
      sellingNotes: p.sellingNotes ?? "",
      highlights: (p as any).highlights ?? "",
      features: (p as any).features ?? "",
      paymentPlan: (p as any).paymentPlan ?? "",
      imageUrl: p.imageUrl ?? "",
      imageTheme: p.imageTheme ?? "dark",
      status: p.status,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Admin</p>
          <h1 className="text-3xl font-black text-ink">Products</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCatEditing({ name: "", description: "", commissionPct: "", sortOrder: 0 })}
            className="px-5 py-2.5 rounded-xl border border-neutral-300 bg-white font-bold text-sm text-ink hover:bg-neutral-50"
          >
            + Category
          </button>
          <button
            onClick={() => setLocEditing(true)}
            className="px-5 py-2.5 rounded-xl border border-neutral-300 bg-white font-bold text-sm text-ink hover:bg-neutral-50"
          >
            Locations
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Add product
          </button>
        </div>
      </div>

      <ExportBar datasets={["products"]} title="Export products & properties (CSV)" />

      {/* Categories strip */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-center">
        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">Categories:</span>
        {categories?.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatEditing({ id: c.id, name: c.name, description: c.description ?? "", commissionPct: String(c.commissionPct), sortOrder: c.sortOrder })}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 px-4 py-2 text-sm font-bold text-ink transition"
          >
            {c.name} · {c.commissionPct}% <Pencil className="w-3 h-3 text-neutral-400" />
          </button>
        ))}
      </div>

      {/* Location navigation */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-2.5 items-center">
        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">Navigate by:</span>
        <select
          value={locFilter.categoryId}
          onChange={(e) => setLocFilter({ ...locFilter, categoryId: e.target.value })}
          className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        >
          <option value="">All categories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={locFilter.country}
          onChange={(e) => setLocFilter({ ...locFilter, country: e.target.value, state: "" })}
          className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        >
          <option value="">All countries</option>
          {countries.map((co) => <option key={co} value={co}>{co}</option>)}
        </select>
        <select
          value={locFilter.state}
          onChange={(e) => setLocFilter({ ...locFilter, state: e.target.value })}
          className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        >
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(locFilter.categoryId || locFilter.country || locFilter.state) && (
          <button
            onClick={() => setLocFilter({ categoryId: "", country: "", state: "" })}
            className="rounded-full border border-[#a8842b]/40 px-3.5 py-2 text-xs font-bold text-[#7c6117] hover:bg-[#e9dcbb]/40"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs font-bold text-neutral-400">{filtered.length} of {rows?.length ?? 0} products</span>
      </div>

      {/* Products table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No products yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No products match this location filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3 text-right">Commission</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Added</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(({ product: p, category }) => (
                  <tr key={p.id} className="hover:bg-neutral-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink">{p.name}</p>
                      <p className="text-xs text-neutral-400">
                        {p.location ?? "—"} {p.tag ? `· ${p.tag}` : ""}
                        <span className="ml-1 rounded bg-[#e9dcbb]/60 px-1.5 py-0.5 text-[10px] font-bold text-[#7c6117]">
                          {[p.state, p.country].filter(Boolean).join(" · ") || "No location"}
                        </span>
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600">{category?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-ink whitespace-nowrap">{naira(p.price)}</td>
                    <td className="px-5 py-3.5 text-right text-neutral-600">{p.commissionPct ?? category?.commissionPct ?? "—"}%</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize ${STATUS_BADGE[p.status] ?? ""}`}>
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete "${p.name}"?`)) del.mutate({ id: p.id }); }}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg">{editing.id ? "Edit product" : "New product"}</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="grid sm:grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({
                  id: editing.id,
                  categoryId: editing.categoryId,
                  name: editing.name,
                  tag: editing.tag || undefined,
                  description: editing.description || undefined,
                  price: Number(editing.price.replace(/[^\d]/g, "")),
                  priceLabel: editing.priceLabel || undefined,
                  location: editing.location || undefined,
                  country: editing.country || "Nigeria",
                  state: editing.state || undefined,
                  titleStatus: editing.titleStatus || undefined,
                  commissionPct: editing.commissionPct === "" ? null : Number(editing.commissionPct),
                  sellingNotes: editing.sellingNotes || undefined,
                  highlights: editing.highlights || undefined,
                  features: editing.features || undefined,
                  paymentPlan: editing.paymentPlan || undefined,
                  imageUrl: editing.imageUrl || null,
                  imageTheme: editing.imageTheme || undefined,
                  status: editing.status,
                });
              }}
            >
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Name</label>
                <input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Category</label>
                <select required value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: Number(e.target.value) })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40">
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Status</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProductForm["status"] })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40">
                  <option value="live">Live</option>
                  <option value="draft">Draft</option>
                  <option value="coming_soon">Coming soon</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Price (₦)</label>
                <input required inputMode="numeric" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Price label</label>
                <input value={editing.priceLabel} onChange={(e) => setEditing({ ...editing, priceLabel: e.target.value })} placeholder="₦19,000,000 / plot"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Location (area / estate)</label>
                <input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Country</label>
                <select value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value, state: "" })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40">
                  {[...new Set([editing.country, ...(locations ?? []).map((l) => l.name)])].filter(Boolean).map((co) => (
                    <option key={co} value={co}>{co}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-neutral-400">Manage this list under “Locations”.</p>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">State</label>
                <select value={editing.state} onChange={(e) => setEditing({ ...editing, state: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40">
                  <option value="">— Select state —</option>
                  {[...new Set([editing.state, ...(locations ?? []).find((l) => l.name === editing.country)?.states.map((s) => s.name) ?? []])].filter(Boolean).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Tag</label>
                <input value={editing.tag} onChange={(e) => setEditing({ ...editing, tag: e.target.value })} placeholder="Estate land"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Title status</label>
                <input value={editing.titleStatus} onChange={(e) => setEditing({ ...editing, titleStatus: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Commission % (blank = category default)</label>
                <input inputMode="decimal" value={editing.commissionPct} onChange={(e) => setEditing({ ...editing, commissionPct: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Image theme</label>
                <select value={editing.imageTheme} onChange={(e) => setEditing({ ...editing, imageTheme: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40">
                  <option value="dark">Dark</option>
                  <option value="gold">Gold</option>
                  <option value="green">Green</option>
                </select>
              </div>
              {/* product image */}
              <div className="sm:col-span-2 rounded-xl border border-neutral-200 p-4">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Product image</label>
                <p className="text-xs text-neutral-400 mb-3">
                  Upload a photo from your device (up to 25 MB) or paste an image link. This image shows on the public catalogue and the realtor dashboard.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl gold-bg-grad px-4 py-2.5 text-xs font-bold text-ink ${uploadingImg ? "opacity-60 pointer-events-none" : ""}`}>
                    {uploadingImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                    {uploadingImg ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingImg}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 25 * 1024 * 1024) { alert("Images up to 25 MB are fine — this one is bigger."); return; }
                        setUploadingImg(true);
                        try {
                          const url = await uploadFile(file, "product");
                          setEditing((cur) => (cur ? { ...cur, imageUrl: url } : cur));
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Upload failed");
                        } finally {
                          setUploadingImg(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  <span className="text-xs text-neutral-400">or</span>
                  <input
                    value={editing.imageUrl.startsWith("data:") ? "" : editing.imageUrl}
                    onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                    placeholder="Paste image URL (https://…)"
                    className="min-w-[240px] flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                  />
                  {editing.imageUrl && (
                    <button type="button" onClick={() => setEditing({ ...editing, imageUrl: "" })} className="text-xs font-bold text-red-500 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
                {editing.imageUrl && (
                  <img src={editing.imageUrl} alt="Product" className="mt-3 h-36 w-full rounded-xl object-cover" />
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">
                  Description <span className="text-neutral-300 normal-case font-medium">— the full story; the Marketing Studio builds its strategies from this</span>
                </label>
                <textarea rows={7} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Describe the property expressively — the land, the location story, who it's perfect for, the vision…"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Key highlights (one per line)</label>
                <textarea rows={3} value={editing.highlights} onChange={(e) => setEditing({ ...editing, highlights: e.target.value })}
                  placeholder={"Dry, table land\n5 minutes from the expressway\nInstant allocation"}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Features & infrastructure (one per line)</label>
                <textarea rows={3} value={editing.features} onChange={(e) => setEditing({ ...editing, features: e.target.value })}
                  placeholder={"Perimeter fencing\nGatehouse\nStreet lights\nDrainage"}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Payment plan</label>
                <textarea rows={2} value={editing.paymentPlan} onChange={(e) => setEditing({ ...editing, paymentPlan: e.target.value })}
                  placeholder="e.g. 40% deposit, balance spread over 6 months at no extra charge"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Selling notes (member kit)</label>
                <textarea rows={3} value={editing.sellingNotes} onChange={(e) => setEditing({ ...editing, sellingNotes: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              {save.error && <p className="sm:col-span-2 text-sm text-red-600">{save.error.message}</p>}
              <button type="submit" disabled={save.isPending}
                className="sm:col-span-2 py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60">
                {save.isPending ? "Saving…" : "Save product"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category modal */}
      {catEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setCatEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg">{catEditing.id ? "Edit category" : "New category"}</h3>
              <button onClick={() => setCatEditing(null)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveCat.mutate({
                  id: catEditing.id,
                  name: catEditing.name,
                  description: catEditing.description || undefined,
                  commissionPct: Number(catEditing.commissionPct),
                  sortOrder: catEditing.sortOrder,
                });
              }}
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Name</label>
                <input required value={catEditing.name} onChange={(e) => setCatEditing({ ...catEditing, name: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Commission %</label>
                <input required inputMode="decimal" value={catEditing.commissionPct} onChange={(e) => setCatEditing({ ...catEditing, commissionPct: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Description</label>
                <textarea rows={2} value={catEditing.description} onChange={(e) => setCatEditing({ ...catEditing, description: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40" />
              </div>
              <button type="submit" disabled={saveCat.isPending}
                className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60">
                {saveCat.isPending ? "Saving…" : "Save category"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Locations manager modal */}
      {locEditing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setLocEditing(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-ink text-lg">Locations</h3>
              <button onClick={() => setLocEditing(false)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-neutral-400 mb-5">
              Countries and states you add here become the dropdown options in the product editor and the filter lists on the catalogue. Deleting a country also removes its states — products already tagged with them keep their values.
            </p>
            <LocationManager onClose={() => setLocEditing(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function LocationManager({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: locations } = trpc.admin.listLocations.useQuery();
  const [newCountry, setNewCountry] = useState("");
  const [newStateFor, setNewStateFor] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const invalidate = () => {
    utils.admin.listLocations.invalidate();
    utils.catalog.locations.invalidate();
    utils.admin.productsList.invalidate();
  };
  const handleErr = (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong");

  const saveCountry = trpc.admin.saveCountry.useMutation({ onSuccess: () => { invalidate(); setNewCountry(""); setError(""); }, onError: handleErr });
  const deleteCountry = trpc.admin.deleteCountry.useMutation({ onSuccess: () => { invalidate(); setError(""); }, onError: handleErr });
  const saveState = trpc.admin.saveState.useMutation({ onSuccess: () => { invalidate(); setNewStateFor({}); setError(""); }, onError: handleErr });
  const deleteState = trpc.admin.deleteState.useMutation({ onSuccess: () => { invalidate(); setError(""); }, onError: handleErr });

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600">{error}</p>}

      {/* add country */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newCountry.trim()) saveCountry.mutate({ name: newCountry.trim() });
        }}
      >
        <input
          value={newCountry}
          onChange={(e) => setNewCountry(e.target.value)}
          placeholder="Add a country — e.g. Ghana"
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
        />
        <button type="submit" disabled={saveCountry.isPending}
          className="px-4 py-2.5 rounded-xl gold-bg-grad text-white text-sm font-bold hover:opacity-90 disabled:opacity-60">
          Add
        </button>
      </form>

      {/* country list */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {(locations ?? []).map((c) => (
          <div key={c.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-bold text-ink text-sm">{c.name}</p>
              <button
                onClick={() => { if (confirm(`Delete ${c.name} and its ${c.states.length} state(s)?`)) deleteCountry.mutate({ id: c.id }); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete country"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {c.states.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-ink">
                  {s.name}
                  <button onClick={() => deleteState.mutate({ id: s.id })} className="text-neutral-400 hover:text-red-500" title="Remove state">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {c.states.length === 0 && <span className="text-xs text-neutral-400">No states yet.</span>}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = (newStateFor[c.id] ?? "").trim();
                if (name) saveState.mutate({ countryId: c.id, name });
              }}
            >
              <input
                value={newStateFor[c.id] ?? ""}
                onChange={(e) => setNewStateFor({ ...newStateFor, [c.id]: e.target.value })}
                placeholder="Add a state / region"
                className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
              <button type="submit" disabled={saveState.isPending}
                className="px-3 py-2 rounded-lg border border-[#a8842b]/40 text-xs font-bold text-[#7c6117] hover:bg-[#e9dcbb]/40 disabled:opacity-60">
                + State
              </button>
            </form>
          </div>
        ))}
      </div>

      <button onClick={onClose} className="w-full py-3 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-500 hover:bg-neutral-50">
        Done
      </button>
    </div>
  );
}
