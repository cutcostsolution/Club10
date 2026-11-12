import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * Shared admin export bar — every dataset honours the natural filters of its
 * own dashboard: realtors filter by status/plan/join dates, products by
 * community/status, payments by type/status/date range, sales by product/
 * status/date range, commissions by status/dates, points by action/dates.
 */

const DATASET_LABELS: Record<string, string> = {
  payments: "Payment history (registrations, renewals, upgrades, property payments)",
  sales: "Product sales",
  members: "Realtor biodata (full, with upline & status)",
  products: "Products & properties",
  commissions: "Commission ledger",
  points: "Points ledger",
};

const DATED = new Set(["payments", "sales", "members", "commissions", "points"]);

const MEMBER_STATUS = ["pending", "active", "suspended", "expired"];
const PAYMENT_TYPES: Array<[string, string]> = [
  ["membership", "Membership"],
  ["property", "Property"],
  ["commission_claim", "Commission claim"],
];
const PAYMENT_STATUS = ["pending", "approved", "rejected"];
const SALE_STATUS = ["pending", "approved", "rejected", "revoked"];
const COMMISSION_STATUS = ["pending", "approved", "paid", "rejected"];
const PRODUCT_STATUS = ["live", "coming_soon", "draft", "sold"];
const POINT_ACTIONS = ["commission", "recruit", "lesson", "exam", "link_click", "redeem", "reversal"];

const inputCls =
  "rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40";
const labelCls = "mb-1 text-[10px] font-black uppercase tracking-widest text-neutral-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      {children}
    </div>
  );
}

export function ExportBar({ datasets, title = "Export records (CSV)" }: { datasets?: string[]; title?: string }) {
  const keys = datasets ?? Object.keys(DATASET_LABELS);
  const [dataset, setDataset] = useState(keys[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [productId, setProductId] = useState("");
  const [action, setAction] = useState("");

  const { data: plans } = trpc.member.plans.useQuery();
  const { data: prodCats } = trpc.catalog.categories.useQuery();
  const { data: products } = trpc.admin.productsList.useQuery();

  const statusOptions = useMemo(() => {
    if (dataset === "members") return MEMBER_STATUS;
    if (dataset === "payments") return PAYMENT_STATUS;
    if (dataset === "sales") return SALE_STATUS;
    if (dataset === "commissions") return COMMISSION_STATUS;
    if (dataset === "products") return PRODUCT_STATUS;
    return null;
  }, [dataset]);

  const download = () => {
    const params = new URLSearchParams();
    if (DATED.has(dataset)) {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    if (statusOptions && status) params.set("status", status);
    if (dataset === "members" && category) params.set("category", category);
    if (dataset === "products" && category) params.set("category", category);
    if (dataset === "payments" && type) params.set("type", type);
    if (dataset === "sales" && productId) params.set("productId", productId);
    if (dataset === "points" && action) params.set("action", action);
    const qs = params.toString();
    window.open(`/api/export/${dataset}${qs ? `?${qs}` : ""}`, "_blank");
  };

  const selectDataset = (k: string) => {
    setDataset(k);
    setStatus(""); setCategory(""); setType(""); setProductId(""); setAction("");
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <Download className="h-4 w-4 text-[#a8842b]" />
        <h2 className="text-sm font-black text-ink">{title}</h2>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {keys.length > 1 && (
          <div className="min-w-[240px] flex-1">
            <p className={labelCls}>What to export</p>
            <select value={dataset} onChange={(e) => selectDataset(e.target.value)} className={`w-full ${inputCls}`}>
              {keys.map((k) => (
                <option key={k} value={k}>{DATASET_LABELS[k]}</option>
              ))}
            </select>
          </div>
        )}
        {DATED.has(dataset) && (
          <>
            <Field label="From">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </Field>
            <Field label="To">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}
        {statusOptions && (
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="">All statuses</option>
              {statusOptions.map((o) => (
                <option key={o} value={o} className="capitalize">{o.replace("_", " ")}</option>
              ))}
            </select>
          </Field>
        )}
        {dataset === "members" && (
          <Field label="Plan">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">All plans</option>
              {(plans ?? []).map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </Field>
        )}
        {dataset === "products" && (
          <Field label="Community">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">All communities</option>
              {(prodCats ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </Field>
        )}
        {dataset === "payments" && (
          <Field label="Payment type">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="">All types</option>
              {PAYMENT_TYPES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </Field>
        )}
        {dataset === "sales" && (
          <Field label="Product">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">All products</option>
              {(products ?? []).map((r) => (
                <option key={r.product.id} value={r.product.id}>{r.product.name}</option>
              ))}
            </select>
          </Field>
        )}
        {dataset === "points" && (
          <Field label="Action">
            <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
              <option value="">All actions</option>
              {POINT_ACTIONS.map((a) => (
                <option key={a} value={a} className="capitalize">{a.replace("_", " ")}</option>
              ))}
            </select>
          </Field>
        )}
        <button
          onClick={download}
          className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-ink"
        >
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </div>
    </div>
  );
}
