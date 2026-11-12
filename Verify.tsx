import { useState } from "react";
import { useSearchParams } from "react-router";
import { ShieldCheck, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { trpc } from "@/providers/trpc";
import { fmtDate } from "@/lib/format";

export default function Verify() {
  const [params] = useSearchParams();
  const initial = (params.get("code") ?? "").trim().toUpperCase();
  const [code, setCode] = useState(initial);
  const [query, setQuery] = useState(initial);
  const { data, isFetching } = trpc.academy.verifyCertificate.useQuery(
    { code: query },
    { enabled: query.length >= 4, retry: false }
  );

  return (
    <PublicLayout>
      <section className="night-glow text-ivory">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <ShieldCheck className="mx-auto h-10 w-10 text-gold" />
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
            Verify a <span className="gold-text-grad">certificate.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-ivory/60">
            Every Club 10 certificate carries a verification code. Enter it to confirm the holder, the course and the date.
          </p>
          <form
            className="mt-8 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(code.trim().toUpperCase());
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. C10-8F3K2"
              className="flex-1 rounded-full border border-ivory/25 bg-ink/60 px-5 py-3.5 text-sm text-ivory outline-none placeholder:text-ivory/40 focus:border-gold"
            />
            <button type="submit" className="gold-bg-grad rounded-full px-6 py-3.5 text-sm font-bold text-ink">
              Verify
            </button>
          </form>

          {isFetching && <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-gold" />}
          {query && !isFetching && (
            data?.valid ? (
              <div className="card-glass-dark mt-8 rounded-2xl p-7 text-left">
                <div className="flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm font-bold uppercase tracking-wide">Verified certificate</span>
                </div>
                <p className="mt-4 text-xl font-extrabold">{data.member}</p>
                <p className="mt-1 text-sm text-ivory/70">{data.title}</p>
                <p className="mt-1 text-xs text-ivory/50">Issued {fmtDate(data.issuedAt)} · Code {query}</p>
              </div>
            ) : (
              <p className="mt-8 rounded-xl bg-red-500/15 px-5 py-3.5 text-sm font-semibold text-red-300">
                No certificate matches that code. Check the code and try again.
              </p>
            )
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
