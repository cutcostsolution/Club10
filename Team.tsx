import { trpc } from "@/providers/trpc";
import { CATEGORY_LABEL, fmtDate } from "@/lib/format";
import { Users, Network, UserCheck } from "lucide-react";

type Node = {
  id: number;
  name: string;
  code: string;
  category: string;
  status: string;
  level: number;
  joinedAt: string | Date;
  children: Node[];
};

const CAT_COLOR: Record<string, string> = {
  basic: "bg-neutral-100 text-neutral-600",
  pro: "bg-blue-50 text-blue-700",
  elite: "bg-[#a8842b]/15 text-[#7c6117]",
  executive: "bg-ink text-[#e9dcbb]",
};

function TeamNode({ node }: { node: Node }) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <span className="w-8 h-8 rounded-full bg-ink text-[#e9dcbb] flex items-center justify-center text-xs font-black shrink-0">
          {node.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </span>
        <span className="font-bold text-ink">{node.name}</span>
        <span className="text-xs text-neutral-400 font-mono">{node.code}</span>
        <span className={`inline-flex text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 ${CAT_COLOR[node.category] ?? CAT_COLOR.basic}`}>
          {CATEGORY_LABEL[node.category as keyof typeof CATEGORY_LABEL] ?? node.category}
        </span>
        {node.status !== "active" && (
          <span className="inline-flex text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 bg-amber-50 text-amber-700">
            {node.status}
          </span>
        )}
        <span className="text-xs text-neutral-400 ml-auto">{fmtDate(node.joinedAt)}</span>
      </div>
      {node.children.length > 0 && (
        <ul className="ml-4 pl-5 border-l-2 border-neutral-200">
          {node.children.map((c) => (
            <TeamNode key={c.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Team() {
  const { data, isLoading } = trpc.member.myTeam.useQuery();

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxLevel = Math.max(1, ...data.byLevel);

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-2">Community</p>
        <h1 className="text-3xl font-black text-ink">My Team</h1>
        <p className="text-neutral-500 mt-1">Your referral network across all 10 commission levels.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total network", value: data.total, icon: Network },
          { label: "Direct recruits", value: data.direct, icon: Users },
          { label: "Active members", value: data.active, icon: UserCheck },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-neutral-200 p-5">
            <s.icon className="w-5 h-5 mb-3 text-[#a8842b]" />
            <p className="text-2xl font-black text-ink">{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Level distribution */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="font-black text-ink mb-4">Network by level</h2>
        <div className="space-y-2.5">
          {data.byLevel.map((count, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-14 text-xs font-black text-neutral-400">L{i + 1}</span>
              <div className="flex-1 h-6 rounded-lg bg-neutral-100 overflow-hidden">
                <div
                  className="h-full gold-bg-grad rounded-lg transition-all flex items-center justify-end pr-2"
                  style={{ width: count ? `${Math.max(8, (count / maxLevel) * 100)}%` : "0%" }}
                >
                  {count > 0 && <span className="text-[10px] font-black text-white">{count}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="font-black text-ink mb-4">Referral tree</h2>
        {data.tree.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
            <p className="text-neutral-400 text-sm">No recruits yet. Share your referral link from the Overview page to grow your team.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-50">
            {data.tree.map((n) => (
              <TeamNode key={n.id} node={n} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
