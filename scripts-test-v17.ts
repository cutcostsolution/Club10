/**
 * v17 test suite — Club 10
 * Covers: durable uploads path, full realtor biodata export (upline/status/bank),
 * products/payments/sales CSV exports with date filters, aiTracker = all paid members
 * (zero-activity rows, founders excluded), payout bank account on profile +
 * one-tap withdrawal, member changePassword with confirm, admin alert settings
 * (VAPID push keys, SMTP, test email failure path), push subscribe route auth.
 * Run: npx tsx scripts-test-v17.ts   (server must be running on :3000)
 */
import { signSessionToken } from "./api/kimi/session";
import { getDb } from "./api/queries/connection";
import { users, members, commissions, withdrawals, settings, payments } from "./db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./api/lib/password";

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = "realestateintelligencelab@gmail.com";
const FIX_EMAIL = "v17-fixture@test.local";
const FIX_PASS = "Fixture#Pass1";
const FIX_CODE = "CLB-V17FX01";

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, name: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}`); }
}

async function trpc(token: string, path: string, input?: unknown, method?: "get" | "post") {
  const isGet = method ? method === "get" : !path.includes(".") || true;
  // decide: queries listed here use GET; everything else POST
  const QUERIES = new Set(["admin.aiTracker", "admin.alertSettings", "member.me", "admin.paymentsList"]);
  const useGet = method ? method === "get" : QUERIES.has(path);
  void isGet;
  let res: Response;
  if (useGet) {
    const q = input === undefined ? "" : `&input=${encodeURIComponent(JSON.stringify({ "0": { json: input } }))}`;
    res = await fetch(`${BASE}/api/trpc/${path}?batch=1${q}`, { headers: { Cookie: `kimi_sid=${token}` } });
  } else {
    res = await fetch(`${BASE}/api/trpc/${path}?batch=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kimi_sid=${token}` },
      body: JSON.stringify({ "0": { json: input ?? null } }),
    });
  }
  const body = (await res.json()) as any[];
  const item = body?.[0] ?? {};
  if (item.error) return { error: item.error.json?.message ?? "error", status: res.status };
  return { data: item.result?.data?.json, status: res.status };
}

async function mint(email: string) {
  return signSessionToken({ unionId: `email:${email}`, clientId: "club10" });
}

async function main() {
  const db = getDb();
  const adminTok = await mint(ADMIN_EMAIL);

  // ---------- fixture setup (idempotent) ----------
  console.log("setup");
  const [oldU] = await db.select().from(users).where(eq(users.email, FIX_EMAIL));
  if (oldU) {
    const [oldM] = await db.select().from(members).where(eq(members.userId, oldU.id));
    if (oldM) {
      await db.delete(payments).where(eq(payments.memberId, oldM.id));
      await db.delete(withdrawals).where(eq(withdrawals.memberId, oldM.id));
      await db.delete(commissions).where(eq(commissions.memberId, oldM.id));
      await db.delete(members).where(eq(members.id, oldM.id));
    }
    await db.delete(users).where(eq(users.id, oldU.id));
  }
  const [{ insertId: uid }] = (await db.insert(users).values({
    unionId: `email:${FIX_EMAIL}`, email: FIX_EMAIL, name: "V17 Fixture",
    passwordHash: await hashPassword(FIX_PASS), role: "user",
  })) as any;
  const [{ insertId: mid }] = (await db.insert(members).values({
    userId: Number(uid), firstName: "V17", lastName: "Fixture",
    category: "pro", status: "active", membershipCode: FIX_CODE,
    referralCode: "V17FIXTURE01", notificationSetupDone: true,
  })) as any;
  const fixMid = Number(mid);
  const fixTok = await mint(FIX_EMAIL);
  ok(fixMid > 0, "fixture member created (pro/active)");
  await db.insert(payments).values({ memberId: fixMid, type: "membership", planCode: "pro", amount: 100000, status: "approved", note: "v17 fixture registration" });

  // ---------- 1. aiTracker: all paid members incl. zero-activity, founders excluded ----------
  console.log("aiTracker");
  const tracker = await trpc(adminTok, "admin.aiTracker");
  const rows: any[] = tracker.data ?? [];
  // v18d: the tracker only lists members who have SET UP the studio (a 30-day
  // plan or quick-tool generations) — zero-activity members do not appear.
  ok(!rows.some((r) => r.memberId === fixMid), "zero-activity Pro member is NOT in the Marketing Tracker");
  const founderIds = [60002, 180020];
  ok(!rows.some((r) => founderIds.includes(r.memberId)), "founders excluded from tracker");

  // ---------- 2. withdrawal requires saved bank, then one-tap after profile setup ----------
  console.log("payout bank account");
  const [{ insertId: commId }] = (await db.insert(commissions).values({
    memberId: fixMid, level: -1, amount: 5000, status: "approved",
  })) as any;
  const wd1 = await trpc(fixTok, "sales.requestWithdrawal", { commissionId: Number(commId) });
  ok(!!wd1.error && /payout bank account/i.test(wd1.error), "withdrawal blocked without saved bank account");

  const prof = await trpc(fixTok, "member.updateProfile", {
    bankName: "Test Bank", accountNumber: "0123456789", accountName: "V17 Fixture",
  });
  ok(!prof.error, "updateProfile saves bank details");
  const [mRow] = await db.select().from(members).where(eq(members.id, fixMid));
  ok(mRow.bankName === "Test Bank" && mRow.accountNumber === "0123456789" && mRow.accountName === "V17 Fixture", "bank details persisted on member row");

  const wd2 = await trpc(fixTok, "sales.requestWithdrawal", { commissionId: Number(commId) });
  ok(wd2.data?.ok === true, "one-tap withdrawal succeeds with saved account");
  const [wdRow] = await db.select().from(withdrawals).where(eq(withdrawals.commissionId, Number(commId)));
  ok(wdRow?.bankDetails === "Test Bank\n0123456789\nV17 Fixture", "withdrawal carries the saved 3-line bank details");
  const [cRow] = await db.select().from(commissions).where(eq(commissions.id, Number(commId)));
  ok(cRow?.status === "paid", "commission marked paid after withdrawal request");

  // ---------- 3. member changePassword ----------
  console.log("member changePassword");
  const bad = await trpc(fixTok, "member.changePassword", { currentPassword: "wrong-pass", newPassword: "Fixture#Pass2" });
  ok(!!bad.error && /current password is incorrect/i.test(bad.error), "wrong current password rejected");
  const short = await trpc(fixTok, "member.changePassword", { currentPassword: FIX_PASS, newPassword: "short" });
  ok(!!short.error, "too-short new password rejected");
  const good = await trpc(fixTok, "member.changePassword", { currentPassword: FIX_PASS, newPassword: "Fixture#Pass2" });
  ok(good.data?.ok === true || !good.error, "password change succeeds");
  const [uRow] = await db.select().from(users).where(eq(users.email, FIX_EMAIL));
  ok(await verifyPassword("Fixture#Pass2", uRow.passwordHash!), "new password hash verifies");

  // ---------- 4. CSV exports ----------
  console.log("exports");
  const get = async (path: string, tok: string) => {
    const r = await fetch(`${BASE}${path}`, { headers: { Cookie: `kimi_sid=${tok}` } });
    return { status: r.status, text: await r.text(), type: r.headers.get("content-type") ?? "" };
  };
  const expM = await get("/api/export/members", adminTok);
  ok(expM.status === 200 && /text\/csv/.test(expM.type), "members export returns CSV");
  ok(expM.text.includes("Upline") && expM.text.includes("Status") && expM.text.includes("Bank name"), "members CSV has upline/status/bank columns");
  ok(expM.text.includes("(CLB-"), "members CSV shows upline with membership code");
  ok(expM.text.includes("V17,Fixture") || expM.text.includes("V17") , "fixture realtor present in biodata export");
  ok(expM.text.includes("0123456789"), "fixture bank details in biodata export");

  const expP = await get("/api/export/products", adminTok);
  ok(expP.status === 200 && expP.text.includes("Product") && expP.text.split("\n").length > 2, "products export returns rows");
  const expPay = await get("/api/export/payments?from=2000-01-01&to=2099-12-31", adminTok);
  ok(expPay.status === 200 && expPay.text.includes("V17 Fixture") && expPay.text.split("\n").length > 2, "payments export (wide range) returns rows incl. fixture");
  const expPayEmpty = await get("/api/export/payments?from=2999-01-01&to=2999-12-31", adminTok);
  ok(expPayEmpty.status === 200 && expPayEmpty.text.trim().split("\n").length === 1, "payments export date filter excludes everything outside range");
  const expS = await get("/api/export/sales?from=2000-01-01&to=2099-12-31", adminTok);
  ok(expS.status === 200 && expS.text.includes("Seller code"), "sales export returns rows");
  const denied = await get("/api/export/members", fixTok);
  ok(denied.status === 403, "non-admin blocked from exports (403)");
  const anon = await get("/api/export/members", "");
  ok(anon.status === 403, "anonymous blocked from exports (403)");

  // ---------- 5. admin alert settings: push + email ----------
  console.log("admin alerts");
  const aset0 = await trpc(adminTok, "admin.alertSettings");
  ok(aset0.data !== undefined, "alertSettings readable by admin");
  const setup = await trpc(adminTok, "admin.setupPush", {});
  ok(!setup.error, "setupPush generates VAPID keys");
  const vapid = await fetch(`${BASE}/api/push/vapid`).then((r) => r.json());
  ok(typeof vapid.publicKey === "string" && vapid.publicKey.length > 20, "public VAPID key served");
  const aset1 = await trpc(adminTok, "admin.alertSettings");
  ok(aset1.data?.pushConfigured === true && aset1.data?.vapidPublic === vapid.publicKey, "alertSettings reports push configured");

  const smtp = { smtpHost: "smtp.unreachable.local", smtpPort: "587", smtpUser: "alerts@club10.test", smtpPass: "secret-pass", smtpFrom: "alerts@club10.test", alertEmail: "admin-alerts@club10.test" };
  const saveSmtp = await trpc(adminTok, "admin.saveAlertSettings", smtp);
  ok(!saveSmtp.error, "saveAlertSettings stores SMTP config");
  const aset2 = await trpc(adminTok, "admin.alertSettings");
  ok(aset2.data?.emailConfigured === true && aset2.data?.smtpHasPass === true, "emailConfigured once host/user/pass/alert email set");
  ok(!("smtpPass" in (aset2.data ?? {})), "SMTP password never returned to client");
  const saveBlank = await trpc(adminTok, "admin.saveAlertSettings", { ...smtp, smtpPass: "" });
  const aset3 = await trpc(adminTok, "admin.alertSettings");
  ok(!saveBlank.error && aset3.data?.smtpHasPass === true, "blank password keeps the saved one");
  const testMail = await trpc(adminTok, "admin.testAdminEmail", {});
  ok(!!testMail.error, "testAdminEmail fails cleanly with unreachable SMTP (expected in sandbox)");

  // ---------- 6. push subscribe routes ----------
  console.log("push routes");
  const noAuth = await fetch(`${BASE}/api/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  ok(noAuth.status === 401, "subscribe requires sign-in (401)");
  const badBody = await fetch(`${BASE}/api/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `kimi_sid=${fixTok}` }, body: "{}" });
  ok(badBody.status === 400, "subscribe validates body (400)");
  const sub = await fetch(`${BASE}/api/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `kimi_sid=${fixTok}` },
    body: JSON.stringify({ endpoint: "https://push.example/v17test", keys: { p256dh: "BPx", auth: "authx" } }),
  });
  ok(sub.status === 200, "subscribe stores subscription");
  const unsub = await fetch(`${BASE}/api/push/unsubscribe`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `kimi_sid=${fixTok}` },
    body: JSON.stringify({ endpoint: "https://push.example/v17test" }),
  });
  ok(unsub.status === 200, "unsubscribe removes subscription");

  // ---------- cleanup ----------
  console.log("cleanup");
  // wipe fake SMTP so real alerts aren't attempted against a dead host
  for (const k of ["smtp.host", "smtp.port", "smtp.user", "smtp.pass", "smtp.from", "admin.alert_email"]) {
    await db.update(settings).set({ value: "" }).where(eq(settings.key, k));
  }
  await db.delete(payments).where(eq(payments.memberId, fixMid));
  await db.delete(withdrawals).where(eq(withdrawals.memberId, fixMid));
  await db.delete(commissions).where(eq(commissions.memberId, fixMid));
  await db.delete(members).where(eq(members.id, fixMid));
  await db.delete(users).where(eq(users.email, FIX_EMAIL));
  const asetEnd = await trpc(adminTok, "admin.alertSettings");
  ok(asetEnd.data?.emailConfigured === false, "SMTP test config cleaned up");

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILURES:\n - " + failures.join("\n - ")); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
