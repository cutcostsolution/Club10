import { useState } from "react";
import { NavLink, Link, Outlet, Navigate, useNavigate } from "react-router";
import {
  LayoutDashboard, GraduationCap, Wallet, Users, Gift, Link2, UserRound,
  Menu, X, Bell, LogOut, Loader2, BellRing, Building2, Sparkles, PackageOpen,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { referralLink } from "@/lib/referral";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/training", label: "Training", icon: GraduationCap },
  { to: "/app/starter-kit", label: "Starter Kit", icon: PackageOpen },
  { to: "/app/properties", label: "Products", icon: Building2 },
  { to: "/app/earnings", label: "Earnings", icon: Wallet },
  { to: "/app/team", label: "My Team", icon: Users },
  { to: "/app/rewards", label: "Points & Rewards", icon: Gift },
  { to: "/app/links", label: "My Links", icon: Link2 },
  { to: "/app/marketing", label: "Marketing Studio", icon: Sparkles },
  { to: "/app/profile", label: "Profile", icon: UserRound },
];

export function MemberLayout() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: me, isLoading: meLoading } = trpc.member.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated && !!me,
    refetchInterval: 30000,
  });

  if (authLoading || (isAuthenticated && meLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!me) return <Navigate to="/join" replace />;
  if (!me.notificationSetupDone) return <NotificationGate />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="text-ink lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span
              className={`hidden rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest sm:inline-block ${
                me.status === "active"
                  ? "border-emerald-brand/30 bg-emerald-brand/10 text-emerald-brand"
                  : "border-amber-300 bg-amber-100 text-amber-800"
              }`}
            >
              {me.category} · {me.status}
            </span>
            <div className="relative">
              <button
                className="relative rounded-full border border-border p-2.5 text-ink hover:border-gold"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {(unread ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-ink">
                    {unread}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
            </div>
            <button onClick={logout} className="rounded-full border border-border p-2.5 text-ink hover:border-gold" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside
          className={`${
            open ? "block" : "hidden"
          } fixed inset-y-16 left-0 z-30 w-64 overflow-y-auto border-r border-border bg-background p-4 lg:static lg:block`}
        >
          <nav className="space-y-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive ? "bg-ink text-gold" : "text-ink/70 hover:bg-muted hover:text-ink"
                  }`
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          {user?.role === "admin" && (
            <Link
              to="/admin"
              className="mt-4 block rounded-xl border border-gold-soft bg-champagne px-4 py-3 text-sm font-bold text-gold-deep"
            >
              Open Admin Console →
            </Link>
          )}
          <div className="night-glow mt-6 rounded-2xl p-5 text-ivory">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Your referral link</p>
            <p className="mt-2 break-all rounded-lg bg-ink/60 px-3 py-2 font-mono text-[11px] text-ivory/80">
              {referralLink(me.referralCode)}
            </p>
            <Link to="/app/links" className="mt-3 block text-center text-xs font-bold text-gold hover:underline">
              Track clicks & conversions →
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const { data } = trpc.notifications.list.useQuery();
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.unreadCount.invalidate(),
  });
  const mark = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });
  return (
    <div className="absolute right-0 top-12 z-50 w-80 max-w-[90vw] rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-bold text-ink">Notifications</span>
        <button className="text-xs font-semibold text-gold-deep hover:underline" onClick={() => markAll.mutate()}>
          Mark all read
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {(data ?? []).length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
        )}
        {(data ?? []).map((n) => (
          <button
            key={n.id}
            onClick={() => {
              if (!n.isRead) mark.mutate({ id: n.id });
              if (n.actionUrl) navigate(n.actionUrl);
              onClose();
            }}
            className={`block w-full border-b border-border px-4 py-3 text-left last:border-0 ${n.isRead ? "opacity-60" : ""}`}
          >
            <p className="text-sm font-semibold text-ink">{n.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function NotificationGate() {
  const utils = trpc.useUtils();
  const save = trpc.member.saveNotificationPrefs.useMutation({
    onSuccess: () => utils.member.me.invalidate(),
  });
  const [prefs, setPrefs] = useState({
    emailCommissions: true,
    emailWithdrawals: true,
    emailTeam: true,
    emailPoints: true,
    emailCourses: true,
    emailSystem: true,
    emailLeaderboard: true,
    smsEnabled: false,
    whatsappEnabled: true,
  });
  const [agreed, setAgreed] = useState(false);

  const EMAIL_TOGGLES: Array<{ key: keyof typeof prefs; label: string; hint: string }> = [
    { key: "emailCommissions", label: "Commission alerts", hint: "The moment a sale posts to your account" },
    { key: "emailWithdrawals", label: "Withdrawal updates", hint: "Status changes on your payout requests" },
    { key: "emailTeam", label: "Team activity", hint: "New recruits and chain movement" },
    { key: "emailPoints", label: "Points & levels", hint: "Credits, level-ups and reward unlocks" },
    { key: "emailCourses", label: "Course & exam updates", hint: "Certificates, retakes and new lessons" },
    { key: "emailSystem", label: "System & policy", hint: "Important platform notices" },
    { key: "emailLeaderboard", label: "Leaderboard movement", hint: "When you move — or someone passes you" },
  ];

  return (
    <div className="night-glow flex min-h-screen items-center justify-center px-4 py-10 text-ivory">
      <div className="card-glass-dark w-full max-w-xl rounded-3xl p-8 sm:p-10">
        <BellRing className="h-9 w-9 text-gold" />
        <h1 className="mt-4 text-2xl font-black sm:text-3xl">One last thing before your dashboard opens.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ivory/60">
          Club 10 runs on timely information — commission posts, approvals, your team's movement. Setting up your
          notifications is <strong className="text-ivory">required</strong> before you can sell, train or earn. Choose how
          the club reaches you.
        </p>

        <div className="mt-7 space-y-3">
          {EMAIL_TOGGLES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPrefs({ ...prefs, [t.key]: !prefs[t.key] })}
              className="flex w-full items-center justify-between rounded-xl bg-ink/50 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-xs text-ivory/50">{t.hint}</span>
              </span>
              <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${prefs[t.key] ? "bg-gold" : "bg-white/15"}`}>
                <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${prefs[t.key] ? "translate-x-5" : ""}`} />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {(["whatsappEnabled", "smsEnabled"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPrefs({ ...prefs, [key]: !prefs[key] })}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                prefs[key] ? "border-gold bg-gold/15 text-gold" : "border-white/15 text-ivory/60"
              }`}
            >
              {key === "whatsappEnabled" ? "WhatsApp alerts" : "SMS alerts"} {prefs[key] ? "· on" : "· off"}
            </button>
          ))}
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-ivory/70">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#a8842b]"
          />
          I agree to the club's terms, the commission rules and the code of conduct — and I understand my dashboard unlocks
          only after this setup.
        </label>

        {save.error && (
          <p className="mt-4 rounded-xl bg-red-500/15 px-4 py-2.5 text-xs font-semibold text-red-300">{save.error.message}</p>
        )}

        <button
          disabled={!agreed || save.isPending}
          onClick={() => save.mutate({ ...prefs, agreedToTerms: true })}
          className="gold-bg-grad mt-7 flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-ink disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Save & open my dashboard
        </button>
      </div>
    </div>
  );
}
