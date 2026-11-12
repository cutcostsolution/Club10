import { trpc } from "@/providers/trpc";
import { Download, ExternalLink, FileText, PackageOpen } from "lucide-react";

export default function StarterKit() {
  const { data: resources, isLoading } = trpc.member.starterKit.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-2">Welcome aboard</p>
        <h1 className="text-3xl font-black text-ink">Your Starter Kit</h1>
        <p className="text-neutral-500 mt-1">
          Everything you need to hit the ground running — scripts, presentations, forms and guides from the club.
        </p>
      </div>

      {!resources || resources.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center">
          <PackageOpen className="w-10 h-10 mx-auto text-[#a8842b]/50 mb-3" />
          <p className="font-bold text-ink">Your starter kit is being prepared</p>
          <p className="text-sm text-neutral-400 mt-1">The club uploads your onboarding materials here — check back shortly after approval.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((r) => (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              download={r.kind === "file" ? true : undefined}
              className="group rounded-2xl border border-neutral-200 bg-white p-5 hover:border-[#a8842b]/60 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <span className="shrink-0 w-11 h-11 rounded-xl bg-[#faf6ec] border border-[#e9dcbb] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#a8842b]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink group-hover:text-[#a8842b] transition-colors">{r.title}</p>
                  {r.description && <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{r.description}</p>}
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-gold-deep">
                    {r.kind === "file" ? (
                      <>
                        <Download className="w-3.5 h-3.5" /> Download
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" /> Open link
                      </>
                    )}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
