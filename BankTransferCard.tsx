import { useState } from "react";
import { BadgeCheck, Copy, Check, Loader2, MessageCircle, Clock, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useContent } from "@/lib/content";
import { naira } from "@/lib/format";

/**
 * Bank-transfer payment flow: pay into the official account → "I have paid" →
 * WhatsApp opens with a prefilled proof message → admin confirms in the backend.
 * Account details + WhatsApp number are CMS-editable (payments.* / global.whatsapp.number).
 */
export function BankTransferCard({
  type,
  amount,
  title,
  subtitle,
  planCode,
}: {
  type: "membership" | "property" | "commission_claim";
  amount: number;
  title: string;
  subtitle?: string;
  /** For membership UPGRADES — the plan being paid for. */
  planCode?: string;
}) {
  const c = useContent("payments");
  const g = useContent("global");
  const utils = trpc.useUtils();
  const { data: me } = trpc.member.me.useQuery();
  const { data: myPayments } = trpc.member.myPayments.useQuery();
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);

  const prefix = type === "membership" ? "payments.membership" : "payments.properties";
  const bank = c(`${prefix}.bank`);
  const account = c(`${prefix}.account`);
  const name = c(`${prefix}.name`);
  const note = c("payments.note");
  const whatsapp = (g("global.whatsapp.number", "2349019857226") || "").replace(/[^0-9]/g, "");

  const openWhatsAppProof = () => {
    const msg = encodeURIComponent(
      `Hello Club 10, I just made a ${type} payment of ${naira(amount)} to ${name} (${bank} ${account}).\n` +
        (planCode ? `Purpose: UPGRADE to ${title}\n` : "") +
        `Name: ${me?.firstName ?? ""} ${me?.lastName ?? ""}\nMembership ID: ${me?.membershipCode ?? ""}\n` +
        `Please find my payment screenshot attached.`
    );
    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
  };

  const report = trpc.member.reportPayment.useMutation({
    onSuccess: async () => {
      await utils.member.myPayments.invalidate();
      setPaid(true);
      openWhatsAppProof();
    },
  });

  const latest = (myPayments ?? []).find(
    (p) => p.type === type && (planCode ? p.planCode === planCode : !p.planCode || p.planCode === me?.category)
  );

  return (
    <div className="rounded-3xl border border-gold-soft bg-card p-7 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Bank transfer</p>
          <h3 className="mt-2 text-xl font-black text-ink">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <span className="rounded-full bg-champagne px-4 py-1.5 text-sm font-extrabold text-gold-deep">{naira(amount)}</span>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-ink p-5 text-ivory sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/40">Bank</p>
          <p className="mt-1 font-extrabold">{bank}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/40">Account number</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(account);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-1 inline-flex items-center gap-2 font-mono text-lg font-extrabold text-gold"
          >
            {account}
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-60" />}
          </button>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/40">Account name</p>
          <p className="mt-1 font-extrabold">{name}</p>
        </div>
      </div>

      {note && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{note}</p>}

      {latest?.status === "pending" || paid ? (
        <div className="mt-5 space-y-3">
          <p className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <Clock className="h-4 w-4 shrink-0" />
            Payment reported — now send your proof on WhatsApp. It is compulsory: the club confirms your payment from the screenshot you send.
          </p>
          <button
            onClick={openWhatsAppProof}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Send my payment proof on WhatsApp (compulsory)
          </button>
        </div>
      ) : latest?.status === "rejected" ? (
        <p className="mt-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          Your last payment report wasn't confirmed — please re-pay and report again, or chat with us on WhatsApp.
        </p>
      ) : null}

      {latest?.status !== "pending" && !paid && (
        <button
          onClick={() => report.mutate({ type, amount, planCode })}
          disabled={report.isPending}
          className="gold-bg-grad mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-ink disabled:opacity-60"
        >
          {report.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          I have paid — send my proof on WhatsApp
        </button>
      )}
      {report.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{report.error.message}</p>
      )}
      <a
        href={`https://wa.me/${whatsapp}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-brand hover:underline"
      >
        <MessageCircle className="h-3.5 w-3.5" /> Chat with the club on WhatsApp
      </a>
    </div>
  );
}
