import { MessageCircle } from "lucide-react";
import { useContent } from "@/lib/content";

/** Floating WhatsApp button — number editable from Admin → Site Content (global.whatsapp.number). */
export function WhatsAppFloat() {
  const c = useContent("global");
  const number = (c("global.whatsapp.number", "2349019857226") || "2349019857226").replace(/[^0-9]/g, "");
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent("Hello Club 10, I need assistance.")}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Club 10 on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition-transform hover:scale-110"
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" />
    </a>
  );
}
