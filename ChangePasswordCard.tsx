import { useState } from "react";
import { KeyRound, Loader2, Eye, EyeOff, Check } from "lucide-react";

const inputCls =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:border-[#a8842b] pr-10";
const labelCls = "text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5";

/**
 * Change-password card with new-password confirmation and visibility toggles.
 * Used in Admin → Settings and member Profile.
 */
export function ChangePasswordCard({
  onSubmit,
  pending,
  error,
  success,
}: {
  onSubmit: (current: string, next: string) => void;
  pending: boolean;
  error?: string | null;
  success?: boolean;
}) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = cur.length > 0 && next.length >= 8 && next === confirm;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <KeyRound className="h-5 w-5 text-[#a8842b]" />
        <h2 className="text-lg font-black text-ink">Change my password</h2>
      </div>
      <div className="mt-5 grid max-w-md gap-4">
        <PwField
          label="Current password"
          value={cur}
          onChange={setCur}
          show={showCur}
          onToggle={() => setShowCur((s) => !s)}
        />
        <PwField
          label="New password (min 8 characters)"
          value={next}
          onChange={setNext}
          show={showNew}
          onToggle={() => setShowNew((s) => !s)}
        />
        <PwField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          show={showNew}
          onToggle={() => setShowNew((s) => !s)}
        />
        {confirm.length > 0 && (
          <p className={`-mt-2 text-xs font-bold ${mismatch ? "text-red-600" : "text-emerald-700"}`}>
            {mismatch ? "Passwords don't match" : "✓ Passwords match"}
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{error}</p>}
        {success && (
          <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">Password changed.</p>
        )}
        <button
          onClick={() => {
            onSubmit(cur, next);
            setCur("");
            setNext("");
            setConfirm("");
          }}
          disabled={pending || !ready}
          className="gold-bg-grad inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-ink disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : null}
          Update password
        </button>
      </div>
    </section>
  );
}

function PwField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className="relative">
        <input type={show ? "text" : "password"} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          title={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
