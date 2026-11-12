import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { naira } from "@/lib/format";

type Product = {
  id: number;
  name: string;
  tag: string | null;
  location: string | null;
  country?: string | null;
  state?: string | null;
  price: number;
  priceLabel: string | null;
  imageUrl?: string | null;
  imageTheme: string | null;
  effectivePct?: number;
  status: string;
};

const THEMES: Record<string, string> = {
  dark: "from-[#1d1d24] to-[#0b0b0d]",
  gold: "from-[#c9a227]/70 via-[#a8842b]/50 to-[#7c6117]/60",
  green: "from-[#155e4b] to-[#0b2e26]",
};

export function ProductCard({ p, action = "kit" }: { p: Product; action?: "kit" | "none" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className={`relative h-40 bg-gradient-to-br ${THEMES[p.imageTheme ?? "gold"] ?? THEMES.gold}`}>
        {p.imageUrl && (
          <img src={p.imageUrl} alt={p.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        )}
        <span className="absolute bottom-3 left-3 rounded-full border border-gold-soft bg-ink/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold backdrop-blur">
          {p.tag ?? "Property"}
        </span>
        {p.status === "coming_soon" && (
          <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            Coming soon
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-ink">{p.name}</h3>
            <p className="text-sm text-muted-foreground">{p.location}</p>
            {(p.state || p.country) && (
              <p className="mt-1 inline-flex rounded-full bg-champagne px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-deep">
                {[p.state, p.country].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-extrabold text-gold-deep">{p.priceLabel ?? naira(p.price)}</span>
          {action === "kit" && (
            <Link to="/join" className="inline-flex items-center gap-1 text-sm font-semibold text-ink hover:text-gold-deep">
              Get selling kit <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
