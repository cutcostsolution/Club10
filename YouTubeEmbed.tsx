import { youtubeEmbedUrl } from "@/lib/youtube";

/**
 * Responsive 16:9 YouTube embed. Renders nothing when the link is empty or
 * not a recognisable YouTube URL — safe to drop anywhere.
 */
export function YouTubeEmbed({ url, title, className = "" }: { url?: string | null; title: string; className?: string }) {
  const embed = youtubeEmbedUrl(url);
  if (!embed) return null;
  return (
    <div className={`overflow-hidden rounded-2xl border border-border shadow-sm ${className}`}>
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        <iframe
          src={embed}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
}
