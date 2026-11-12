import { Instagram, Facebook, Linkedin, Youtube, Twitter, MessageCircle, Music2 } from "lucide-react";
import { useContent } from "@/lib/content";

/**
 * Brand social platforms as icon buttons — driven by the CMS keys
 * global.social.* (editable at Admin → Site Content). Hidden while unset.
 */
export function SocialIcons({ dark, size = "md" }: { dark?: boolean; size?: "sm" | "md" }) {
  const c = useContent("global");
  const socials: Array<{ name: string; url: string; Icon: typeof Instagram }> = [
    { name: "Instagram", url: c("global.social.instagram"), Icon: Instagram },
    { name: "WhatsApp", url: c("global.social.whatsapp"), Icon: MessageCircle },
    { name: "LinkedIn", url: c("global.social.linkedin"), Icon: Linkedin },
    { name: "Facebook", url: c("global.social.facebook"), Icon: Facebook },
    { name: "X", url: c("global.social.x"), Icon: Twitter },
    { name: "YouTube", url: c("global.social.youtube"), Icon: Youtube },
    { name: "TikTok", url: c("global.social.tiktok"), Icon: Music2 },
  ];
  const live = socials.filter((s) => s.url && /^https?:\/\//i.test(s.url));
  if (!live.length) return null;
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {live.map(({ name, url, Icon }) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Club 10 on ${name}`}
          aria-label={`Club 10 on ${name}`}
          className={`flex ${box} items-center justify-center rounded-full border transition-all hover:scale-105 ${
            dark
              ? "border-gold-soft bg-gold/10 text-gold hover:bg-gold hover:text-ink"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-gold hover:text-gold-deep"
          }`}
        >
          <Icon className={icon} />
        </a>
      ))}
    </div>
  );
}
