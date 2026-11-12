/**
 * v18 test suite — Club 10
 * Covers: durable upload root, revoke approved sale (commissions reversed,
 * points clawed back, paid-out flagged), sales leaderboard composition,
 * export filters per dataset, commission/points ledger admin endpoints +
 * delete rules, engine payload for the intelligent calculator, frozen
 * post-grace state (points intact, redeem blocked with frozen message),
 * Charity visible to admins.
 * Run: npx tsx scripts-test-v18.ts   (server on :3000)
 */
import { signSessionToken } from "./api/kimi/session";
import { getDb } from "./api/queries/connection";
import {
  users, members, commissions, withdrawals, sales, products, pointsLedger, settings,
} from "./db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "./api/lib/password";
import fs from "fs";

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = "realestateintelligencelab@gmail.com";
const SELLER_EMAIL = "v18-seller@test.local";
const BUYER_EMAIL = "v18-buyer@test.local";

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, name: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}`); }
}

const QUERIES = new Set([
  "admin.aiTracker", "admin.alertSettings", "member.me", "admin.salesQueue",
  "admin.commissionLedger", "admin.pointsLedgerList", "admin.membersList",
  "points.pointsLeaderboard", "points.recruitmentLeaderboard", "points.salesLeaderboard", "admin.rewardsList", "points.rewards",
]);

async function trpc(token: string, path: string, input?: unknown) {
  const useGet = QUERIES.has(path);
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

const mint = (email: string) => signSessionToken({ unionId: `email:${email}`, clientId: "club10" });

async function wipeMember(db: any, email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u) return;
  const [m] = await db.select().from(members).where(eq(members.userId, u.id));
  if (m) {
    await db.delete(pointsLedger).where(eq(pointsLedger.memberId, m.id));
    await db.delete(withdrawals).where(eq(withdrawals.memberId, m.id));
    await db.delete(commissions).where(eq(commissions.memberId, m.id));
    const sRows = await db.select().from(sales).where(eq(sales.sellerId, m.id));
    for (const s of sRows) await db.delete(commissions).where(eq(commissions.saleId, s.id));
    await db.delete(sales).where(eq(sales.sellerId, m.id));
    await db.delete(members).where(eq(members.id, m.id));
  }
  const { notifications, activityLogs, pushSubscriptions, linkVisits } = await import("./db/schema");
  await db.delete(notifications).where(eq(notifications.userId, u.id));
  await db.delete(activityLogs).where(eq(activityLogs.userId, u.id));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, u.id));
  await db.delete(linkVisits).where(eq(linkVisits.memberId, m?.id ?? -1));
  await db.delete(users).where(eq(users.id, u.id));
}

async function main() {
  const db = getDb();
  const adminTok = await mint(ADMIN_EMAIL);

  // ---------- durable upload root ----------
  console.log("uploads");
  ok(fs.existsSync("/mnt/agents/output/brands/club10/uploads"), "upload store lives under the durable brand folder");

  // ---------- fixtures: seller (pro, referred by Charity 60002) + buyer ----------
  console.log("setup");
  await wipeMember(db, SELLER_EMAIL);
  await wipeMember(db, BUYER_EMAIL);
  const mkMember = async (email: string, code: string, refCode: string, referrerId: number | null) => {
    const r1: any = await db.insert(users).values({
      unionId: `email:${email}`, email, name: code, passwordHash: await hashPassword("X#pass1234"), role: "user",
    });
    const uid = Number(r1[0].insertId);
    const r2: any = await db.insert(members).values({
      userId: uid, firstName: "V18", lastName: code, category: "pro", status: "active",
      membershipCode: code, referralCode: refCode, referrerId, notificationSetupDone: true,
    });
    return Number(r2[0].insertId);
  };
  const sellerMid = await mkMember(SELLER_EMAIL, "CLB-V18SL01", "V18SELLER1", 60002);
  ok(sellerMid > 0, "seller fixture created (pro, upline Charity)");

  // ---------- sale → approve → revoke ----------
  console.log("revoke approved sale");
  const [prod] = await db.select().from(products).limit(1);
  const rS: any = await db.insert(sales).values({
    productId: prod.id, sellerId: sellerMid, salePrice: 2_000_000, buyerName: "Test Buyer",
    paymentDate: "2026-11-12", senderName: "Test Buyer", status: "pending",
  });
  const saleId = Number(rS[0].insertId);
  const ap = await trpc(adminTok, "admin.approveSale", { id: saleId });
  ok(!ap.error, "sale approved");
  let crows = await db.select().from(commissions).where(eq(commissions.saleId, saleId));
  ok(crows.length >= 2, "direct + chain commissions posted");
  const sellerPts = await db.select().from(pointsLedger).where(eq(pointsLedger.memberId, sellerMid));
  ok(sellerPts.some((l) => l.meta === `Sale #${saleId}` && l.points > 0), "points credited for the sale");
  const [mAfterSale] = await db.select().from(members).where(eq(members.id, sellerMid));
  const balAfterSale = mAfterSale.pointsBalance;

  const rvBad = await trpc(adminTok, "admin.revokeSale", { id: saleId });
  ok(!rvBad.error && rvBad.data?.ok === true, "approved sale revoked");
  const [sAfter] = await db.select().from(sales).where(eq(sales.id, saleId));
  ok(sAfter.status === "revoked", "sale status is revoked");
  crows = await db.select().from(commissions).where(eq(commissions.saleId, saleId));
  ok(crows.every((c: any) => c.status === "rejected"), "all unpaid commissions rejected on revoke");
  const [mAfterRevoke] = await db.select().from(members).where(eq(members.id, sellerMid));
  ok(mAfterRevoke.pointsBalance === 0 && balAfterSale > 0, "points clawed back to zero");
  const revRows = await db.select().from(pointsLedger).where(and(eq(pointsLedger.memberId, sellerMid), eq(pointsLedger.action, "reversal")));
  ok(revRows.length === 1 && revRows[0].points < 0, "reversal ledger entry written");
  const rvAgain = await trpc(adminTok, "admin.revokeSale", { id: saleId });
  ok(!!rvAgain.error && /approved/i.test(rvAgain.error), "revoking a non-approved sale refused");

  // ---------- sales leaderboard ----------
  console.log("sales leaderboard");
  const lb = await trpc(adminTok, "points.salesLeaderboard");
  ok(Array.isArray(lb.data), "sales leaderboard responds");
  ok(!(lb.data ?? []).some((r: any) => [60002, 180020].includes(r.id)), "founders absent from sellers board");

  // ---------- Charity visible to admins ----------
  console.log("Charity visibility");
  const mlist = await trpc(adminTok, "admin.membersList", {});
  const charityRow = (mlist.data ?? []).find((r: any) => r.id === 60002);
  ok(charityRow?.category === "executive", "Charity's real Executive plan visible in admin realtor list");

  // ---------- export filters ----------
  console.log("export filters");
  const get = async (path: string, tok: string) => {
    const r = await fetch(`${BASE}${path}`, { headers: { Cookie: `kimi_sid=${tok}` } });
    return { status: r.status, text: await r.text() };
  };
  const expActive = await get("/api/export/members?status=active", adminTok);
  ok(expActive.status === 200 && !expActive.text.includes(",pending,"), "members export filters by status=active");
  const expPlan = await get("/api/export/members?category=elite", adminTok);
  ok(expPlan.status === 200 && expPlan.text.includes("elite") && !expPlan.text.includes(",pro,"), "members export filters by plan");
  const expProdCat = await get("/api/export/products?category=1&status=live", adminTok);
  ok(expProdCat.status === 200 && expProdCat.text.includes("Land"), "products export filters by community + status");
  const expPayType = await get("/api/export/payments?type=membership&status=approved", adminTok);
  ok(expPayType.status === 200 && !expPayType.text.includes(",property,"), "payments export filters by type + status");
  const expSaleProd = await get(`/api/export/sales?productId=${prod.id}&status=revoked`, adminTok);
  ok(expSaleProd.status === 200 && expSaleProd.text.includes("revoked"), "sales export filters by product + status (revoked visible)");
  const expComm = await get("/api/export/commissions?status=rejected", adminTok);
  ok(expComm.status === 200 && expComm.text.includes("chain L1"), "commissions dataset exports with status filter");
  const expPoints = await get("/api/export/points?action=reversal", adminTok);
  ok(expPoints.status === 200 && expPoints.text.includes("reversal"), "points dataset exports with action filter");
  const denied = await get("/api/export/points", await mint(SELLER_EMAIL));
  ok(denied.status === 403, "non-admin blocked from new datasets");

  // ---------- ledger endpoints + deletes ----------
  console.log("ledger admin endpoints");
  const cl = await trpc(adminTok, "admin.commissionLedger");
  ok((cl.data ?? []).some((c: any) => c.saleId === saleId), "commission ledger lists the revoked sale's rows");
  const delTarget = (cl.data ?? []).find((c: any) => c.saleId === saleId && c.status === "rejected");
  const del = await trpc(adminTok, "admin.deleteCommission", { id: delTarget.id });
  ok(!del.error, "admin deletes a rejected commission row");
  const pl = await trpc(adminTok, "admin.pointsLedgerList");
  const revEntry = (pl.data ?? []).find((r: any) => r.action === "reversal" && r.memberId === sellerMid);
  ok(!!revEntry, "points ledger list shows the reversal");
  const [mBeforeDel] = await db.select().from(members).where(eq(members.id, sellerMid));
  const delPts = await trpc(adminTok, "admin.deletePointsEntry", { id: revEntry.id });
  const [mAfterDel] = await db.select().from(members).where(eq(members.id, sellerMid));
  ok(!delPts.error, "points entry delete succeeds");
  ok(mAfterDel.pointsBalance === Math.max(mBeforeDel.pointsBalance - revEntry.points, 0), "balance adjusted by the entry's value (deleting the clawback restores the points)");

  // delete protection for paid commissions
  const rC: any = await db.insert(commissions).values({ memberId: sellerMid, level: 0, amount: 1000, status: "paid" });
  const paidCommId = Number(rC[0].insertId);
  const delPaid = await trpc(adminTok, "admin.deleteCommission", { id: paidCommId });
  ok(!!delPaid.error && /paid out/i.test(delPaid.error), "paid commissions protected from delete");
  await db.delete(commissions).where(eq(commissions.id, paidCommId));

  // ---------- engine payload for calculator ----------
  console.log("calculator engine");
  const sellerTok = await mint(SELLER_EMAIL);
  const meRes = await trpc(sellerTok, "member.me");
  const eng = meRes.data?.engine;
  ok(eng?.regPct === 30 && Array.isArray(eng?.chainSplit) && eng.chainSplit[0] === 20, "engine exposes regPct + chain split");
  const { pointRules } = await import("./db/schema");
  const liveRules = await db.select().from(pointRules);
  const ruleMap = Object.fromEntries(liveRules.map((r: any) => [r.key, parseInt(r.value)]));
  ok(eng?.pointRules?.recruit === ruleMap.recruit && eng?.pointRules?.commissionPer1m === ruleMap.commission_per_1m,
    "engine exposes the live admin-set point rules");
  ok(typeof eng?.avgSalesPct === "number" && eng.avgSalesPct > 0, "engine exposes average catalogue commission");
  ok(meRes.data?.plan?.pointsMultiplier === "1", "plan multiplier available for points math");

  // ---------- frozen post-grace state ----------
  console.log("post-grace freeze");
  // simulate: pro member whose expiry + grace have both passed → touch demotes to basic, points intact
  await db.update(members).set({ expiresAt: new Date(Date.now() - 40 * 86400000), status: "active" }).where(eq(members.id, sellerMid));
  await db.update(members).set({ pointsBalance: 500 }).where(eq(members.id, sellerMid));
  const me2 = await trpc(sellerTok, "member.me");
  ok(me2.data?.category === "basic" && me2.data?.status === "active", "grace missed → auto Basic");
  ok(me2.data?.pointsBalance === 500, "points intact after demotion");
  // redeem blocked with frozen message — need a live reward
  const { rewards } = await import("./db/schema");
  const rR: any = await db.insert(rewards).values({ name: "V18 Test Reward", pointCost: 100, status: "live" });
  const rewardId = Number(rR[0].insertId);
  const rd = await trpc(sellerTok, "points.redeem", { rewardId });
  ok(!!rd.error && /frozen/i.test(rd.error), "redeem blocked with frozen-until-renewal message");
  await db.delete(rewards).where(eq(rewards.id, rewardId));

  // cleanup fixture state
  await db.delete(pointsLedger).where(eq(pointsLedger.memberId, sellerMid));
  await db.delete(commissions).where(eq(commissions.saleId, saleId));
  await db.delete(sales).where(eq(sales.id, saleId));
  await wipeMember(db, SELLER_EMAIL);
  await wipeMember(db, BUYER_EMAIL);
  console.log("cleanup done");

  // ---------- tracker strictness + reward images (v18d) ----------
  console.log("tracker strictness");
  const tracker = await trpc(adminTok, "admin.aiTracker");
  const tRows: any[] = tracker.data ?? [];
  // Rei Lab (elite, active, never set up the studio) must NOT appear
  ok(!tRows.some((r) => r.memberId === 180028), "member with no studio activity is not tracked");
  // Moses HAS set up a plan — he must appear... but wait: founders are excluded from tracking entirely.
  ok(!tRows.some((r) => r.memberId === 180020), "founder accounts never tracked (Moses excluded)");
  // a non-founder fixture who builds a plan appears
  const { aiPlans } = await import("./db/schema");
  const rFix: any = await db.insert(users).values({
    unionId: "email:v18-planner@test.local", email: "v18-planner@test.local", name: "V18 Planner",
    passwordHash: await hashPassword("X#pass1234"), role: "user",
  });
  const plannerUid = Number(rFix[0].insertId);
  const rFix2: any = await db.insert(members).values({
    userId: plannerUid, firstName: "V18", lastName: "Planner", category: "pro", status: "active",
    membershipCode: "CLB-V18PL01", referralCode: "V18PLANNER1", referrerId: 60002, notificationSetupDone: true,
  });
  const plannerMid = Number(rFix2[0].insertId);
  const rPlan: any = await db.insert(aiPlans).values({ memberId: plannerMid, title: "30-day marketing plan", goal: "5 sales", status: "active" });
  const tracker2 = await trpc(adminTok, "admin.aiTracker");
  ok((tracker2.data ?? []).some((r: any) => r.memberId === plannerMid), "member who set up a 30-day plan IS tracked");
  await db.delete(aiPlans).where(eq(aiPlans.memberId, plannerMid));
  await db.delete(members).where(eq(members.id, plannerMid));
  const { notifications } = await import("./db/schema");
  await db.delete(notifications).where(eq(notifications.userId, plannerUid));
  await db.delete(users).where(eq(users.id, plannerUid));

  console.log("reward images");
  const sv = await trpc(adminTok, "admin.saveReward", {
    name: "V18 Image Reward", description: "test", imageUrl: "/uploads/cms/test-reward.png",
    pointCost: 50, stock: 5, status: "live",
  });
  ok(!sv.error, "saveReward accepts an image");
  const rl = await trpc(adminTok, "admin.rewardsList", undefined);
  const imgReward = (rl.data ?? []).find((r: any) => r.name === "V18 Image Reward");
  ok(imgReward?.imageUrl === "/uploads/cms/test-reward.png", "reward image persisted and listed");
  const pubRewards = await trpc(adminTok, "points.rewards", undefined);
  ok((pubRewards.data ?? []).find((r: any) => r.name === "V18 Image Reward")?.imageUrl === "/uploads/cms/test-reward.png", "reward image visible to members (public rewards query)");
  const clr = await trpc(adminTok, "admin.saveReward", {
    id: imgReward.id, name: "V18 Image Reward", imageUrl: null, pointCost: 50, stock: 5, status: "live",
  });
  const rl2 = await trpc(adminTok, "admin.rewardsList", undefined);
  ok(!clr.error && (rl2.data ?? []).find((r: any) => r.id === imgReward.id)?.imageUrl === null, "reward image removable");
  const { rewards: rewardsTable } = await import("./db/schema");
  await db.delete(rewardsTable).where(eq(rewardsTable.id, imgReward.id));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILURES:\n - " + failures.join("\n - ")); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
