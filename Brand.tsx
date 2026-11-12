import { ArrowRight, ExternalLink} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { useContent } from "@/lib/content";

const PARTNERS = ["Mosaic Homes", "Mosaic Royale Estate", "Property Trade", "Pearl Estate · Pyakasa", "Gidan Hutu · Kuje"];

export default function Brand() {
  const c = useContent("brand");
  const ch = useContent("chairman");
  const bio = (ch("chairman.bio") || "").split(/\n\s*\n/).filter(Boolean);
  const photo = ch("chairman.photo");
  return (
    <PublicLayout>
      <section className="night-glow text-ivory relative overflow-hidden">
        <HeroBackdrop src={c("brand.hero.image")} />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="kicker kicker-line">{c("brand.hero.kicker", "The Brain")}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Built for the working class who refuse to{" "}
            <span className="gold-text-grad">stay stuck.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/70">{c("brand.hero.body")}</p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="rounded-3xl bg-ink p-9 text-ivory">
            <span className="rounded-full border border-gold-soft px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
              {c("brand.vision.title", "Our Vision")}
            </span>
            <p className="font-voice mt-6 text-2xl leading-relaxed">{c("brand.vision.body")}</p>
          </div>
          <div className="rounded-3xl bg-champagne p-9">
            <span className="rounded-full border border-gold-soft bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-deep">
              {c("brand.mission.title", "Our Mission")}
            </span>
            <p className="mt-6 text-2xl font-semibold leading-relaxed text-ink">{c("brand.mission.body")}</p>
          </div>
        </div>
      </section>

      <section className="bg-background border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="kicker kicker-line">{c("brand.values.kicker", "What we believe")}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
            Values that carry <span className="gold-text-grad">market weight.</span>
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-7 shadow-sm">
                <span className="gold-bg-grad block h-10 w-10 rounded-xl" />
                <h3 className="mt-5 text-xl font-bold text-ink">{c(`brand.values.${i}.title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c(`brand.values.${i}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* chairman — fully editable from Admin → Site Content (chairman.*) */}
      <section id="chairman" className="night-glow text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="kicker kicker-line">{ch("chairman.kicker", "The Chairman")}</p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[320px_1fr]">
            <div>
              {photo ? (
                <img
                  src={photo}
                  alt={ch("chairman.name", "The Chairman")}
                  className="aspect-[4/5] w-full rounded-3xl border border-gold-soft object-cover shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                />
              ) : (
                <div className="gold-bg-grad flex aspect-[4/5] w-full items-center justify-center rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                  <span className="text-7xl font-black text-ink/70">
                    {(ch("chairman.name", "M E").split(" ").filter((w) => w.length > 2).map((w) => w[0]).slice(0, 2).join("") || "ME")}
                  </span>
                </div>
              )}
              <div className="mt-5 rounded-2xl border border-white/10 bg-ink/60 p-5">
                <p className="text-lg font-extrabold tracking-wide">{ch("chairman.name", "DR. MOSES EGBIREMHON")}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gold">
                  {ch("chairman.role", "Entrepreneur | Real Estate Investor | Business Coach")}
                </p>
                {/* chairman's website — admins set it at Site Content → chairman.website; hidden until then */}
                {/^https?:\/\//i.test(ch("chairman.website")) && (
                  <a
                    href={ch("chairman.website")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold-soft bg-gold/10 px-4 py-2 text-xs font-bold text-gold hover:bg-gold/20"
                  >
                    {ch("chairman.website.label", "Visit his website")} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-5">
              {bio.length > 0 ? (
                bio.map((para, i) => (
                  <p key={i} className={`leading-relaxed ${i === 0 ? "font-voice text-xl text-ivory sm:text-2xl" : "text-sm text-ivory/70 sm:text-base"}`}>
                    {para}
                  </p>
                ))
              ) : (
                <p className="text-sm text-ivory/60">The chairman's bio is being prepared.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="leadership" className="bg-champagne/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="kicker kicker-line">{c("brand.leadership.kicker", "Leadership")}</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
              The vision of <span className="font-voice gold-text-grad">Dr Moses.</span>
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink/70">{c("brand.leadership.body")}</p>
            <a href="#chairman" className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-bold text-ivory hover:bg-panel">
              Meet the chairman <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <figure className="rounded-3xl bg-ink p-9 text-ivory">
            <blockquote className="font-voice text-xl leading-relaxed">
              “5 years ago someone introduced me to sales. When I sold the property and got commission, I was overwhelmed. Join our club10 community and liberate yourself through commission.”
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="gold-bg-grad h-11 w-11 rounded-full" />
              <div>
                <p className="text-sm font-bold">Maureen Ekwealor</p>
                <p className="text-xs text-ivory/50">Club10 Realtor</p>
              </div>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <p className="kicker">{c("brand.partners.kicker", "Backed by")}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">
            A development house <span className="gold-text-grad">behind every listing.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {PARTNERS.map((p, i) => (
              <span
                key={p}
                className={`rounded-full border px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest ${
                  i > 2 ? "border-emerald-brand/40 bg-emerald-brand/10 text-emerald-brand" : "border-gold-soft bg-champagne text-gold-deep"
                }`}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
