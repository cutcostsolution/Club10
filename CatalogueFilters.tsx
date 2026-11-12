import { trpc } from "@/providers/trpc";

export type CatalogueFilter = {
  categoryId?: number;
  country?: string;
  state?: string;
};

const selectCls =
  "rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-gold";

/** Category + country + state filters, driven by what's actually in the live catalogue. */
export function CatalogueFilters({
  value,
  onChange,
  dark,
}: {
  value: CatalogueFilter;
  onChange: (v: CatalogueFilter) => void;
  dark?: boolean;
}) {
  const { data: categories } = trpc.catalog.categories.useQuery();
  const { data: locations } = trpc.catalog.locations.useQuery();

  const states =
    value.country
      ? locations?.find((l) => l.country === value.country)?.states ?? []
      : [...new Set((locations ?? []).flatMap((l) => l.states))];

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${dark ? "[&>select]:bg-ink [&>select]:text-ivory [&>select]:border-white/15" : ""}`}>
      <select
        className={selectCls}
        value={value.categoryId ?? ""}
        onChange={(e) => onChange({ ...value, categoryId: e.target.value ? Number(e.target.value) : undefined })}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {(categories ?? []).map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>
      <select
        className={selectCls}
        value={value.country ?? ""}
        onChange={(e) => onChange({ ...value, country: e.target.value || undefined, state: undefined })}
        aria-label="Filter by country"
      >
        <option value="">All countries</option>
        {(locations ?? []).map((l) => (
          <option key={l.country} value={l.country}>{l.country}</option>
        ))}
      </select>
      <select
        className={selectCls}
        value={value.state ?? ""}
        onChange={(e) => onChange({ ...value, state: e.target.value || undefined })}
        aria-label="Filter by state"
      >
        <option value="">All states</option>
        {states.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {(value.categoryId || value.country || value.state) && (
        <button
          onClick={() => onChange({})}
          className="rounded-full border border-gold-soft px-3.5 py-2 text-xs font-bold text-gold-deep hover:bg-champagne"
        >
          Clear
        </button>
      )}
    </div>
  );
}
