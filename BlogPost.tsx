import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, MessageCircle, PlayCircle } from "lucide-react";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { trpc } from "@/providers/trpc";
import { SocialIcons } from "@/components/SocialIcons";
import { useContent } from "@/lib/content";

export default function BlogPost() {
  const { slug = "" } = useParams();
  const { data: post, isLoading, error } = trpc.blog.get.useQuery({ slug });
  const g = useContent("global");
  const whatsapp = (g("global.whatsapp.number", "2349019857226") || "").replace(/[^0-9]/g, "");
  const enquiryUrl = post ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello Club 10 — I'd like to make an enquiry about your article "${post.title}": ${window.location.href}`)}` : "#";

  return (
    <PublicLayout>
      <section className="night-glow text-ivory">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-ivory/60 hover:text-gold">
            <ArrowLeft className="h-4 w-4" /> All articles
          </Link>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
          ) : error || !post ? (
            <h1 className="mt-8 text-3xl font-black">Article not found.</h1>
          ) : (
            <>
              <p className="mt-8 text-[11px] font-bold uppercase tracking-widest text-gold">
                {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : ""}
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
              {post.excerpt && <p className="font-voice mt-5 text-xl leading-relaxed text-ivory/70">{post.excerpt}</p>}
              {(post as { coverImage?: string | null }).coverImage && (
                <img
                  src={(post as { coverImage?: string | null }).coverImage!}
                  alt={post.title}
                  className="mt-8 w-full rounded-2xl object-cover"
                />
              )}
            </>
          )}
        </div>
      </section>
      {post && (
        <section className="bg-background">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-14 sm:px-6">
            {(post.body ?? "").split(/\n\s*\n/).filter(Boolean).map((para, i) => (
              <p key={i} className="text-base leading-relaxed text-ink/80">{para}</p>
            ))}
            {post.videoUrl && (
              <div className="pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <PlayCircle className="h-3.5 w-3.5 text-[#a8842b]" /> Watch the video
                </p>
                <YouTubeEmbed url={post.videoUrl} title={post.title} />
              </div>
            )}
            <div className="mt-10 rounded-3xl night-glow p-8 text-center text-ivory">
              <h2 className="text-xl font-black sm:text-2xl">Learn · Get guided · Get paid.</h2>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link to="/join" className="gold-bg-grad inline-block rounded-full px-7 py-3 text-sm font-bold text-ink">
                  Join Club 10
                </Link>
                <a
                  href={enquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/60 px-6 py-3 text-sm font-bold text-[#4be07f] hover:bg-[#25D366]/10"
                >
                  <MessageCircle className="h-4 w-4" /> Enquire about this post
                </a>
              </div>
              <div className="mt-6 flex justify-center">
                <SocialIcons dark />
              </div>
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
