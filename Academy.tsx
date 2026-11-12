import { Link } from "react-router";
import { ArrowRight, Lock } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { useContent } from "@/lib/content";
import { trpc } from "@/providers/trpc";

const TIERS = [
  { levels: "Levels 1–3", name: "Starter tiers", body: "Grounding for new realtors — product knowledge, first conversations, first closing.", courses: "B1 — The Foundation Realtor" },
  { levels: "Levels 4–6", name: "Builder tiers", body: "For realtors who are closing and building a team — the digital and closing depth.", courses: "P1 · P2 · P3 — the Pro library" },
  { levels: "Levels 7–9", name: "Leader tiers", body: "For leaders running networks — recruitment systems, leadership and portfolio play.", courses: "E1 · E2 · E3 — the Elite library" },
  { levels: "Level 10", name: "The Apex", body: "The highest level of the community — the Chairman's circle, first access, deepest exposure.", courses: "X1 · X2 · X3 · X4 — the Executive library" },
];

export default function Academy() {
  const c = useContent("academy");
  const { data } = trpc.academy.publicOverview.useQuery();

  return (
    <PublicLayout>
      <section className="night-glow text-ivory relative overflow-hidden">
        <HeroBackdrop src={c("academy.hero.image")} />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="kicker kicker-line">{c("academy.hero.kicker", "The Academy")}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            A training system that <span className="gold-text-grad">grows with your level.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/70">{c("academy.hero.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/join" className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-ink">
              Register to unlock training <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#levels" className="inline-flex items-center gap-2 rounded-full border border-ivory/25 px-6 py-3.5 text-sm font-semibold text-ivory hover:border-gold hover:text-gold">
              See how levels unlock
            </a>
          </div>
        </div>
      </section>

      <section id="levels" className="bg-panel text-ivory scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <p className="kicker">{c("academy.levels.kicker", "Level-based training exposure")}</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
              Your level is your <span className="gold-text-grad">classroom.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-ivory/60">{c("academy.levels.body")}</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t, i) => (
              <div key={t.name} className={`rounded-2xl p-6 ${i === 3 ? "gold-bg-grad text-ink" : "card-glass-dark"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-extrabold ${i === 3 ? "text-ink/70" : "text-ivory/60"}`}>{t.levels}</span>
                  <span className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${i === 3 ? "bg-ink/15 text-ink" : "bg-gold/10 text-gold border border-gold-soft"}`}>
                    {t.name}
                  </span>
                </div>
                <p className={`mt-4 text-sm leading-relaxed ${i === 3 ? "text-ink/80" : "text-ivory/70"}`}>{t.body}</p>
                <p className={`mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${i === 3 ? "text-ink" : "text-gold"}`}>
                  <Lock className="h-3 w-3" /> {t.courses}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="kicker kicker-line">{c("academy.example.kicker", "An example from inside")}</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
              This is what a course <span className="gold-text-grad">feels like.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">{c("academy.example.body")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-gold-soft bg-champagne px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-deep">Short lessons</span>
              <span className="rounded-full border border-gold-soft bg-champagne px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-deep">Tool in every lesson</span>
              <span className="rounded-full border border-emerald-brand/40 bg-emerald-brand/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-brand">20-question exam · 60% pass</span>
            </div>
          </div>
          {data?.example && (
            <div className="rounded-3xl bg-panel p-8 text-ivory">
              <div className="flex items-center justify-between">
                <span className="kicker">Example course</span>
                <span className="text-xs text-ivory/50">{data.exampleLesson ? "" : ""}18 lessons</span>
              </div>
              <h3 className="mt-4 text-2xl font-extrabold">{data.example.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ivory/60">{data.example.tagline}</p>
              {data.exampleLesson && (
                <div className="mt-6 rounded-2xl bg-ink/60 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
                    Lesson {data.exampleLesson.code} · example
                  </p>
                  <h4 className="mt-2 text-lg font-bold">{data.exampleLesson.title}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-ivory/50">
                    {data.exampleLesson.minutes}-min read · {data.exampleLesson.outcome}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="bg-champagne/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="kicker kicker-line">{c("academy.model.kicker", "The lesson model")}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
            Built for the <span className="font-voice gold-text-grad">busy professional.</span>
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {["A", "B", "C", "D"].map((letter, i) => (
              <div key={letter} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-3xl font-black text-gold">{letter}</p>
                <h3 className="mt-3 text-lg font-bold text-ink">{c(`academy.model.${i + 1}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c(`academy.model.${i + 1}.body`)}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link to="/join" className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-bold text-ivory transition-transform hover:scale-[1.03]">
              Start with B1 — free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
