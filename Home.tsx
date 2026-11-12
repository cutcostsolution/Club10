import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { ProductCard } from "@/components/business/ProductCard";
import { Leaderboards } from "@/components/business/Leaderboards";
import { useContent } from "@/lib/content";
import { trpc } from "@/providers/trpc";

export default function Home() {
  const c = useContent("home");
  const { data: products } = trpc.catalog.products.useQuery();
  const { data: overview } = trpc.academy.publicOverview.useQuery();

  const stats = [1, 2, 3, 4].map((i) => {
    const [v, l] = c(`home.hero.stat${i}`, "").split("|");
    return v ? { v, l } : null;
  }).filter(Boolean) as Array<{ v: string; l: string }>;

  return (
    <PublicLayout>
      {/* ---------- hero ---------- */}
      <section className="night-glow text-ivory relative overflow-hidden">
        <HeroBackdrop src={c("home.hero.image")} />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pt-20">
          <div>
            <p className="kicker kicker-line">{c("home.hero.kicker", "The Real Estate Sales Hub")}</p>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Learn real estate. Get guided daily.{" "}
              <span className="gold-text-grad">Get paid — through ten levels.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ivory/70">
              {c("home.hero.sub")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/join" className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-ink shadow-[0_6px_28px_rgba(168,132,43,0.4)] transition-transform hover:scale-[1.03]">
                Join Club 10 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/business" className="inline-flex items-center gap-2 rounded-full border border-ivory/25 px-6 py-3.5 text-sm font-semibold text-ivory transition-colors hover:border-gold hover:text-gold">
                See the business
              </Link>
            </div>
          </div>

          {/* guide card mock */}
          <div className="card-glass-dark hidden rounded-3xl p-6 lg:block">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Good morning, Realtor</p>
              <span className="rounded-full border border-gold-soft bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
                Level 4 · Gold
              </span>
            </div>
            <div className="mt-5 rounded-2xl bg-ink/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Today's AI guide</p>
              <ul className="mt-3 space-y-2 text-sm text-ivory/80">
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-brand" /> Follow up 3 Pearl Estate leads</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-brand" /> Post the Gidan Hutu virtual tour</li>
                <li className="flex gap-2"><span className="mt-0.5 h-4 w-4 rounded-full border border-ivory/30" /> Book 2 inspections this week</li>
              </ul>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-ink/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/50">This month</p>
                <p className="mt-1 text-xl font-extrabold gold-text-grad">₦1.44m</p>
              </div>
              <div className="rounded-2xl bg-ink/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/50">Equity points</p>
                <p className="mt-1 text-xl font-extrabold text-ivory">12,480</p>
              </div>
            </div>
          </div>
        </div>

        {stats.length > 0 && (
          <div className="relative border-t border-white/5">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4 sm:px-6">
              {stats.map((s) => (
                <div key={s.l}>
                  <p className="text-3xl font-black text-gold">{s.v}</p>
                  <p className="mt-1 text-xs text-ivory/60">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---------- three walls ---------- */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker kicker-line">{c("home.walls.kicker", "Why people stall")}</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
                Three walls. <span className="font-voice gold-text-grad">One way through.</span>
              </h2>
            </div>
            <Link to="/brand" className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-ivory hover:bg-panel">
              The full story <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-7 shadow-sm">
                <p className="kicker">Wall 0{i}</p>
                <h3 className="mt-3 text-xl font-bold text-ink">{c(`home.walls.${i}.title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c(`home.walls.${i}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="bg-champagne/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="kicker kicker-line">{c("home.how.kicker", "How it works")}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
            From first login to <span className="gold-text-grad">first payment.</span>
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-3xl font-black text-gold">0{i}</p>
                <h3 className="mt-3 text-lg font-bold text-ink">{c(`home.how.${i}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c(`home.how.${i}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- products ---------- */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker kicker-line">{c("home.products.kicker", "The Business · Products")}</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
                Real products. <span className="gold-text-grad">Right now.</span>
              </h2>
            </div>
            <Link to="/business" className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-ivory hover:bg-panel">
              Open the catalogue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(products ?? []).slice(0, 4).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Partners upload new estates from the back-office — the catalogue updates the moment a listing goes live.
          </p>
        </div>
      </section>

      {/* ---------- academy preview ---------- */}
      <section className="bg-panel text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker kicker-line">{c("home.academy.kicker", "The Academy")}</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                Taught, not just <span className="gold-text-grad">onboarded.</span>
              </h2>
            </div>
            <Link to="/academy" className="gold-bg-grad inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-ink">
              Explore the Academy <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {(overview?.courses ?? []).slice(0, 4).map((course, i) => (
              <div key={course.id} className="card-glass-dark rounded-2xl p-7">
                <div className="flex items-center justify-between">
                  <span className="kicker">Course {course.code}</span>
                  <span className="text-xs text-ivory/50">{course.lessonCount} lessons</span>
                </div>
                <h3 className="mt-4 text-xl font-bold">{course.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ivory/60">{course.tagline}</p>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-gold/70">
                  {["Foundation", "Builder", "Leader", "Apex"][Math.min(i, 3)]} tier · {course.category}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- points + leaderboard ---------- */}
      <section className="bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <div className="flex gap-2">
              <span className="kicker kicker-line">{c("home.points.kicker", "Community & Points")}</span>
            </div>
            <span className="mt-3 inline-block rounded-full border border-gold-soft bg-champagne px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-deep">
              Pro members & above
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
              Points that behave <span className="font-voice gold-text-grad">like shares.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">{c("home.points.body")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/business#community" className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-ivory hover:bg-panel">
                How points work <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/business#rewards" className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink hover:border-gold">
                See the store
              </Link>
            </div>
          </div>
          <Leaderboards dark />
        </div>
      </section>

      {/* ---------- engine strip ---------- */}
      <section className="night-glow text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <p className="kicker">The Business · The Engine</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
            One sale moves money <span className="gold-text-grad">through ten levels.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-ivory/60">{c("home.engine.body")}</p>
          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
            <div className="card-glass-dark rounded-2xl p-7 text-left">
              <span className="kicker">Land · 10% direct</span>
              <p className="mt-3 text-3xl font-black text-gold">₦1,000,000</p>
              <p className="mt-1 text-sm text-ivory/50">Direct commission on one ₦10m land sale.</p>
            </div>
            <div className="card-glass-dark rounded-2xl p-7 text-left">
              <span className="kicker">House · 3% direct</span>
              <p className="mt-3 text-3xl font-black text-gold">₦1,500,000</p>
              <p className="mt-1 text-sm text-ivory/50">Direct commission on one ₦50m house sale.</p>
            </div>
          </div>
          <Link to="/business#engine" className="gold-bg-grad mt-10 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-ink">
            See the full business <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ---------- testimonials ---------- */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="kicker kicker-line">{c("home.testimonials.kicker", "Testimonies")}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
            Members, <span className="font-voice gold-text-grad">in their own words.</span>
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <figure key={i} className="rounded-2xl border border-border bg-card p-7 shadow-sm">
                <blockquote className="font-voice text-[15px] leading-relaxed text-gold-deep">
                  “{c(`home.testimonial.${i}.quote`)}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="gold-bg-grad h-9 w-9 rounded-full" />
                  <div>
                    <p className="text-sm font-bold text-ink">{c(`home.testimonial.${i}.name`)}</p>
                    <p className="text-xs text-muted-foreground">{c(`home.testimonial.${i}.role`)}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className="bg-champagne">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-black tracking-tight text-ink sm:text-5xl">
            {c("home.cta.headline", "Your seat in the club is open.")}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-ink/60">{c("home.cta.sub")}</p>
          <Link to="/join" className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-bold text-ivory transition-transform hover:scale-[1.03]">
            Join Now & Start Earning <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
