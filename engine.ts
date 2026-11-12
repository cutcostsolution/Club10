import { getDb } from "./connection";
import {
  members,
  commissions,
  pointsLedger,
  pointRules,
  notifications,
  users,
  membershipPlans,
  sales,
  products,
  productCategories,
} from "../../db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { settings } from "../../db/schema";
import { isFounderAccount } from "../lib/founders";

/** Chain split: % of the direct commission paid to each upline level (L1..L10). */
export const CHAIN_SPLIT = [20, 10, 5, 3, 2, 1, 1, 1, 1, 1];

/** Legacy fallback order for codes that have no plan row (should not happen). */
const LEGACY_ORDER = ["basic", "pro", "elite", "executive"];

/** Fetch the plan row for a member category code (dynamic plans). */
export async function getPlan(code: string) {
  const db = getDb();
  const [p] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, code));
  return p ?? null;
}

/** Seniority rank of a plan code — higher sortOrder = more senior plan. */
export async function planRank(code: string): Promise<number> {
  const p = await getPlan(code);
  if (p) return p.sortOrder;
  return LEGACY_ORDER.indexOf(code);
}

/** Admin-tunable platform settings (settings table). */
export async function getSetting(key: string, fallback: string): Promise<string> {
  const db = getDb();
  const [r] = await db.select().from(settings).where(eq(settings.key, key));
  return r?.value ?? fallback;
}

/** Registration commission % (of the new member's plan fee) — admin-editable. */
export async function registrationCommissionPct(): Promise<number> {
  const pct = parseFloat(await getSetting("registration_commission_pct", "30"));
  return Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 30;
}

/**
 * What a member must pay for a membership payment toward a target plan.
 *  - First activation (pending): 100% of the plan fee.
 *  - Renewal inside the grace window (expired): same plan = the plan's
 *    renewal price (default 50% of fee); moving to ANY other plan = 100% of
 *    the target plan's fee.
 *  - Upgrade while active: only the BALANCE — the target fee minus the fee
 *    already paid for the current plan. Basic paid ₦0, so Basic pays in full.
 * Returns null when no payment is due (already on the plan while active).
 */
export function membershipQuote(
  m: { status: string; category: string },
  currentPlan: { fee: number; sortOrder: number } | null | undefined,
  targetPlan: { code: string; fee: number; renewalDiscountPct: number; sortOrder: number }
): { amount: number; kind: "activation" | "renewal" | "renewal_upgrade" | "upgrade_balance"; label: string } | null {
  if (m.status === "pending") {
    return { amount: targetPlan.fee, kind: "activation", label: "first activation" };
  }
  if (m.status === "expired") {
    if (targetPlan.code === m.category) {
      const amount = Math.round((targetPlan.fee * (100 - targetPlan.renewalDiscountPct)) / 100);
      return { amount, kind: "renewal", label: `${100 - targetPlan.renewalDiscountPct}% renewal` };
    }
    return { amount: targetPlan.fee, kind: "renewal_upgrade", label: "renewal into a new plan — full fee" };
  }
  // active member
  if (targetPlan.code === m.category) return null;
  const curFee = currentPlan?.fee ?? 0;
  const curRank = currentPlan?.sortOrder ?? -1;
  if (targetPlan.sortOrder <= curRank) return null; // not an upgrade
  return {
    amount: Math.max(targetPlan.fee - curFee, 0),
    kind: "upgrade_balance",
    label: curFee > 0 ? "balance after deducting your current plan's fee" : "full fee",
  };
}

/** How many upline levels a member of this plan earns chain commission from. */
export async function chainDepthFor(code: string): Promise<number> {
  const p = await getPlan(code);
  if (p) return p.chainDepth;
  return Math.max(0, LEGACY_ORDER.indexOf(code)) * 5;
}

export const POINT_LEVELS = [
  { level: 1, name: "Starter", pts: 0 },
  { level: 2, name: "Rising", pts: 2000 },
  { level: 3, name: "Bronze", pts: 5000 },
  { level: 4, name: "Gold", pts: 12000 },
  { level: 5, name: "Platinum", pts: 25000 },
  { level: 6, name: "Diamond", pts: 50000 },
  { level: 7, name: "Elite", pts: 90000 },
  { level: 8, name: "Ambassador", pts: 150000 },
  { level: 9, name: "Icon", pts: 250000 },
  { level: 10, name: "THE APEX", pts: 500000 },
];

export function levelForPoints(pts: number) {
  let cur = POINT_LEVELS[0];
  for (const l of POINT_LEVELS) if (pts >= l.pts) cur = l;
  const next = POINT_LEVELS.find((l) => l.pts > pts) ?? null;
  return { ...cur, next };
}

export async function getPointRule(key: string, fallback: string): Promise<string> {
  const db = getDb();
  const [r] = await db.select().from(pointRules).where(eq(pointRules.key, key));
  return r?.value ?? fallback;
}

/** Credit points to a member — only plans flagged pointsEligible earn points.
 *  The plan's own points multiplier is applied. */
export async function creditPoints(
  memberId: number,
  action: string,
  basePoints: number,
  meta?: string
) {
  if (basePoints <= 0) return;
  const db = getDb();
  const [m] = await db.select().from(members).where(eq(members.id, memberId));
  if (!m) return;
  const plan = await getPlan(m.category);
  if (!plan?.pointsEligible) return;
  const mult = parseFloat(plan.pointsMultiplier || "1") || 1;
  const pts = Math.round(basePoints * mult);
  await db.insert(pointsLedger).values({ memberId, action, points: pts, meta });
  await db
    .update(members)
    .set({ pointsBalance: sql`points_balance + ${pts}` })
    .where(eq(members.id, memberId));
}

/**
 * Yearly renewal rule — a membership is valid for 365 days from confirmation.
 * The moment an active member's expiresAt passes, their seat flips to
 * "expired" (lazy, on first touch) and paid features lock until they renew.
 * Returns the (possibly updated) member row.
 */
export async function touchMembershipExpiry<
  T extends { id: number; userId: number; status: string; category: string; expiresAt: Date | null }
>(m: T): Promise<T> {
  if (m.status !== "active" || !m.expiresAt) return m;
  const now = Date.now();
  const exp = new Date(m.expiresAt).getTime();
  if (exp >= now) return m;

  const db = getDb();
  // Lifetime access (invisible protocol): founder accounts never expire.
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, m.userId));
  if (u && isFounderAccount(u.email)) {
    await db.update(members).set({ expiresAt: null }).where(eq(members.id, m.id));
    return { ...m, expiresAt: null };
  }

  const graceEnd = exp + 30 * 86400000;
  if (now <= graceEnd) {
    // 30-day renewal window — full dashboard stays visible but paid features
    // lock until the renewal is confirmed.
    await db.update(members).set({ status: "expired" }).where(eq(members.id, m.id));
    return { ...m, status: "expired" };
  }

  // Grace missed → the dashboard drops to Basic (free) access automatically.
  await db
    .update(members)
    .set({ category: "basic", status: "active", expiresAt: null })
    .where(eq(members.id, m.id));
  await notify(
    m.userId,
    "system",
    "Your renewal grace period has passed",
    "Your 30-day renewal window has closed, so your dashboard is now on Basic (free) access. Your team, points and records all stay intact — but they are frozen: you cannot redeem points or earn team bonuses until you renew. Upgrade any time and you'll only pay the balance for your new plan.",
    "/app"
  );
  return { ...m, category: "basic", status: "active", expiresAt: null };
}

/** Days left in the 30-day renewal grace window; null when not expired. */
export function graceDaysLeft(m: { status: string; expiresAt: Date | null }): number | null {
  if (m.status !== "expired" || !m.expiresAt) return null;
  const left = 30 - Math.floor((Date.now() - new Date(m.expiresAt).getTime()) / 86400000);
  return Math.max(left, 0);
}

/**
 * Gift-redemption unlock rule: the member (or anyone in their team — the
 * downline tree under them) must have at least one APPROVED sale. Walks the
 * unilevel tree breadth-first, capped at the chain depth.
 */
export async function memberOrTeamHasSale(memberId: number): Promise<boolean> {
  const db = getDb();
  const [own] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(sales)
    .where(and(eq(sales.sellerId, memberId), eq(sales.status, "approved")));
  if (Number(own?.n ?? 0) > 0) return true;
  let frontier = [memberId];
  for (let depth = 0; depth < 10 && frontier.length; depth++) {
    const kids = await db
      .select({ id: members.id })
      .from(members)
      .where(inArray(members.referrerId, frontier));
    if (!kids.length) return false;
    const kidIds = kids.map((k) => k.id);
    const [hit] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(sales)
      .where(and(inArray(sales.sellerId, kidIds), eq(sales.status, "approved")));
    if (Number(hit?.n ?? 0) > 0) return true;
    frontier = kidIds;
  }
  return false;
}

export async function notify(
  userId: number,
  type: string,
  title: string,
  message?: string,
  actionUrl?: string
) {
  const db = getDb();
  await db.insert(notifications).values({ userId, type, title, message, actionUrl });
}

/** Notify every admin user (in-app). */
export async function notifyAdmins(
  type: string,
  title: string,
  message?: string,
  actionUrl?: string
) {
  const db = getDb();
  const admins = await db.select().from(users).where(eq(users.role, "admin"));
  for (const a of admins) await notify(a.id, type, title, message, actionUrl);
  // out-of-app delivery: device push + email (both best-effort, never blocking)
  const { alertAdmins } = await import("../lib/deliver");
  await alertAdmins(title, message ?? "", actionUrl);
}

/**
 * Distribute commissions for an approved sale.
 * Direct commission to seller; chain split up the referrer tree respecting
 * each ancestor's category depth. Returns created commission rows.
 */
export async function distributeCommissions(saleId: number) {
  const db = getDb();
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
  if (!sale) throw new Error("sale not found");

  const [seller] = await db.select().from(members).where(eq(members.id, sale.sellerId));
  if (!seller) throw new Error("seller not found");

  // direct rate: product override ?? category default
  const [prod] = await db.select().from(products).where(eq(products.id, sale.productId));
  let pct = prod?.commissionPct ?? null;
  if (pct == null && prod) {
    const [cat] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, prod.categoryId));
    pct = cat?.commissionPct ?? 10;
  }
  pct = pct ?? 10;

  const direct = Math.round((sale.salePrice * pct) / 100);
  const created: number[] = [];

  // direct to seller
  const [d] = await db
    .insert(commissions)
    .values({ saleId, memberId: seller.id, level: 0, amount: direct, status: "approved" })
    .$returningId();
  created.push(d.id);

  // walk up the chain
  let current = seller;
  for (let level = 1; level <= 10; level++) {
    if (!current.referrerId) break;
    const [ancestor] = await db
      .select()
      .from(members)
      .where(eq(members.id, current.referrerId));
    if (!ancestor) break;
    const depth = await chainDepthFor(ancestor.category);
    if (depth >= level && ancestor.status === "active") {
      const amt = Math.round((direct * CHAIN_SPLIT[level - 1]) / 100);
      if (amt > 0) {
        const [c] = await db
          .insert(commissions)
          .values({ saleId, memberId: ancestor.id, level, amount: amt, status: "approved" })
          .$returningId();
        created.push(c.id);
        await notify(
          ancestor.userId,
          "commission",
          `Chain commission earned — Level ${level}`,
          `₦${amt.toLocaleString()} posted to your wallet from a team sale.`,
          "/app/earnings"
        );
      }
    }
    current = ancestor;
  }

  // points: per ₦1m of commission (seller direct)
  const per1m = parseInt(await getPointRule("commission_per_1m", "400"));
  await creditPoints(seller.id, "commission", Math.round((direct / 1_000_000) * per1m), `Sale #${saleId}`);

  // notify seller
  await notify(
    seller.userId,
    "commission",
    "Your commission request has been approved",
    `₦${direct.toLocaleString()} credited for your sale.`,
    "/app/earnings"
  );

  return created;
}

/** Registration commission: admin-editable % of plan fee to the referrer. */
export async function payReferralCommission(
  memberId: number,
  opts?: { amountOverride?: number; reason?: "registration" | "renewal" | "upgrade" }
) {
  const db = getDb();
  const [m] = await db.select().from(members).where(eq(members.id, memberId));
  if (!m || !m.referrerId) return;
  const [plan] = await db
    .select()
    .from(membershipPlans)
    .where(eq(membershipPlans.code, m.category));
  const fee = opts?.amountOverride ?? plan?.fee ?? 0;
  const reason = opts?.reason ?? "registration";
  const [ref] = await db.select().from(members).where(eq(members.id, m.referrerId));
  if (!ref) return;
  if (fee > 0) {
    const pct = await registrationCommissionPct();
    const amt = Math.round((fee * pct) / 100);
    await db.insert(commissions).values({
      saleId: null, // registration/renewal/upgrade commission, no sale
      memberId: ref.id,
      level: -1, // -1 = plan-payment commission
      amount: amt,
      status: "approved",
      note:
        reason === "renewal"
          ? `Renewal commission — ${m.firstName} ${m.lastName} renewed ${plan?.name ?? m.category}`
          : reason === "upgrade"
            ? `Upgrade commission — ${m.firstName} ${m.lastName} moved up to ${plan?.name ?? m.category}`
            : `Registration commission — ${m.firstName} ${m.lastName} joined ${plan?.name ?? m.category}`,
    });
    await notify(
      ref.userId,
      "commission",
      reason === "registration"
        ? "Registration commission earned"
        : reason === "renewal"
          ? "Renewal commission earned"
          : "Upgrade commission earned",
      `₦${amt.toLocaleString()} — ${m.firstName} ${m.lastName} ${
        reason === "registration"
          ? `joined ${plan?.name ?? m.category} through your link.`
          : reason === "renewal"
            ? `renewed their ${plan?.name ?? m.category} membership — your network keeps paying you.`
            : `upgraded to ${plan?.name ?? m.category} — your network keeps paying you.`
      }`,
      "/app/earnings"
    );
  }
  if (reason === "registration") {
    const recPts = parseInt(await getPointRule("recruit", "150"));
    await creditPoints(ref.id, "recruit", recPts, `${m.firstName} ${m.lastName} activated`);
    await notify(
      ref.userId,
      "team",
      "New team member joined",
      `${m.firstName} ${m.lastName} just joined your network.`,
      "/app/team"
    );
  }
}
