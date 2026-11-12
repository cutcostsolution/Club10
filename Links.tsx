import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { fmtDate } from "@/lib/format";
import { referralLink } from "@/lib/referral";
import { Link2, Copy, Check, MousePointerClick, Users, Percent, Monitor, Smartphone } from "lucide-react";

export default function Links() {
  const { data: me } = trpc.member.me.useQuery();
  const { data: stats, isLoading } = trpc.member.linkStats.useQuery();
  const [copied, setCopied] = useState(false);

  if (isLoading || !me || !stats) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const link = referralLink(me.referralCode);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cards = [
    { label: "Total clicks", value: stats.total, icon: MousePointerClick },
    { label: "Unique today", value: stats.unique, icon: Link2 },
    { label: "Conversions", value: stats.converted, icon: Users },
    { label: "Conversion rate", value: `${stats.rate}%`, icon: Percent },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-2">Growth tools</p>
        <h1 className="text-3xl font-black text-ink">My Links</h1>
        <p className="text-neutral-500 mt-1">Every click on your referral link is tracked. You earn 30% of the membership fee when someone joins through it.</p>
      </div>

      {/* Referral link */}
      <div className="rounded-2xl bg-ink night-glow p-6 sm:p-8 text-white">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b] mb-3">Your referral link</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <code className="flex-1 rounded-xl bg-white/10 border border-white/10 px-4 py-3.5 text-sm font-mono text-[#e9dcbb] truncate">
            {link}
          </code>
          <button
            onClick={copy}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <p className="mt-3 text-xs text-white/50">
          Membership code: <span className="font-mono font-bold text-white/80">{me.membershipCode}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white border border-neutral-200 p-5">
            <c.icon className="w-5 h-5 mb-3 text-[#a8842b]" />
            <p className="text-2xl font-black text-ink">{c.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Recent visits */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-black text-ink">Recent link activity</h2>
        </div>
        {stats.recent.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">No clicks yet — share your link to get started.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {stats.recent.map((v) => (
              <li key={v.id} className="px-6 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {v.deviceType === "mobile" ? (
                  <Smartphone className="w-4 h-4 text-neutral-400" />
                ) : (
                  <Monitor className="w-4 h-4 text-neutral-400" />
                )}
                <span className="text-neutral-500">{fmtDate(v.createdAt)}</span>
                {v.referrerUrl && (
                  <span className="text-xs text-neutral-400 truncate max-w-[240px]">from {v.referrerUrl}</span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {v.isUniqueToday && (
                    <span className="text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 bg-blue-50 text-blue-700">unique</span>
                  )}
                  {v.converted ? (
                    <span className="text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700">joined</span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 bg-neutral-100 text-neutral-500">visit</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
