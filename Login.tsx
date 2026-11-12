import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const afterAuth = async (role?: string | null) => {
    await utils.invalidate();
    navigate(role === "admin" ? "/admin" : "/app");
  };

  const login = trpc.auth.login.useMutation({ onSuccess: (r) => afterAuth(r.role) });

  const [form, setForm] = useState({ identifier: "", password: "" });
  const busy = login.isPending;
  const error = login.error;

  if (isAuthenticated) {
    afterAuth((user as { role?: string } | null)?.role);
    return null;
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-sm outline-none focus:border-gold";

  return (
    <PublicLayout>
      <section className="night-glow text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="kicker kicker-line">Welcome back</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Sign in to <span className="gold-text-grad">Club 10.</span>
          </h1>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
          
            <form
              className="rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-8"
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate({ identifier: form.identifier, password: form.password });
              }}
            >
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email or phone
                </span>
                <input
                  required
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder="you@example.com or 0803…"
                  className={inputCls}
                />
              </label>
              <label className="mt-4 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Password
                </span>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputCls}
                />
              </label>
              {error && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{error.message}</p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="gold-bg-grad mt-6 flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-ink disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Sign in
              </button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                New here?{" "}
                <Link to="/join" className="font-bold text-gold-deep hover:underline">
                  Create an account
                </Link>
              </p>
            </form>
        </div>
      </section>
    </PublicLayout>
  );
}
