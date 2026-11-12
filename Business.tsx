import { Link } from "react-router";
import { useState } from "react";
import { ArrowRight, Crown } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { ProductCard } from "@/components/business/ProductCard";
import { CommissionCalculator } from "@/components/business/CommissionCalculator";
import { CatalogueFilters, type CatalogueFilter } from "@/components/business/CatalogueFilters";
import { useContent } from "@/lib/content";
import { trpc } from "@/providers/trpc";
import { points, CATEGORY_LABEL } from "@/lib/format";
import { POINT_LEVELS, levelForPoints } from "@/lib/levels";

export default function Business() {
  const c = useContent("business");
  const [filter, setFilter] = useState<CatalogueFilter>({});
  const { data: products } = trpc.catalog.products.useQuery(filter);
  const { data: board } = trpc.points.pointsLeaderboard.useQuery();
  const { data: race } = trpc.points.recruitmentLeaderboard.useQuery();
  const { data: rewardList } = trpc.points.rewards.useQuery();

  return (
    <PublicLayout>
      {/* hero */}
      <section className="night-glow text-ivory relative overflow-hidden">
        <HeroBackdrop src={c("business.hero.image")} />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="kicker kicker-line">{c("business.hero.kicker", "The Business")}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Products to sell. An engine that pays.{" "}
            <span className="gold-text-grad">A community that rises.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/70">{c("business.hero.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              ["① Products", "#catalogue"],
              ["② The Engine", "#engine"],
              ["③ Community", "#community"],
              ["④ Rewards", "#rewards"],
            ].map(([label, href], i) => (
              <a
                key={href}
                href={href}
                className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
                  i === 0 ? "gold-bg-grad text-ink" : "border border-ivory/25 text-ivory hover:border-gold hover:text-gold"
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* catalogue */}
      <section id="catalogue" className="bg-background scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker kicker-line">{c("business.catalogue.kicker", "The Catalogue")}</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
                Every product for sale, <span className="gold-text-grad">in one place.</span>
              </h2>
            </div>
            <span className="rounded-full border border-emerald-brand/40 bg-emerald-brand/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-brand">
              Verified listings · live availability
            </span>
          </div>
          <div className="mt-7">
            <CatalogueFilters value={filter} onChange={setFilter} />
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(products ?? []).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          {(products ?? []).length === 0 && (
            <p className="mt-8 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              No products match this location yet — try widening the filter.
            </p>
          )}
          <p className="mt-6 rounded-xl bg-muted px-5 py-4 text-sm text-muted-foreground">
            <strong className="text-ink">Fresh stock:</strong> new estates, houses and plots are added regularly with price, location, title status and photos — the catalogue, the commission engine and every member's Marketing Studio guide update instantly.
          </p>
        </div>
      </section>

      {/* engine */}
      <section id="engine" className="bg-champagne/60 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="kicker kicker-line">{c("business.engine.kicker", "The Engine")}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
            Pick a property. <span className="gold-text-grad">The math does itself.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">{c("business.engine.body")}</p>
          <div className="mt-8">
            <CommissionCalculator />
          </div>
          <div className="mt-8 rounded-2xl bg-emerald-brand p-6 text-ivory sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <h3 className="shrink-0 text-lg font-bold">How it posts</h3>
              <p className="text-sm leading-relaxed text-ivory/85">{c("business.engine.posting")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* community */}
      <section id="community" className="bg-panel text-ivory scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <p className="kicker">{c("business.community.kicker", "The Community")}</p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
              Equity points — <span className="gold-text-grad">they behave like shares.</span>
            </h2>
            <span className="mt-5 inline-block rounded-full border border-gold-soft bg-gold/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold">
              Elite membership only
            </span>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ivory/60">{c("business.community.body")}</p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {POINT_LEVELS.slice(0, 5).map((l) => (
              <div key={l.level} className="card-glass-dark rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="kicker">Level {l.level}</span>
                  <span className="text-[11px] text-ivory/40">{l.pts.toLocaleString()} pts</span>
                </div>
                <h3 className="mt-3 text-xl font-extrabold">{l.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-ivory/50">{l.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {POINT_LEVELS.slice(5).map((l) => (
              <div
                key={l.level}
                className={`rounded-2xl p-5 ${l.level === 10 ? "gold-bg-grad text-ink" : "card-glass-dark"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-[0.25em] ${l.level === 10 ? "text-ink/70" : "text-gold"}`}>
                    Level {l.level}
                  </span>
                  <span className={`text-[11px] ${l.level === 10 ? "text-ink/60" : "text-ivory/40"}`}>{l.pts.toLocaleString()} pts</span>
                </div>
                <h3 className="mt-3 text-xl font-extrabold">{l.name}</h3>
                <p className={`mt-2 text-xs leading-relaxed ${l.level === 10 ? "text-ink/70" : "text-ivory/50"}`}>{l.note}</p>
              </div>
            ))}
          </div>

          {/* leaderboards */}
          <div className="mt-14 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="text-2xl font-black sm:text-3xl">Ranked, every week.</h3>
              <p className="mt-4 text-sm leading-relaxed text-ivory/60">{c("business.ranked.body")}</p>
              <div className="mt-6 flex gap-2">
                {["Weekly leaderboard", "Season rankings", "Apex honours"].map((t, i) => (
                  <span key={t} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${i === 1 ? "border-emerald-brand/40 text-emerald-300" : "border-gold-soft text-gold"}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="card-glass-dark rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h4 className="font-bold">Points leaderboard</h4>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Live</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {(board ?? []).slice(0, 5).map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl bg-ink/50 px-4 py-3">
                    <span className="w-5 text-xs font-extrabold text-ivory/40">{i + 1}</span>
                    <span className={`h-8 w-8 rounded-full ${i === 0 ? "gold-bg-grad" : "bg-card-dark border border-white/10"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-bold">{r.firstName} {r.lastName}</p>
                      <p className="text-[11px] text-ivory/50">{levelForPoints(r.points ?? 0).name} · Level {levelForPoints(r.points ?? 0).level}</p>
                    </div>
                    <span className="text-sm font-extrabold text-gold">{points(r.points)}</span>
                  </div>
                ))}
                {(board ?? []).length === 0 && (
                  <p className="rounded-xl bg-ink/50 px-4 py-6 text-center text-sm text-ivory/50">
                    Rankings appear as Elite members start earning points.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* recruiter race */}
          <div className="mt-14 grid gap-10 lg:grid-cols-2">
            <div>
              <p className="kicker kicker-line">Recruiter of the week</p>
              <h3 className="mt-4 text-2xl font-black sm:text-3xl">
                One crown. <span className="gold-text-grad">Pro & Elite only.</span>
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-ivory/60">{c("business.race.body")}</p>
              <div className="mt-6 flex gap-2">
                <span className="rounded-full border border-gold-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold">Resets every Monday</span>
                <span className="rounded-full border border-emerald-brand/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">Visible to all members</span>
              </div>
            </div>
            <div className="card-glass-dark rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h4 className="font-bold">This week's race</h4>
                <Crown className="h-5 w-5 text-gold" />
              </div>
              <div className="mt-4 space-y-2.5">
                {(race ?? []).slice(0, 4).map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl bg-ink/50 px-4 py-3">
                    <span className="w-5 text-xs font-extrabold text-ivory/40">{i + 1}</span>
                    <span className={`h-8 w-8 rounded-full ${i === 0 ? "gold-bg-grad" : "bg-card-dark border border-white/10"}`} />
                    <p className="flex-1 text-sm font-bold">
                      {r.firstName} {r.lastName}
                      <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold">
                        {CATEGORY_LABEL[r.category]}
                      </span>
                    </p>
                    <span className="text-sm font-extrabold text-gold">{Number(r.joins)} joins</span>
                  </div>
                ))}
                {(race ?? []).length === 0 && (
                  <p className="rounded-xl bg-ink/50 px-4 py-6 text-center text-sm text-ivory/50">
                    The race resets every Monday — the first joins of the week set the pace.
                  </p>
                )}
                <p className="rounded-xl border border-dashed border-gold-soft px-4 py-3 text-center text-xs text-gold/80">
                  Basic members — upgrade to Pro to enter the race →
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* rewards */}
      <section id="rewards" className="bg-background scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="kicker kicker-line">{c("business.rewards.kicker", "The Rewards")}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-black tracking-tight text-ink sm:text-5xl">
              Points become <span className="gold-text-grad">gadgets & gifts.</span>
            </h2>
            <div className="flex gap-2">
              <span className="rounded-full border border-gold-soft bg-champagne px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-deep">Redeemable by Elite members</span>
              <span className="rounded-full border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Catalogue restocked monthly</span>
            </div>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-3xl font-black text-gold">0{i}</p>
                <h3 className="mt-3 text-lg font-bold text-ink">{c(`business.rewards.${i}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c(`business.rewards.${i}.body`)}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(rewardList ?? []).map((r) => (
              <div key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-[#c9a227]/60 via-[#a8842b]/40 to-[#7c6117]/50">
                  <span className="text-4xl font-black text-ink/20">{r.name[0]}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-ink">{r.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                  <p className="mt-3 text-sm font-extrabold text-gold-deep">{points(r.pointCost)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-3xl night-glow p-10 text-center text-ivory sm:p-14">
            <h2 className="text-2xl font-black sm:text-4xl">
              The engine is excellent. <span className="gold-text-grad">Become one of its drivers.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-ivory/60">{c("business.cta.sub")}</p>
            <Link to="/join" className="gold-bg-grad mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-ink">
              Join Club 10 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
