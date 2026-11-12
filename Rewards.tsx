import { trpc } from "@/providers/trpc";
import { points as fmtPoints, fmtDate, naira } from "@/lib/format";
import { levelForPoints } from "@/lib/levels";
import { Gift, Sparkles, Trophy, ArrowUpRight, Ticket } from "lucide-react";
import { Link } from "react-router";

export default function Rewards() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.member.me.useQuery();
  const { data: pts, isLoading } = trpc.member.myPoints.useQuery();
  const { data: rewards } = trpc.points.rewards.useQuery();
  const { data: redemptions } = trpc.points.myRedemptions.useQuery();
  const { data: leaderboard } = trpc.points.pointsLeaderboard.useQuery();
  const { data: voucher } = trpc.points.voucherWallet.useQuery();

  const redeem = trpc.points.redeem.useMutation({
    onSuccess: async () => {
      await utils.member.myPoints.invalidate();
      await utils.points.myRedemptions.invalidate();
      await utils.member.me.invalidate();
    },
  });

  const redeemVoucher = trpc.points.redeemWithVoucher.useMutation({
    onSuccess: async () => {
      await utils.points.voucherWallet.invalidate();
      await utils.points.myRedemptions.invalidate();
      await utils.member.myVoucher.invalidate();
    },
  });

  if (isLoading || !pts || !me) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const eligible = me.plan?.pointsEligible ?? false;
  const clientLevel = levelForPoints(pts.balance);
  const hasVoucher = (voucher?.balance ?? 0) > 0 || (voucher?.credited ?? 0) > 0;

  const voucherCard = hasVoucher && voucher ? (
    <div className="rounded-2xl bg-ink night-glow p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl gold-bg-grad">
            <Ticket className="h-6 w-6 text-ink" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b]">Your property voucher</p>
            <p className="text-sm text-white/60">
              credited {naira(voucher.credited)} · used {naira(voucher.spent)}
            </p>
          </div>
        </div>
        <p className="text-3xl font-black text-[#e9dcbb]">{naira(voucher.balance)}</p>
      </div>
      <p className="mt-3 text-xs text-white/50">
        Use it immediately on any product (<Link to="/app/properties" className="font-bold text-[#e9dcbb] hover:underline">Products → Use my voucher</Link>),
        or on any gift item below — no waiting, no conditions.
      </p>
    </div>
  ) : null;

  if (!eligible) {
    return (
      <div className="space-y-8">
        {voucherCard}
        <div className="max-w-xl mx-auto text-center py-16 space-y-5">
          <div className="w-16 h-16 rounded-2xl gold-bg-grad flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-ink">Points are not part of your plan</h1>
          <p className="text-neutral-500">
            Members on points-earning plans collect points for lessons, exams, link clicks, commissions and recruiting —
            then redeem them for real rewards from the catalogue. Upgrade your membership to join the programme.
          </p>
          <a href="/app" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90">
            Upgrade my membership <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-2">Points & rewards</p>
        <h1 className="text-3xl font-black text-ink">Points & Rewards</h1>
      </div>

      {voucherCard}

      {/* Balance hero */}
      <div className="rounded-2xl bg-ink night-glow p-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b] mb-1">Point balance</p>
            <p className="text-5xl font-black gold-text-grad">{fmtPoints(pts.balance)}</p>
            <p className="mt-2 text-white/60 text-sm">
              Level {clientLevel.level} · {clientLevel.name}
            </p>
            <div className="mt-4 max-w-md">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full gold-bg-grad rounded-full" style={{ width: `${clientLevel.progress}%` }} />
              </div>
              {clientLevel.next && (
                <p className="text-xs text-white/50 mt-2">
                  {fmtPoints(clientLevel.next.pts - pts.balance)} to <span className="font-bold text-[#e9dcbb]">{clientLevel.next.name}</span>
                </p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 space-y-1.5">
            <p className="font-black text-white mb-2">How points grow</p>
            <p>Lessons, exams, recruiting, link clicks and approved commissions all feed your balance. Elite earns the standard rate; Executive multiplies it.</p>
          </div>
        </div>
      </div>

      {/* Rewards store */}
      <div>
        <h2 className="font-black text-ink text-xl mb-4">Rewards catalogue</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rewards?.map((r) => {
            const can = pts.balance >= r.pointCost;
            const voucherPrice = r.voucherCost ?? 0;
            const canVoucher = voucherPrice > 0 && (voucher?.balance ?? 0) >= voucherPrice;
            return (
              <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden flex flex-col">
                {/* full reward image — set by the admin; falls back to the gift emblem */}
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.name} className="h-36 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-[#c9a227]/70 via-[#a8842b]/50 to-[#7c6117]/60">
                    <Gift className="h-10 w-10 text-white/80" />
                  </div>
                )}
                <div className="p-5 flex flex-1 flex-col">
                <p className="font-black text-ink">{r.name}</p>
                {r.description && <p className="text-sm text-neutral-500 mt-1 flex-1">{r.description}</p>}
                <p className="mt-3 font-black text-[#a8842b]">{fmtPoints(r.pointCost)}</p>
                <button
                  onClick={() => redeem.mutate({ rewardId: r.id })}
                  disabled={!can || redeem.isPending}
                  className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition disabled:bg-neutral-100 disabled:text-neutral-400 bg-ink text-white hover:bg-[#1d1d24]"
                >
                  {can ? "Redeem with points" : "Not enough points"}
                </button>
                {voucherPrice > 0 && (
                  <button
                    onClick={() => redeemVoucher.mutate({ rewardId: r.id })}
                    disabled={!canVoucher || redeemVoucher.isPending}
                    className="mt-2 w-full py-2.5 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 disabled:bg-neutral-100 disabled:text-neutral-400 gold-bg-grad text-white hover:opacity-90"
                  >
                    {canVoucher
                      ? `Use voucher ${naira(voucherPrice)}`
                      : `Voucher ${naira(voucherPrice)} — low balance`}
                  </button>
                )}
                </div>
              </div>
            );
          })}
        </div>
        {(redeem.error || redeemVoucher.error) && (
          <p className="mt-3 text-sm text-red-600">{(redeem.error ?? redeemVoucher.error)?.message}</p>
        )}
        {(redeem.isSuccess || redeemVoucher.isSuccess) && (
          <p className="mt-3 text-sm text-emerald-700 font-bold">Redemption requested — admin will confirm delivery.</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ledger */}
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h2 className="font-black text-ink">Points ledger</h2>
          </div>
          {pts.rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-neutral-400 text-sm">No point activity yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
              {pts.rows.map((row) => (
                <li key={row.id} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-ink text-sm capitalize">{row.action.replace(/_/g, " ")}</p>
                    {row.meta && <p className="text-xs text-neutral-400">{row.meta}</p>}
                    <p className="text-xs text-neutral-400">{fmtDate(row.createdAt)}</p>
                  </div>
                  <span className={`font-black ${row.points >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {row.points >= 0 ? "+" : ""}{fmtPoints(row.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Redemptions + leaderboard */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100">
              <h2 className="font-black text-ink">My redemptions</h2>
            </div>
            {!redemptions || redemptions.length === 0 ? (
              <p className="px-6 py-8 text-center text-neutral-400 text-sm">Nothing redeemed yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {redemptions.map(({ redemption, reward }) => (
                  <li key={redemption.id} className="px-6 py-3.5 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-ink text-sm">{reward?.name ?? "Reward"}</p>
                      <p className="text-xs text-neutral-400">
                        {redemption.voucherSpent > 0
                          ? `${naira(redemption.voucherSpent)} voucher`
                          : `${fmtPoints(redemption.pointsSpent)}`}
                        {" · "}{fmtDate(redemption.createdAt)}
                      </p>
                    </div>
                    <span className="inline-flex text-xs font-bold rounded-full px-2.5 py-1 capitalize bg-amber-50 text-amber-700">
                      {redemption.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-ink night-glow p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-[#e9dcbb]" />
              <h2 className="font-black">Points leaderboard</h2>
            </div>
            <ul className="space-y-2">
              {leaderboard?.slice(0, 5).map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 text-center font-black ${i === 0 ? "text-[#e9dcbb]" : "text-white/40"}`}>{i + 1}</span>
                  <span className="flex-1 font-bold">{m.firstName} {m.lastName?.[0]}.</span>
                  <span className="font-black text-[#e9dcbb]">{fmtPoints(m.points)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
