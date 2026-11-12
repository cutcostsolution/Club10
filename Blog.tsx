import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useContent } from "@/lib/content";
import { trpc } from "@/providers/trpc";
import { SocialIcons } from "@/components/SocialIcons";

const THEMES: Record<string, string> = {
  dark: "from-[#1d1d24] to-[#0b0b0d]",
  gold: "from-[#c9a227]/70 via-[#a8842b]/50 to-[#7c6117]/60",
  green: "from-[#155e4b] to-[#0b2e26]",
};

export default function Blog() {
  const c = useContent("blog");
  const { data: posts } = trpc.blog.list.useQuery();

  return (
    <PublicLayout>
      <section className="night-glow text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="kicker kicker-line">{c("blog.hero.kicker", "The Blog")}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            {c("blog.hero.title", "Notes from the field.")}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/70">
            {c("blog.hero.body")}
          </p>
          <div className="mt-8">
            <SocialIcons dark />
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          {(posts ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center text-sm text-muted-foreground">
              First articles are on their way — check back shortly.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(posts ?? []).map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`relative flex h-36 items-end overflow-hidden bg-gradient-to-br p-4 ${THEMES[p.coverTheme ?? "gold"] ?? THEMES.gold}`}>
                    {(p as { coverImage?: string | null }).coverImage && (
                      <>
                        <img
                          src={(p as { coverImage?: string | null }).coverImage!}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* transparent overlay so the badge stays readable over any photo */}
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/25 to-transparent" />
                      </>
                    )}
                    <span className="relative rounded-full border border-gold-soft bg-ink/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold backdrop-blur">
                      Club 10 Blog
                    </span>
                  </div>
                  <div className="p-6">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    </p>
                    <h2 className="mt-2 text-lg font-bold leading-snug text-ink group-hover:text-gold-deep">{p.title}</h2>
                    {p.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.excerpt}</p>}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-deep">
                      Read <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
