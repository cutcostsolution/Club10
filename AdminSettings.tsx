import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import {
  Settings, Landmark, MessageCircle, ShieldCheck, Trash2,
  Loader2, Check, BellRing, Mail, Smartphone,
} from "lucide-react";

const label = "text-xs font-black uppercase tracking-wider text-neutral-500";
const input =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:border-[#a8842b]";

function Field({ k, value, onChange, placeholder }: { k: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className={`${label} mb-1.5`}>{k}</p>
      <input className={input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ------------------------------ payment accounts ----------------------------- */

function PaymentAccounts() {
  const utils = trpc.useUtils();
  const { data: rows } = trpc.admin.getContent.useQuery();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!rows) return;
    const get = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
    setForm({
      "payments.membership.bank": get("payments.membership.bank"),
      "payments.membership.account": get("payments.membership.account"),
      "payments.membership.name": get("payments.membership.name"),
      "payments.properties.bank": get("payments.properties.bank"),
      "payments.properties.account": get("payments.properties.account"),
      "payments.properties.name": get("payments.properties.name"),
      "payments.note": get("payments.note"),
      "global.whatsapp.number": get("global.whatsapp.number"),
    });
  }, [rows]);

  const setContent = trpc.admin.setContent.useMutation();
  const save = async () => {
    for (const [key, value] of Object.entries(form)) {
      await setContent.mutateAsync({ key, value });
    }
    await utils.admin.getContent.invalidate();
    await utils.cms.page.invalidate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (k: string) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Landmark className="h-5 w-5 text-[#a8842b]" />
        <h2 className="text-lg font-black text-ink">Payment accounts</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        These accounts appear everywhere members are asked to pay — join page, member dashboard, upgrades. Changes go live immediately.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-5">
          <p className="text-sm font-black text-ink">Membership fees account</p>
          <div className="mt-4 space-y-4">
            <Field k="Bank" value={form["payments.membership.bank"] ?? ""} onChange={set("payments.membership.bank")} />
            <Field k="Account number" value={form["payments.membership.account"] ?? ""} onChange={set("payments.membership.account")} />
            <Field k="Account name" value={form["payments.membership.name"] ?? ""} onChange={set("payments.membership.name")} />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-5">
          <p className="text-sm font-black text-ink">Property payments account</p>
          <div className="mt-4 space-y-4">
            <Field k="Bank" value={form["payments.properties.bank"] ?? ""} onChange={set("payments.properties.bank")} />
            <Field k="Account number" value={form["payments.properties.account"] ?? ""} onChange={set("payments.properties.account")} />
            <Field k="Account name" value={form["payments.properties.name"] ?? ""} onChange={set("payments.properties.name")} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Field k="Payment instructions note (optional)" value={form["payments.note"] ?? ""} onChange={set("payments.note")} />
        <div>
          <p className={`${label} mb-1.5`}>Club WhatsApp number (international format, digits only)</p>
          <div className="relative">
            <MessageCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              className={`${input} pl-9`}
              value={form["global.whatsapp.number"] ?? ""}
              onChange={(e) => set("global.whatsapp.number")(e.target.value)}
              placeholder="2349019857226"
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">Members' payment proofs and the floating chat button go to this number.</p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={setContent.isPending}
        className="gold-bg-grad mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-ink disabled:opacity-60"
      >
        {setContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Saved — live everywhere" : "Save payment settings"}
      </button>
    </section>
  );
}

/* ------------------------------ change password ------------------------------ */

function ChangePassword() {
  const change = trpc.admin.changePassword.useMutation();
  return (
    <ChangePasswordCard
      pending={change.isPending}
      error={change.error?.message ?? null}
      success={change.isSuccess}
      onSubmit={(currentPassword, newPassword) => change.mutate({ currentPassword, newPassword })}
    />
  );
}

/* ------------------------- admin alerts: push + email ------------------------ */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

function AdminAlerts() {
  const utils = trpc.useUtils();
  const { data } = trpc.admin.alertSettings.useQuery();
  const [form, setForm] = useState({ smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", smtpFrom: "", alertEmail: "" });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushState, setPushState] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      smtpHost: data.smtpHost, smtpPort: data.smtpPort, smtpUser: data.smtpUser,
      smtpPass: "", smtpFrom: data.smtpFrom, alertEmail: data.alertEmail,
    });
  }, [data]);

  const save = trpc.admin.saveAlertSettings.useMutation({
    onSuccess: async () => {
      await utils.admin.alertSettings.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });
  const test = trpc.admin.testAdminEmail.useMutation({
    onSuccess: () => { setTestSent(true); setTimeout(() => setTestSent(false), 4000); },
  });
  const setupPush = trpc.admin.setupPush.useMutation();

  const enablePush = async () => {
    setPushBusy(true);
    setPushState("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushState("This browser doesn't support device notifications.");
        return;
      }
      // ensure server keys exist
      if (!data?.pushConfigured) await setupPush.mutateAsync();
      const res = await fetch("/api/push/vapid");
      if (!res.ok) throw new Error("Push keys not available");
      const { publicKey } = await res.json();
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState("Notifications were blocked — allow them in your browser settings, then retry.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const j = sub.toJSON();
      const resp = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: j.keys?.p256dh, auth: j.keys?.auth } }),
      });
      if (!resp.ok) throw new Error("Subscription failed");
      setPushState("✓ This device now receives admin alerts.");
    } catch (e) {
      setPushState(e instanceof Error ? e.message : "Could not enable push on this device.");
    } finally {
      setPushBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <BellRing className="h-5 w-5 text-[#a8842b]" />
        <h2 className="text-lg font-black text-ink">Admin alerts — device &amp; email</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Get notified the moment a member reports a payment, registers, submits a sale or requests a withdrawal —
        on this device (push) and in the admin inbox (email).
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {/* device push */}
        <div className="rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[#a8842b]" />
            <p className="text-sm font-black text-ink">Device notifications</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${data?.pushConfigured ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}>
              {data?.pushConfigured ? "ready" : "not set up"}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Enable once on each device you want alerted — your phone, laptop, or both. Works even when the site is closed.
          </p>
          <button
            onClick={enablePush}
            disabled={pushBusy}
            className="gold-bg-grad mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-ink disabled:opacity-60"
          >
            {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Enable alerts on this device
          </button>
          {pushState && <p className="mt-2 text-xs font-semibold text-neutral-600">{pushState}</p>}
        </div>

        {/* email */}
        <div className="rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#a8842b]" />
            <p className="text-sm font-black text-ink">Email alerts</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${data?.emailConfigured ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}>
              {data?.emailConfigured ? "live" : "not configured"}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Uses your own mailbox (SMTP). For Gmail: host <code>smtp.gmail.com</code>, port <code>587</code>, and an app password.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field k="SMTP host" value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.gmail.com" />
            <Field k="Port" value={form.smtpPort} onChange={set("smtpPort")} placeholder="587" />
            <Field k="SMTP username" value={form.smtpUser} onChange={set("smtpUser")} placeholder="you@gmail.com" />
            <Field k={data?.smtpHasPass ? "SMTP password (saved — blank keeps it)" : "SMTP password / app password"} value={form.smtpPass} onChange={set("smtpPass")} />
            <Field k="From address" value={form.smtpFrom} onChange={set("smtpFrom")} placeholder="Club 10 <you@gmail.com>" />
            <Field k="Admin alert inbox" value={form.alertEmail} onChange={set("alertEmail")} placeholder="alerts@yourbrand.com" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => save.mutate(form)}
              disabled={save.isPending}
              className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-ink disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
              {saved ? "Saved" : "Save email settings"}
            </button>
            <button
              onClick={() => test.mutate()}
              disabled={test.isPending || !data?.emailConfigured}
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs font-bold text-ink hover:bg-neutral-50 disabled:opacity-50"
            >
              {test.isPending ? "Sending…" : testSent ? "✓ Test sent — check the inbox" : "Send test email"}
            </button>
          </div>
          {(save.error || test.error) && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {save.error?.message ?? test.error?.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- admin accounts ------------------------------ */

function AdminAccounts() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: admins } = trpc.admin.listAdmins.useQuery();
  const { data: memberList } = trpc.admin.membersList.useQuery({});
  const [memberSearch, setMemberSearch] = useState("");
  const grant = trpc.admin.grantAdminByMember.useMutation({
    onSuccess: () => {
      utils.admin.listAdmins.invalidate();
      utils.admin.membersList.invalidate();
      setMemberSearch("");
    },
  });
  const matches = (memberList ?? [])
    .filter((m) => {
      const q = memberSearch.trim().toLowerCase();
      if (!q) return false;
      return (
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.membershipCode.toLowerCase().includes(q)
      );
    })
    .slice(0, 6);
  const remove = trpc.admin.revokeAdmin.useMutation({
    onSuccess: () => {
      utils.admin.listAdmins.invalidate();
      utils.admin.membersList.invalidate();
    },
  });

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#a8842b]" />
            <h2 className="text-lg font-black text-ink">Admin accounts</h2>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Admins are appointed from registered members — there is no form and no public admin sign-up.
            Register the person as a member first, then assign their access here.
          </p>
        </div>
      </div>

      {/* grant an existing member admin access — no second registration */}
      <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50/60 p-5">
        <p className="text-sm font-bold text-ink">Assign admin access to a member</p>
        <p className="mt-0.5 text-xs text-neutral-500">Search the realtor, pick the access level — they keep the same login, no re-registration, no new account.</p>
        <div className="relative mt-3">
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search member by name or code…"
            className={input}
          />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{m.firstName} {m.lastName}</p>
                    <p className="text-[11px] font-mono text-neutral-400">{m.membershipCode} · {m.status}</p>
                  </div>
                  <button
                    onClick={() => grant.mutate({ memberId: m.id, adminRole: "manager" })}
                    disabled={grant.isPending}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold text-ink hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Manager
                  </button>
                  <button
                    onClick={() => grant.mutate({ memberId: m.id, adminRole: "central" })}
                    disabled={grant.isPending}
                    className="rounded-lg gold-bg-grad px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Central
                  </button>
                </li>
              ))}
            </ul>
          )}
          {memberSearch.trim() && matches.length === 0 && (
            <p className="mt-2 text-xs text-neutral-400">No member matches that search.</p>
          )}
        </div>
        {grant.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{grant.error.message}</p>}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className={`${label} py-2 pr-4`}>Name</th>
              <th className={`${label} py-2 pr-4`}>Email</th>
              <th className={`${label} py-2 pr-4`}>Access level</th>
              <th className={`${label} py-2 pr-4`}>Last sign-in</th>
              <th className={`${label} py-2`}></th>
            </tr>
          </thead>
          <tbody>
            {(admins ?? []).map((a) => (
              <tr key={a.id} className="border-b border-neutral-100">
                <td className="py-3 pr-4 font-bold text-ink">
                  {a.name}{a.id === user?.id ? " (you)" : ""}
                  {(a as { title?: string | null }).title && (
                    <span className="ml-2 rounded-full gold-bg-grad px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                      {(a as { title?: string | null }).title}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-neutral-600">{a.email}</td>
                <td className="py-3 pr-4">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${a.adminRole === "central" ? "bg-ink text-gold" : "bg-neutral-100 text-neutral-600"}`}>
                    {a.adminRole === "central" ? "Central Admin" : "Manager"}
                  </span>
                </td>
                <td className="py-3 pr-4 text-neutral-500">{a.lastSignInAt ? new Date(a.lastSignInAt).toLocaleDateString() : "—"}</td>
                <td className="py-3 text-right">
                  {a.id !== user?.id && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove admin access for ${a.name}? They stay a normal member — only the back-office access goes.`))
                          remove.mutate({ userId: a.id });
                      }}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      title="Remove admin access"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remove.error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{remove.error.message}</p>}
    </section>
  );
}

/* ---------------------------------- page ----------------------------------- */

export default function AdminSettings() {
  const { user } = useAuth();
  const isCentral = user?.adminRole === "central";

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-2">Admin</p>
        <h1 className="flex items-center gap-3 text-3xl font-black text-ink">
          <Settings className="h-7 w-7 text-[#a8842b]" /> Settings
        </h1>
        <p className="mt-1 text-neutral-500">Payment accounts, security and admin access control.</p>
      </div>
      <PaymentAccounts />
      <AdminAlerts />
      {isCentral && <AdminAccounts />}
      <ChangePassword />
    </div>
  );
}
