import { Link } from "react-router";
import { ArrowRight, Copy, Check, TrendingUp, GraduationCap, Users, Wallet, ArrowUpCircle, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { naira, points, fmtDate } from "@/lib/format";
import { levelForPoints } from "@/lib/levels";
import { referralLink } from "@/lib/referral";
import { BankTransferCard } from "@/components/business/BankTransferCard";
import { Leaderboards } from "@/components/business/Leaderboards";
import { TargetCalculator } from "@/components/business/TargetCalculator";
import { CommissionCalculator } from "@/components/business/CommissionCalculator";

export default function AppHome() {
  const { data: me } = trpc.member.me.useQuery();
  const { data: earnings } = trpc.member.earnings.useQuery();
  const { data: team } = trpc.member.myTeam.useQuery();
  const { data: courses } = trpc.academy.myCourses.useQuery();
  const { data: plans } = trpc.member.plans.useQuery();
  const { data: quotes } = trpc.member.planQuotes.useQuery();
  const [copied, setCopied] = useState(false);
  const [upgradeFor, setUpgradeFor] = useState<string | null>(null);

  if (!me) return null;
  const lvl = levelForPoints(me.pointsBalance ?? 0);
  const nextCourse = (courses?.courses ?? []).find((c) => c.accessible && c.unlocked && !c.passed);
  const link = referralLink(me.referralCode);

  // upgrade options = active plans ranked above the current one
  const myRank = me.plan?.sortOrder ?? -1;
  const upgrades = (plans ?? []).filter((p) => p.sortOrder > myRank);
  const upgradePlan = upgrades.find((p) => p.code === upgradeFor) ?? null;
  const quoteFor = (code?: string | null) => (quotes ?? []).find((x) => x.planCode === code) ?? null;
  const renewalQuote = quoteFor(me.category);
  const upgradeQuote = quoteFor(upgradePlan?.code);

  return (
    <div className="space-y-6">
      <div className="night-glow rounded-3xl p-7 text-ivory sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {(me as any).photoUrl ? (
              <img src={(me as any).photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover border-2 border-gold/40" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl gold-bg-grad text-xl font-black text-ink">
                {me.firstName[0]}{me.lastName[0]}
              </div>
            )}
            <div>
              <p className="kicker">Welcome back</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                {me.firstName} {me.lastName}
              </h1>
              <p className="mt-1 text-sm text-ivory/50">
                {me.membershipCode} · <span className="capitalize">{me.category}</span> seat
                {me.referrer ? ` · recruited by ${me.referrer.firstName}` : ""}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-gold-soft bg-gold/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold">
            {lvl.name} · Level {lvl.level}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Property voucher" value={naira(me.voucherBalance ?? 0)} gold />
          <Stat label="Available to withdraw" value={naira(earnings?.available ?? 0)} />
          <Stat label="Total earned" value={naira(earnings?.totalEarned ?? 0)} />
          <Stat label="Team members" value={String(team?.total ?? 0)} />
          <Stat label="Equity points" value={points(me.pointsBalance)} />
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-ink/60 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 break-all font-mono text-xs text-ivory/80">{link}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="gold-bg-grad inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-ink"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="mt-3 text-xs text-ivory/40">
          You earn {me.engine?.regPct ?? 30}% of the registration fee when someone joins through your link.
        </p>
      </div>

      {me.status === "pending" && me.plan && me.plan.fee > 0 && (
        <BankTransferCard
          type="membership"
          amount={me.plan.fee}
          title={`Activate your ${me.plan.name} seat`}
          subtitle="Pay into the official account below, then report your payment — your dashboard unlocks the moment the club confirms."
        />
      )}
      {me.status === "pending" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Your registration is under review.</strong> The club approves every seat personally — you'll be notified
          the moment your account goes active. You can explore training previews in the meantime.
        </div>
      )}

      {/* yearly renewal — the membership year has ended */}
      {me.status === "expired" && me.plan && (
        <div className="rounded-2xl border-2 border-[#a8842b]/50 bg-champagne/40 p-6 space-y-4">
          <div>
            <h3 className="font-black text-ink text-lg">Time to renew your membership</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Your {me.plan.name} year has ended{me.expiresAt ? ` (${fmtDate(me.expiresAt)})` : ""}. Renew to keep selling,
              earning commissions, using your voucher and the Marketing Studio — your team, points and records are all intact.
            </p>
            {me.graceDaysLeft != null && (
              <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                Grace period: {me.graceDaysLeft} of 30 days left — after that your seat moves to Basic access.
              </p>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              Renewing the same plan costs {me.plan.renewalDiscountPct != null ? `${100 - me.plan.renewalDiscountPct}%` : "50%"} of the
              fee{renewalQuote ? ` — ${naira(renewalQuote.amount)}` : ""}. Moving up to a higher plan instead costs that plan's full fee
              (see upgrades below).
            </p>
          </div>
          <BankTransferCard
            type="membership"
            amount={renewalQuote?.amount ?? me.plan.fee}
            planCode={me.plan.code}
            title={`Renew your ${me.plan.name} membership — ${naira(renewalQuote?.amount ?? me.plan.fee)}${renewalQuote ? ` (${renewalQuote.label})` : "/yr"}`}
            subtitle="Pay into the official account, report it here and send your proof on WhatsApp — the club confirms and your new year begins (with a fresh property voucher)."
          />
        </div>
      )}

      {me.status === "active" && (
        <Link to="/app/marketing" className="group block rounded-2xl bg-ink night-glow p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl gold-bg-grad">
                <Sparkles className="h-6 w-6 text-ink" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-ivory">Marketing Studio</h3>
                <p className="text-sm text-ivory/60">
                  Get guided daily — listings, broadcast scripts, follow-ups and today's action plan, written for you.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold group-hover:underline">
              Open studio <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Link to="/app/training" className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <GraduationCap className="h-7 w-7 text-gold" />
          <h3 className="mt-3 text-lg font-bold text-ink">
            {nextCourse ? `Continue: ${nextCourse.code} — ${nextCourse.title}` : "Your training"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {nextCourse
              ? `${nextCourse.doneCount}/${nextCourse.lessonCount} lessons done`
              : "Browse your certified courses"}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-deep group-hover:underline">
            Open academy <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
        <Link to="/app/earnings" className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <Wallet className="h-7 w-7 text-gold" />
          <h3 className="mt-3 text-lg font-bold text-ink">Earnings & withdrawals</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct {naira(earnings?.direct ?? 0)} · chain {naira(earnings?.chain ?? 0)}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-deep group-hover:underline">
            View ledger <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
        <Link to="/app/team" className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <Users className="h-7 w-7 text-gold" />
          <h3 className="mt-3 text-lg font-bold text-ink">My team</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {team?.direct ?? 0} direct · {team?.active ?? 0} active across 10 levels
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-deep group-hover:underline">
            See the tree <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
        <Link to="/app/rewards" className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <TrendingUp className="h-7 w-7 text-gold" />
          <h3 className="mt-3 text-lg font-bold text-ink">Points & rewards</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {lvl.next ? `${(lvl.next.pts - (me.pointsBalance ?? 0)).toLocaleString()} pts to ${lvl.next.name}` : "You hold the Apex"}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-deep group-hover:underline">
            Open the store <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>

      {/* live product commission calculator — same engine as the public site */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="font-bold text-ink text-lg">Product commission calculator</h3>
          <p className="text-sm text-muted-foreground">
            Pick any product from the dropdown and see exactly what you — and your chain — earn on a sale, at live admin rates.
          </p>
        </div>
        <CommissionCalculator variant="member" />
      </div>

      {/* target calculator + leadership board */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <TargetCalculator />
        <Leaderboards meId={me.id} />
      </div>

      {/* upgrade membership */}
      {upgrades.length > 0 && (
        <div className="rounded-2xl border border-gold-soft bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-ink">
                <ArrowUpCircle className="h-5 w-5 text-gold" /> Upgrade your membership
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You're on <strong className="text-ink">{me.plan?.name ?? me.category}</strong>. Move up to earn from deeper
                chain levels, unlock points and get a bigger property voucher.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upgrades.map((p) => {
              const q = quoteFor(p.code);
              const due = q?.amount ?? null;
              const showsBalance = q?.kind === "upgrade_balance" || q?.kind === "renewal_upgrade";
              return (
              <div key={p.code} className="rounded-2xl border border-border bg-background p-5">
                <p className="text-sm font-black text-ink">{p.name}</p>
                <p className="mt-0.5 text-xl font-extrabold text-gold-deep">
                  {due != null ? naira(due) : p.fee === 0 ? "Free" : naira(p.fee)}
                  <span className="text-xs font-semibold text-muted-foreground">{showsBalance ? " due" : "/yr"}</span>
                </p>
                {showsBalance && q?.label && (
                  <p className="mt-0.5 text-[11px] font-semibold text-gold-deep">{q.label}</p>
                )}
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>• Earns chain commission {p.chainDepth > 0 ? `to level ${p.chainDepth}` : "on direct sales only"}</li>
                  <li>• {p.pointsEligible ? `Earns reward points (×${p.pointsMultiplier})` : "No points programme"}</li>
                  {p.voucherAmount > 0 && <li>• {naira(p.voucherAmount)} property voucher</li>}
                </ul>
                <button
                  onClick={() => setUpgradeFor(upgradeFor === p.code ? null : p.code)}
                  className="gold-bg-grad mt-4 w-full rounded-full px-4 py-2.5 text-xs font-bold text-ink"
                >
                  {upgradeFor === p.code ? "Close" : `Upgrade to ${p.name}`}
                </button>
              </div>
              );
            })}
          </div>
          {upgradePlan && (
            <div className="relative mt-5">
              <button
                onClick={() => setUpgradeFor(null)}
                className="absolute -top-2 right-0 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <BankTransferCard
                type="membership"
                amount={upgradeQuote?.amount ?? upgradePlan.fee}
                planCode={upgradePlan.code}
                title={`Upgrade to ${upgradePlan.name}${upgradeQuote ? ` — ${naira(upgradeQuote.amount)}` : ""}`}
                subtitle={`${upgradeQuote?.kind === "upgrade_balance" ? "You only pay the balance — your current plan's fee is already deducted. " : upgradeQuote?.kind === "renewal_upgrade" ? "Renewing into a higher plan costs its full fee. " : ""}Pay into the official account, report it here and send your screenshot on WhatsApp — the club confirms and your seat upgrades.`}
              />
            </div>
          )}
        </div>
      )}

      {/* level progress */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ink">Level {lvl.level} · {lvl.name}</h3>
          <span className="text-xs font-semibold text-muted-foreground">
            {lvl.next ? `Next: ${lvl.next.name} at ${lvl.next.pts.toLocaleString()} pts` : "Highest level reached"}
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="gold-bg-grad h-full rounded-full" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
        </div>
        {me.plan && !me.plan.pointsEligible && (
          <p className="mt-3 text-xs text-muted-foreground">
            Points accumulation is not part of the {me.plan.name} plan — your level rises with activity, and upgrading
            unlocks the full points engine.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-ink/50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/40">{label}</p>
      <p className={`mt-1.5 text-xl font-extrabold ${gold ? "gold-text-grad" : "text-ivory"}`}>{value}</p>
    </div>
  );
}
