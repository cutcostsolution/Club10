import { useState } from "react";
import { Trophy, Users, ShoppingBag } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { points as fmtPoints, naira } from "@/lib/format";
import { levelForPoints } from "@/lib/levels";

/**
 * Live rankings — points champions and top recruiters (Pro members and above).
 * Used on the member dashboard, the admin dashboard and the public home page.
 */
export function Leaderboards({ meId, dark }: { meId?: number; dark?: boolean }) {
  const [tab, setTab] = useState<"points" | "recruiters" | "sellers">("points");
  const { data: pointsBoard } = trpc.points.pointsLeaderboard.useQuery();
  const { data: recBoard } = trpc.points.recruitmentLeaderboard.useQuery();
  const { data: salesBoard } = trpc.points.salesLeaderboard.useQuery();

  const rows = tab === "points" ? (pointsBoard ?? []) : tab === "recruiters" ? (recBoard ?? []) : (salesBoard ?? []);

  const shell = dark
    ? "rounded-3xl bg-panel p-6 text-ivory sm:p-8"
    : "rounded-2xl border border-border bg-card p-6 shadow-sm";
  const rowCls = dark ? "bg-ink/50" : "bg-background border border-border";
  const nameCls = dark ? "text-ivory" : "text-ink";
  const subCls = dark ? "text-ivory/50" : "text-muted-foreground";

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={`text-lg font-bold ${nameCls}`}>Leadership board</h3>
        <span className="rounded-full border border-gold-soft bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
          Live rankings
        </span>
      </div>
      <div className={`mt-4 flex gap-2 rounded-full p-1 ${dark ? "bg-ink/60" : "bg-muted"}`}>
        <TabBtn active={tab === "points"} onClick={() => setTab("points")} dark={dark}>
          <Trophy className="h-3.5 w-3.5" /> Points
        </TabBtn>
        <TabBtn active={tab === "recruiters"} onClick={() => setTab("recruiters")} dark={dark}>
          <Users className="h-3.5 w-3.5" /> Recruiters
        </TabBtn>
        <TabBtn active={tab === "sellers"} onClick={() => setTab("sellers")} dark={dark}>
          <ShoppingBag className="h-3.5 w-3.5" /> Sellers
        </TabBtn>
      </div>

      <div className="mt-4 space-y-2.5">
        {rows.map((r, i) => {
          const isMe = meId != null && r.id === meId;
          const sub =
            tab === "points"
              ? levelForPoints((r as { points?: number }).points ?? 0).name
              : `${r.category.charAt(0).toUpperCase()}${r.category.slice(1)} plan`;
          const value =
            tab === "points"
              ? fmtPoints((r as { points?: number }).points ?? 0)
              : tab === "recruiters"
                ? `${(r as { joins?: number }).joins ?? 0} join${((r as { joins?: number }).joins ?? 0) === 1 ? "" : "s"}`
                : `${naira((r as { volume?: number }).volume ?? 0)} · ${(r as { salesCount?: number }).salesCount ?? 0} sale${((r as { salesCount?: number }).salesCount ?? 0) === 1 ? "" : "s"}`;
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${rowCls} ${isMe ? "ring-2 ring-gold" : ""}`}
            >
              <RankBadge rank={i + 1} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-bold ${nameCls}`}>
                  {r.firstName} {r.lastName}
                  {isMe && (
                    <span className="gold-bg-grad ml-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-ink">
                      You
                    </span>
                  )}
                </p>
                <p className={`text-xs capitalize ${subCls}`}>{sub}</p>
              </div>
              <span className="shrink-0 text-sm font-extrabold text-gold">{value}</span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className={`rounded-xl px-4 py-6 text-center text-sm ${rowCls} ${subCls}`}>
            {tab === "points"
              ? "The board fills as points post — rankings are for Pro members and above."
              : tab === "recruiters"
                ? "No recruiters ranked yet — the first team builders will appear here."
                : "No sellers ranked yet — the first approved sales will appear here."}
          </p>
        )}
      </div>
      <p className={`mt-4 text-[11px] ${subCls}`}>
        Rankings count active members on Pro plans and above.
        {tab === "recruiters" ? " Recruits are counted all-time." : ""}
        {tab === "sellers" ? " Sellers are ranked by total approved sales volume." : ""}
      </p>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "gold-bg-grad text-ink"
      : rank === 2
        ? "bg-neutral-300 text-ink"
        : rank === 3
          ? "bg-amber-700 text-white"
          : darkSafe();
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${cls}`}>
      {rank}
    </span>
  );
}

function darkSafe() {
  return "bg-neutral-500/20 text-neutral-400";
}

function TabBtn({
  active,
  onClick,
  dark,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "gold-bg-grad text-ink"
          : dark
            ? "text-ivory/60 hover:text-ivory"
            : "text-muted-foreground hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
