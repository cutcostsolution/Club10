import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { CATEGORY_LABEL, fmtDate } from "@/lib/format";
import { User, Bell, Award, ShieldCheck, ExternalLink, Camera, Loader2, MapPin, Landmark } from "lucide-react";
import { Link } from "react-router";
import { useRef } from "react";
import { uploadFile } from "@/lib/upload";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";

const PREF_ITEMS = [
  { key: "emailCommissions", label: "Commission updates", desc: "When a sale or referral commission posts" },
  { key: "emailWithdrawals", label: "Withdrawal updates", desc: "Payout approvals and completions" },
  { key: "emailTeam", label: "Team activity", desc: "New recruits and team milestones" },
  { key: "emailPoints", label: "Points & rewards", desc: "Points earned and redemption status" },
  { key: "emailCourses", label: "Academy", desc: "Course unlocks, exam results, certificates" },
  { key: "emailSystem", label: "System notices", desc: "Account and policy updates" },
  { key: "emailLeaderboard", label: "Leaderboard digest", desc: "Weekly rankings and movement" },
] as const;

type PrefKey = (typeof PREF_ITEMS)[number]["key"];

export default function Profile() {
  const utils = trpc.useUtils();
  const { data: me, isLoading } = trpc.member.me.useQuery();
  const { data: prefs } = trpc.member.getNotificationPrefs.useQuery();
  const { data: certs } = trpc.academy.myCertificates.useQuery();

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", bio: "", address: "", city: "", state: "", country: "", bankName: "", accountNumber: "", accountName: "" });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [prefForm, setPrefForm] = useState<Record<PrefKey, boolean> & { smsEnabled: boolean; whatsappEnabled: boolean } | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    if (me) {
      setForm({
        firstName: me.firstName, lastName: me.lastName, phone: me.phone ?? "", bio: me.bio ?? "",
        address: (me as any).address ?? "", city: (me as any).city ?? "", state: (me as any).state ?? "", country: (me as any).country ?? "",
        bankName: (me as any).bankName ?? "", accountNumber: (me as any).accountNumber ?? "", accountName: (me as any).accountName ?? "",
      });
      setPhotoUrl((me as any).photoUrl ?? null);
    }
  }, [me]);

  useEffect(() => {
    if (prefs) {
      setPrefForm({
        emailCommissions: prefs.emailCommissions,
        emailWithdrawals: prefs.emailWithdrawals,
        emailTeam: prefs.emailTeam,
        emailPoints: prefs.emailPoints,
        emailCourses: prefs.emailCourses,
        emailSystem: prefs.emailSystem,
        emailLeaderboard: prefs.emailLeaderboard,
        smsEnabled: prefs.smsEnabled,
        whatsappEnabled: prefs.whatsappEnabled,
      });
    }
  }, [prefs]);

  const update = trpc.member.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.member.me.invalidate();
      setProfileSaved(true);
      setSavedMsg("Profile saved.");
      setTimeout(() => { setProfileSaved(false); setSavedMsg(""); }, 5000);
    },
  });

  const savePrefs = trpc.member.saveNotificationPrefs.useMutation({
    onSuccess: async () => {
      await utils.member.getNotificationPrefs.invalidate();
      setPrefsSaved(true);
      setSavedMsg("Notification preferences saved.");
      setTimeout(() => { setPrefsSaved(false); setSavedMsg(""); }, 5000);
    },
  });

  if (isLoading || !me) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="kicker mb-2">Account</p>
        <h1 className="text-3xl font-black text-ink">Profile</h1>
      </div>

      {/* Identity card */}
      <div className="rounded-2xl bg-ink night-glow p-6 sm:p-8 text-white flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                const url = await uploadFile(f, "avatar");
                setPhotoUrl(url);
                await update.mutateAsync({ photoUrl: url });
                await utils.member.me.invalidate();
              } catch (err) {
                alert(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setUploading(false);
                if (fileRef.current) fileRef.current.value = "";
              }
            }}
          />
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-[#a8842b]/40" />
          ) : (
            <div className="w-20 h-20 rounded-2xl gold-bg-grad flex items-center justify-center text-2xl font-black">
              {me.firstName[0]}{me.lastName[0]}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full gold-bg-grad text-white flex items-center justify-center shadow-lg hover:opacity-90"
            title="Upload your photo"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xl font-black">{me.firstName} {me.lastName}</p>
          <p className="text-sm text-white/60 font-mono">{me.membershipCode}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex text-xs font-bold rounded-full px-3 py-1 bg-[#a8842b]/30 text-[#e9dcbb]">
              {CATEGORY_LABEL[me.category]}
            </span>
            <span className={`inline-flex text-xs font-bold rounded-full px-3 py-1 capitalize ${
              me.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
            }`}>
              {me.status}
            </span>
          </div>
        </div>
        <ShieldCheck className="w-10 h-10 text-[#a8842b]/60 hidden sm:block" />
      </div>

      {/* Edit profile */}
      <form
        className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone || undefined,
            bio: form.bio || undefined,
            address: form.address || undefined,
            city: form.city || undefined,
            state: form.state || undefined,
            country: form.country || undefined,
          });
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <User className="w-5 h-5 text-[#a8842b]" />
          <h2 className="font-black text-ink">Personal details</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">First name</label>
            <input
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Last name</label>
            <input
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
          />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Bio</label>
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
          />
        </div>

        {/* payout bank account — withdrawals pay here automatically */}
        <div className="border-t border-neutral-100 pt-4">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-4 h-4 text-[#a8842b]" />
            <h3 className="font-black text-ink text-sm">Payout bank account</h3>
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            Set this once — every withdrawal request pays into this account, no forms each time. You can change it here anytime.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Bank name</label>
              <input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="e.g. GTBank"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Account number</label>
              <input
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
                placeholder="10 digits"
                inputMode="numeric"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Account name</label>
              <input
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                placeholder="Name on the account"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
            </div>
          </div>
          {(form.bankName || form.accountNumber || form.accountName) &&
            !(form.bankName && form.accountNumber.length === 10 && form.accountName) && (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Complete all three (account number must be 10 digits) for withdrawals to use this account.
            </p>
          )}
        </div>

        {/* address & location */}
        <div className="border-t border-neutral-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[#a8842b]" />
            <h3 className="font-black text-ink text-sm">Address & location</h3>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Street address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="House / street"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">State</label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5">Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
              />
            </div>
          </div>
        </div>
        {update.error && <p className="text-sm text-red-600">{update.error.message}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save profile"}
          </button>
          {profileSaved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 animate-pulse">
              ✓ Profile saved
            </span>
          )}
        </div>
      </form>

      {/* Change password — confirm + visibility built in */}
      <ChangePasswordMember />

      {/* Notification preferences */}
      {prefForm && (
        <form
          className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            savePrefs.mutate({ ...prefForm, agreedToTerms: true });
          }}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#a8842b]" />
            <h2 className="font-black text-ink">Notification preferences</h2>
          </div>
          <div className="space-y-3">
            {PREF_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center gap-4 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={prefForm[item.key]}
                  onChange={(e) => setPrefForm({ ...prefForm, [item.key]: e.target.checked })}
                  className="w-5 h-5 rounded accent-[#a8842b]"
                />
                <span className="flex-1">
                  <span className="block font-bold text-sm text-ink">{item.label}</span>
                  <span className="block text-xs text-neutral-400">{item.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="border-t border-neutral-100 pt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefForm.whatsappEnabled}
                onChange={(e) => setPrefForm({ ...prefForm, whatsappEnabled: e.target.checked })}
                className="w-5 h-5 rounded accent-[#a8842b]"
              />
              <span className="font-bold text-sm text-ink">WhatsApp alerts</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefForm.smsEnabled}
                onChange={(e) => setPrefForm({ ...prefForm, smsEnabled: e.target.checked })}
                className="w-5 h-5 rounded accent-[#a8842b]"
              />
              <span className="font-bold text-sm text-ink">SMS alerts</span>
            </label>
          </div>
          {savePrefs.error && <p className="text-sm text-red-600">{savePrefs.error.message}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savePrefs.isPending}
              className="px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
            >
              {savePrefs.isPending ? "Saving…" : "Save preferences"}
            </button>
            {prefsSaved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 animate-pulse">
                ✓ Preferences saved
              </span>
            )}
          </div>
        </form>
      )}

      {savedMsg && (
        <p className="text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">{savedMsg}</p>
      )}

      {/* Certificates */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Award className="w-5 h-5 text-[#a8842b]" />
          <h2 className="font-black text-ink">My certificates</h2>
        </div>
        {!certs || certs.length === 0 ? (
          <p className="px-6 py-10 text-center text-neutral-400 text-sm">
            Pass a course exam to earn your first certificate. <Link to="/app/training" className="text-[#a8842b] font-bold hover:underline">Go to training</Link>
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {certs.map((cert) => (
              <li key={cert.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 rounded-xl gold-bg-grad flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-bold text-ink">{cert.title}</p>
                  <p className="text-xs text-neutral-400">
                    {cert.scope} · Issued {fmtDate(cert.issuedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono bg-neutral-100 rounded-lg px-2.5 py-1.5">{cert.verificationCode}</code>
                  <Link
                    to={`/verify?code=${cert.verificationCode}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#a8842b] hover:underline"
                  >
                    Verify <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChangePasswordMember() {
  const change = trpc.member.changePassword.useMutation();
  return (
    <ChangePasswordCard
      pending={change.isPending}
      error={change.error?.message ?? null}
      success={change.isSuccess}
      onSubmit={(currentPassword, newPassword) => change.mutate({ currentPassword, newPassword })}
    />
  );
}
