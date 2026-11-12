import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Check, Eye, EyeOff, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useContent } from "@/lib/content";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { naira } from "@/lib/format";
import { BankTransferCard } from "@/components/business/BankTransferCard";
import { captureRef, getStoredRef, referralLink } from "@/lib/referral";

export default function Join() {
  const c = useContent("join");
  const { data: plans } = trpc.member.plans.useQuery();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: me, isLoading: meLoading } = trpc.member.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const [params] = useSearchParams();
  // The referral code can arrive as ?ref=…, via /r/:code, or from an earlier visit
  // (cookie / localStorage). Once seen it is locked in and never lost.
  const paramRef = params.get("ref") ?? "";
  const [refCode, setRefCode] = useState("");
  const visitFired = useRef(false);
  const visit = trpc.track.visit.useMutation();

  useEffect(() => {
    if (paramRef) captureRef(paramRef);
    const stored = getStoredRef();
    if (stored) setRefCode(stored);
  }, [paramRef]);

  useEffect(() => {
    if (refCode && !visitFired.current) {
      visitFired.current = true;
      visit.mutate({ code: refCode, referrerUrl: document.referrer.slice(0, 500) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refCode]);

  return (
    <PublicLayout>
      <section className="night-glow text-ivory">
        <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
          <p className="kicker kicker-line">{c("join.hero.kicker", "Join Club 10")}</p>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Create your account. <span className="gold-text-grad">Claim your seat.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ivory/70">
            Two minutes. Free seats are live instantly; paid seats activate the moment the club confirms your payment.
          </p>
          {refCode && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold-soft bg-gold/10 px-4 py-1.5 text-xs font-bold text-gold">
              <ShieldCheck className="h-3.5 w-3.5" /> Invited through a member link — your inviter is attached to your registration.
            </p>
          )}
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
          {authLoading || (isAuthenticated && meLoading) ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          ) : !isAuthenticated ? (
            <AccountForm refCode={refCode} plans={plans ?? []} />
          ) : me ? (
            <div className="space-y-6">
              <div className="rounded-3xl bg-card p-10 text-center shadow-sm border border-border">
                <h2 className="text-2xl font-black text-ink">You're already in the club{me.firstName ? `, ${me.firstName}` : ""}.</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Category: <strong className="text-gold-deep">{me.category}</strong> · Status: <strong>{me.status}</strong>
                </p>
                <Link to="/app" className="gold-bg-grad mt-7 inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-ink">
                  Open your dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {me.status === "pending" && me.plan && me.plan.fee > 0 && (
                <BankTransferCard
                  type="membership"
                  amount={me.plan.fee}
                  title={`Pay your ${me.plan.name} membership fee`}
                  subtitle="Transfer to the official account, click “I have paid”, and send your screenshot on WhatsApp — the club approves your access from the backend."
                />
              )}
            </div>
          ) : (
            <RegisterForm refCode={refCode} />
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

/** Step 1 for logged-out visitors: first + last name, email, password (with
 *  confirm + visibility). Referral stays locked in. */
function AccountForm({ refCode, plans }: { refCode: string; plans: { code: string; name: string; fee: number; voucherAmount: number }[] }) {
  const utils = trpc.useUtils();
  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.invalidate(); // session cookie is set — Join re-renders with the seat form
    },
  });
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState("");
  const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-sm outline-none focus:border-gold";

  const pwMismatch = form.confirm.length > 0 && form.password !== form.confirm;

  return (
    <form
      className="rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.password !== form.confirm) {
          setPwError("The two passwords do not match — retype them carefully.");
          return;
        }
        setPwError("");
        register.mutate({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
        });
      }}
    >
      <h2 className="text-2xl font-black text-ink">Create your account</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This is your sign-in. Right after, you'll pick your membership seat.
      </p>

      {refCode && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-brand/30 bg-emerald-brand/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-brand" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-brand">Referral secured</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You're joining through a member's personal link (<code className="font-bold">{refCode}</code>). It's locked to your
              registration automatically — nothing more to do.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">First name</span>
          <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            placeholder="Ada" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Last name</span>
          <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            placeholder="Okafor" className={inputCls} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Email</span>
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com" className={inputCls} />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Phone / WhatsApp (optional)</span>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="0803 456 7890" className={inputCls} />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Password</span>
        <span className="relative block">
          <input required type={showPw ? "text" : "password"} minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters" className={`${inputCls} pr-12`} />
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-ink">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Confirm password</span>
        <span className="relative block">
          <input required type={showConfirm ? "text" : "password"} minLength={8} value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            placeholder="Retype the same password" className={`${inputCls} pr-12 ${pwMismatch ? "border-red-400" : ""}`} />
          <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-ink">
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
        {pwMismatch && <span className="mt-1.5 block text-xs font-semibold text-red-600">Passwords don't match yet.</span>}
        {!pwMismatch && form.confirm.length >= 8 && (
          <span className="mt-1.5 block text-xs font-semibold text-emerald-700">Passwords match.</span>
        )}
      </label>

      {plans.length > 0 && (
        <p className="mt-5 rounded-xl bg-champagne/60 px-4 py-3 text-[11px] text-muted-foreground">
          Seats start at <strong className="text-ink">{plans[0].fee === 0 ? "free" : naira(plans[0].fee)}</strong> — you'll choose
          yours on the next step.
        </p>
      )}

      {(pwError || register.error) && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
          {pwError || register.error?.message}
        </p>
      )}
      <button
        type="submit"
        disabled={register.isPending || pwMismatch}
        className="gold-bg-grad mt-6 flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-ink disabled:opacity-60"
      >
        {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Create my account
      </button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-gold-deep hover:underline">
          Sign in
        </Link>
        {refCode ? " — your referral stays attached." : ""}
      </p>
    </form>
  );
}


function RegisterForm({ refCode }: { refCode: string }) {
  const utils = trpc.useUtils();
  const { data: plans } = trpc.member.plans.useQuery();
  const { data: account } = trpc.auth.me.useQuery();
  const [done, setDone] = useState<"free" | "paid" | null>(null);
  const register = trpc.member.register.useMutation({
    onSuccess: async (res) => {
      await utils.member.me.invalidate();
      setDone(res?.status === "active" ? "free" : "paid");
    },
  });
  const [category, setCategory] = useState("");
  const [inviter, setInviter] = useState(refCode);
  const [joinSource, setJoinSource] = useState("");

  // default category = first active plan
  useEffect(() => {
    if (!category && plans?.length) setCategory(plans[0].code);
  }, [plans, category]);

  if (done) return <WelcomePanel instant={done === "free"} />;

  const selectedPlan = plans?.find((p) => p.code === category);

  return (
    <form
      className="rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-10"
      onSubmit={(e) => {
        e.preventDefault();
        register.mutate({
          category,
          referralCode: inviter.trim() || undefined,
          joinSource: inviter.trim() ? undefined : joinSource || undefined,
        });
      }}
    >
      <h2 className="text-2xl font-black text-ink">Choose your seat</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Account created{account?.name ? ` for ` : ""}{account?.name ? <strong className="text-ink">{account.name}</strong> : ""}.
        Now just pick your membership plan — no need to re-enter your details.
      </p>
      <label className="mt-6 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Your membership plan</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold"
        >
          {(plans ?? []).map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} — {p.fee === 0 ? "Free (instant access)" : `${naira(p.fee)}/yr`}
            </option>
          ))}
        </select>
        {selectedPlan && selectedPlan.fee === 0 && (
          <p className="mt-1.5 text-[11px] font-semibold text-emerald-brand">Free plan — your access starts immediately, no review needed.</p>
        )}
        {selectedPlan && selectedPlan.voucherAmount > 0 && (
          <p className="mt-1.5 text-[11px] font-semibold text-emerald-brand">Includes a {naira(selectedPlan.voucherAmount)} product voucher.</p>
        )}
      </label>

      {/* who brought you — optional; member links lock in automatically */}
      <div className="mt-4 rounded-2xl border-2 border-gold-soft bg-champagne/50 p-5">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gold-deep">
          How did you find Club 10? <span className="text-neutral-400 normal-case font-medium">(optional)</span>
        </span>
        {refCode ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-brand/30 bg-emerald-brand/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-brand" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-brand">Inviter locked in</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You came through a member's personal link (<code className="font-bold">{refCode}</code>) — they're automatically
                recorded as your inviter. Nothing to type, and it can't be lost.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-muted-foreground">
              If a realtor invited you, paste their referral code or link so they're credited. Otherwise just tell us where
              you heard about the club — either way you're placed under the club's founder team.
            </p>
            <input
              value={inviter}
              onChange={(e) => {
                // accept a bare code, a full /r/… link or a ?ref= link — extract the code
                const raw = e.target.value.trim();
                const match = raw.match(/(?:\/r\/|[?&]ref=)?([A-Za-z0-9-]{4,40})\s*$/);
                setInviter(match?.[1] ?? raw);
              }}
              placeholder="A realtor's referral code or link (optional)"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm outline-none focus:border-gold"
            />
            {!inviter.trim() && (
              <select
                value={joinSource}
                onChange={(e) => setJoinSource(e.target.value)}
                className="mt-3 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold"
              >
                <option value="">— Or tell us how you heard about Club 10 —</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
                <option value="X (Twitter)">X (Twitter)</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Google search">Google search</option>
                <option value="Friend or family">Friend or family</option>
                <option value="Event or seminar">Event or seminar</option>
                <option value="Other">Other</option>
              </select>
            )}
          </>
        )}
      </div>

      {register.error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{register.error.message}</p>
      )}
      <button
        type="submit"
        disabled={register.isPending}
        className="gold-bg-grad mt-7 flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-ink disabled:opacity-60"
      >
        {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {selectedPlan?.fee === 0 ? "Start my free membership" : "Submit my registration"}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {selectedPlan?.fee === 0
          ? "The free plan activates instantly — no review, no payment."
          : "Paid seats: after registering you'll get the official account details — pay, click “I have paid”, and send your screenshot on WhatsApp for approval."}
      </p>
    </form>
  );
}

/** Shown right after registration: your own referral link is generated instantly. */
function WelcomePanel({ instant }: { instant?: boolean }) {
  const navigate = useNavigate();
  const { data: me } = trpc.member.me.useQuery();
  const [copied, setCopied] = useState(false);
  const link = me ? referralLink(me.referralCode) : "";

  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
      <h2 className="text-2xl font-black text-ink">Welcome to Club 10{me?.firstName ? `, ${me.firstName}` : ""}.</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        {instant
          ? "Your free membership is active right now — no review needed. And your own referral link is already live: share it and earn 30% of the membership fee of everyone who joins through you."
          : "Your registration is in. And your own referral link is already live — share it and earn 30% of the membership fee of everyone who joins through you."}
      </p>
      {me && (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-gold-soft bg-champagne/60 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold-deep">Your referral link</p>
          <code className="mt-2 block break-all rounded-xl bg-ink px-4 py-3 text-xs font-bold text-gold">{link}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="gold-bg-grad mt-3 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-ink"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : null}
            {copied ? "Copied!" : "Copy my link"}
          </button>
        </div>
      )}
      <div>
        <button
          onClick={() => navigate("/app")}
          className="mt-7 inline-flex items-center gap-2 rounded-full border border-ink px-8 py-4 text-sm font-bold text-ink hover:bg-ink hover:text-ivory"
        >
          Continue to my dashboard <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
