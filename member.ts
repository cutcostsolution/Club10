import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  members,
  membershipPlans,
  products,
  linkVisits,
  notificationPrefs,
  commissions,
  sales,
  pointsLedger,
  payments,
  users,
  starterKitResources,
  voucherTransactions,
  productCategories,
} from "../../db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { payReferralCommission, notify, notifyAdmins, levelForPoints, touchMembershipExpiry, membershipQuote, registrationCommissionPct, graceDaysLeft, CHAIN_SPLIT, getPointRule } from "../queries/engine";
import crypto from "crypto";

function genCode(prefix: string) {
  return prefix + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

/** Name-based referral slug, e.g. charity-wealth-a3f9 — readable, unique, URL-safe. */
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function genReferralSlug(firstName: string, lastName: string): Promise<string> {
  const db = getDb();
  const base = slugify(`${firstName} ${lastName}`) || "member";
  for (let i = 0; i < 12; i++) {
    const candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
    const [dupe] = await db.select({ id: members.id }).from(members).where(eq(members.referralCode, candidate));
    if (!dupe) return candidate;
  }
  return `${base}-${crypto.randomBytes(5).toString("hex")}`;
}

async function getMyMember(userId: number) {
  const db = getDb();
  const [m] = await db.select().from(members).where(eq(members.userId, userId));
  // yearly renewal rule — flip lapsed memberships to "expired" on first touch
  return m ? touchMembershipExpiry(m) : null;
}

/** Every member must sit under someone in the unilevel tree. Registrations
 *  that arrive with no referral code attach to the founder (Charity Wealth).
 *  Resolved once and cached — the founder record never changes. */
let cachedDefaultUpline: number | null = null;
async function defaultUplineId(): Promise<number | null> {
  if (cachedDefaultUpline) return cachedDefaultUpline;
  const db = getDb();
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.email, "realestateintelligencelab@gmail.com"));
  if (!u) return null;
  const [m] = await db.select().from(members).where(eq(members.userId, u.id));
  cachedDefaultUpline = m?.id ?? null;
  return cachedDefaultUpline;
}

export const memberRouter = createRouter({
  /** Current user's member profile + computed bits */
  me: authedQuery.query(async ({ ctx }) => {
    const m = await getMyMember(ctx.user.id);
    if (!m) return null;
    const db = getDb();
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.code, m.category));
    const [ref] = m.referrerId
      ? await db.select().from(members).where(eq(members.id, m.referrerId))
      : [null];
    const lvl = levelForPoints(m.pointsBalance);
    return {
      ...m,
      plan,
      referrer: ref,
      level: lvl,
      graceDaysLeft: graceDaysLeft(m),
      engine: {
        regPct: await registrationCommissionPct(),
        chainSplit: CHAIN_SPLIT,
        // live point rules + average product commission — the target calculator
        // computes straight from the admin-configured engine
        pointRules: {
          recruit: parseInt(await getPointRule("recruit", "150")) || 150,
          commissionPer1m: parseInt(await getPointRule("commission_per_1m", "400")) || 400,
          lesson: parseInt(await getPointRule("lesson", "25")) || 25,
          exam: parseInt(await getPointRule("exam", "300")) || 300,
          linkClick: parseInt(await getPointRule("link_click", "1")) || 1,
        },
        avgSalesPct: await (async () => {
          const cats = await db.select().from(productCategories);
          const pcts = cats.map((x) => x.commissionPct).filter((x): x is number => x != null);
          return pcts.length ? Math.round(pcts.reduce((a2, b) => a2 + b, 0) / pcts.length) : 10;
        })(),
      },
    };
  }),

  /** Plans (public — for pricing/join page) */
  plans: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(membershipPlans).where(eq(membershipPlans.isActive, true)).orderBy(membershipPlans.sortOrder);
  }),

  /** Register as a member. Names/phone come from the account created in step 1
   *  — members never type the same detail twice. FREE plans (e.g. Basic) are
   *  active immediately — no review. Paid plans go pending until the club
   *  confirms payment. Referral code attribution — the unilevel tree only
   *  works when every join is attached to the person who invited them, so a
   *  code that is supplied but invalid is REJECTED (never silently dropped). */
  register: authedQuery
    .input(
      z.object({
        firstName: z.string().min(1).max(120).optional(),
        lastName: z.string().min(1).max(120).optional(),
        phone: z.string().max(40).optional(),
        bio: z.string().max(2000).optional(),
        category: z.string().min(1).max(20),
        referralCode: z.string().max(60).optional(),
        joinSource: z.string().max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await getMyMember(ctx.user.id);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Already registered" });

      // Names & phone default to the account created in step 1 — no re-typing.
      const accountName = (ctx.user.name ?? "").trim();
      const nameParts = accountName.split(/\s+/);
      const firstName = input.firstName?.trim() || nameParts[0] || "Member";
      const lastName = input.lastName?.trim() || nameParts.slice(1).join(" ") || nameParts[0] || "Member";
      const phone = input.phone?.trim() || ctx.user.phone || undefined;

      // category must be a real, active membership plan
      const [plan] = await db
        .select()
        .from(membershipPlans)
        .where(and(eq(membershipPlans.code, input.category), eq(membershipPlans.isActive, true)));
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown membership plan" });

      let referrerId: number | null = null;
      const cameViaReferral = Boolean(input.referralCode?.trim());
      if (cameViaReferral) {
        // case-insensitive: old codes are UPPERCASE, name slugs are lowercase
        const code = input.referralCode!.trim();
        const [ref] = await db
          .select()
          .from(members)
          .where(sql`LOWER(referral_code) = LOWER(${code})`);
        if (!ref)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That referral code does not match any member. Check the code with the person who invited you.",
          });
        referrerId = ref.id;
        // mark latest unique visit converted
        await db
          .update(linkVisits)
          .set({ converted: true })
          .where(
            and(
              eq(linkVisits.memberId, ref.id),
              sql`created_at > NOW() - INTERVAL 30 DAY`
            )
          );
      } else {
        // No referral link used — attach to the founder so nobody floats
        // outside the tree. (Founder never defaults to themselves.)
        const founderId = await defaultUplineId();
        referrerId = founderId;
      }

      // FREE plans are live the moment you register — nothing to review.
      const isFree = plan.fee === 0;
      const startStatus = isFree ? ("active" as const) : ("pending" as const);

      const [inserted] = await db
        .insert(members)
        .values({
          userId: ctx.user.id,
          firstName,
          lastName,
          phone,
          bio: !cameViaReferral && input.joinSource?.trim()
            ? `[Joined via ${input.joinSource.trim()}]${input.bio ? " " + input.bio : ""}`
            : input.bio,
          category: plan.code,
          membershipCode: genCode("CLB"),
          referralCode: await genReferralSlug(firstName, lastName),
          referrerId,
          status: startStatus,
          voucherBalance: 0, // the plan voucher is credited ONLY when payment is confirmed
          expiresAt: isFree ? new Date(Date.now() + 365 * 86400000) : null,
        })
        .$returningId();

      if (isFree) {
        // Free access is instant: activate the referral rewards + welcome note
        // straight away (a ₦0 fee pays no cash commission, but the recruiter's
        // points and team stats still count).
        await payReferralCommission(inserted.id);
        if (plan.voucherAmount > 0) {
          await db.update(members).set({ voucherBalance: plan.voucherAmount }).where(eq(members.id, inserted.id));
          await db.insert(voucherTransactions).values({
            memberId: inserted.id,
            amount: plan.voucherAmount,
            balanceAfter: plan.voucherAmount,
            note: `${plan.name} membership active — property voucher credited`,
          });
        }
        await notify(
          ctx.user.id,
          "system",
          "Membership active — welcome to Club 10",
          `Your free ${plan.name} membership is live. Explore your dashboard, the academy and the catalogue.`,
          "/app"
        );
        await notifyAdmins(
          "admin_task",
          "New member joined (free plan)",
          `${firstName} ${lastName} joined on the free ${plan.name} plan — active immediately.`,
          "/admin/realtors"
        );
      } else {
        await notifyAdmins(
          "admin_task",
          "New registration awaiting approval",
          `${firstName} ${lastName} applied for ${plan.name}.`,
          "/admin/realtors"
        );
      }
      return { id: inserted.id, ok: true, status: startStatus };
    }),

  updateProfile: authedQuery
    .input(
      z.object({
        firstName: z.string().min(1).max(120).optional(),
        lastName: z.string().min(1).max(120).optional(),
        phone: z.string().max(40).optional(),
        bio: z.string().max(2000).optional(),
        photoUrl: z.string().max(2000).optional(),
        address: z.string().max(255).optional(),
        city: z.string().max(120).optional(),
        state: z.string().max(120).optional(),
        country: z.string().max(120).optional(),
        bankName: z.string().max(120).optional(),
        accountNumber: z.string().max(20).optional(),
        accountName: z.string().max(160).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const m = await getMyMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(members).set(input).where(eq(members.id, m.id));
      return { ok: true };
    }),

  /** Change my password (members) — verifies the current one first. */
  changePassword: authedQuery
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      if (!u?.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "This account has no password set." });
      const { verifyPassword, hashPassword } = await import("../lib/password");
      if (!(await verifyPassword(input.currentPassword, u.passwordHash)))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect." });
      await db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, u.id));
      return { ok: true };
    }),

  /** Compulsory notification setup — completing this unlocks full access */
  saveNotificationPrefs: authedQuery
    .input(
      z.object({
        emailCommissions: z.boolean(),
        emailWithdrawals: z.boolean(),
        emailTeam: z.boolean(),
        emailPoints: z.boolean(),
        emailCourses: z.boolean(),
        emailSystem: z.boolean(),
        emailLeaderboard: z.boolean(),
        smsEnabled: z.boolean(),
        whatsappEnabled: z.boolean(),
        agreedToTerms: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const m = await getMyMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      const [existing] = await db
        .select()
        .from(notificationPrefs)
        .where(eq(notificationPrefs.userId, ctx.user.id));
      if (existing) {
        await db.update(notificationPrefs).set(input).where(eq(notificationPrefs.id, existing.id));
      } else {
        await db.insert(notificationPrefs).values({ userId: ctx.user.id, ...input });
      }
      await db
        .update(members)
        .set({ notificationSetupDone: true, onboardedAt: new Date() })
        .where(eq(members.id, m.id));
      return { ok: true };
    }),

  getNotificationPrefs: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [p] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, ctx.user.id));
    return p ?? null;
  }),

  /** Referral tree — direct recruits and their counts, 10 levels */
  myTeam: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m = await getMyMember(ctx.user.id);
    if (!m) return null;
    const all = await db.select().from(members);
    const byRef = new Map<number, typeof all>();
    for (const mm of all) {
      if (mm.referrerId == null) continue;
      const arr = byRef.get(mm.referrerId) ?? [];
      arr.push(mm);
      byRef.set(mm.referrerId, arr);
    }
    type Node = {
      id: number; name: string; code: string; category: string;
      status: string; level: number; joinedAt: Date; children: Node[];
    };
    const build = (id: number, level: number): Node[] =>
      level > 10
        ? []
        : (byRef.get(id) ?? []).map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`,
            code: c.membershipCode,
            category: c.category,
            status: c.status,
            level,
            joinedAt: c.createdAt,
            children: build(c.id, level + 1),
          }));
    const tree = build(m.id, 1);

    // descendant stats
    const ids = new Set<number>();
    const byLevel = Array(10).fill(0) as number[];
    let active = 0;
    const walk = (id: number, depth: number) => {
      if (depth > 10) return;
      for (const c of byRef.get(id) ?? []) {
        ids.add(c.id);
        byLevel[depth - 1]++;
        if (c.status === "active") active++;
        walk(c.id, depth + 1);
      }
    };
    walk(m.id, 1);
    return { tree, total: ids.size, direct: (byRef.get(m.id) ?? []).length, active, byLevel };
  }),

  /** Link performance stats for this member */
  linkStats: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m = await getMyMember(ctx.user.id);
    if (!m) return null;
    const visits = await db
      .select()
      .from(linkVisits)
      .where(eq(linkVisits.memberId, m.id))
      .orderBy(desc(linkVisits.createdAt))
      .limit(200);
    const total = visits.length;
    const unique = visits.filter((v) => v.isUniqueToday).length;
    const converted = visits.filter((v) => v.converted).length;
    return {
      total,
      unique,
      converted,
      rate: total ? Math.round((converted / total) * 1000) / 10 : 0,
      recent: visits.slice(0, 50),
    };
  }),

  /** Earnings summary */
  earnings: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m = await getMyMember(ctx.user.id);
    if (!m) return null;
    const rows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.memberId, m.id))
      .orderBy(desc(commissions.createdAt));
    const withSale = await Promise.all(
      rows.map(async (c) => {
        let saleInfo = null;
        if (c.saleId) {
          const [s] = await db.select().from(sales).where(eq(sales.id, c.saleId));
          if (s) {
            const [p] = await db.select().from(products).where(eq(products.id, s.productId));
            saleInfo = { salePrice: s.salePrice, product: p?.name ?? "Product", date: s.createdAt };
          }
        }
        return { ...c, sale: saleInfo };
      })
    );
    const approved = withSale.filter((c) => c.status === "approved" || c.status === "paid");
    const totalEarned = approved.reduce((s, c) => s + c.amount, 0);
    const withdrawn = withSale.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0);
    const direct = approved.filter((c) => c.level === 0).reduce((s, c) => s + c.amount, 0);
    const chain = approved.filter((c) => c.level > 0).reduce((s, c) => s + c.amount, 0);
    return { rows: withSale, totalEarned, withdrawn, available: totalEarned - withdrawn, direct, chain };
  }),

  /** My points ledger (Elite/Executive) */
  myPoints: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m = await getMyMember(ctx.user.id);
    if (!m) return null;
    const rows = await db
      .select()
      .from(pointsLedger)
      .where(eq(pointsLedger.memberId, m.id))
      .orderBy(desc(pointsLedger.createdAt))
      .limit(100);
    return { balance: m.pointsBalance, level: levelForPoints(m.pointsBalance), rows };
  }),

  /** "I have paid" — member reports a bank transfer; admin confirms from the
   *  backend. For membership payments an optional planCode marks an UPGRADE —
   *  on approval the member moves to that plan. */
  reportPayment: authedQuery
    .input(
      z.object({
        type: z.enum(["membership", "property", "commission_claim"]),
        amount: z.number().positive(),
        note: z.string().max(1000).optional(),
        planCode: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const m = await getMyMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Register first" });
      let planCode: string | null = null;
      let planName = "";
      if (input.type === "membership") {
        const code = input.planCode ?? m.category;
        const [plan] = await db
          .select()
          .from(membershipPlans)
          .where(and(eq(membershipPlans.code, code), eq(membershipPlans.isActive, true)));
        if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown membership plan" });
        planCode = plan.code;
        planName = plan.name;
      }
      const isUpgrade = planCode != null && planCode !== m.category;
      await db.insert(payments).values({
        memberId: m.id,
        type: input.type,
        planCode,
        amount: input.amount,
        note: `${isUpgrade ? `[UPGRADE to ${planName}] ` : ""}${input.note ?? ""}`.trim(),
      });
      await notifyAdmins(
        "admin_task",
        "Payment awaiting confirmation",
        `${m.firstName} ${m.lastName} (${m.membershipCode}) reports a ${input.type} payment of ₦${input.amount.toLocaleString()}${isUpgrade ? ` — upgrade to ${planName}` : ""}. Proof arrives on WhatsApp.`,
        "/admin/payments"
      );
      return { ok: true };
    }),

  /** What the member must pay toward a plan right now (renewal 50% / upgrade
   *  balance / full fee for Basic) — the server enforces the same math when
   *  the club reviews the payment. */
  paymentQuote: authedQuery
    .input(z.object({ planCode: z.string().max(20).optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const m0 = await getMyMember(ctx.user.id);
      if (!m0) throw new TRPCError({ code: "NOT_FOUND", message: "Register first" });
      const m = await touchMembershipExpiry(m0);
      const code = input.planCode ?? m.category;
      const [target] = await db
        .select()
        .from(membershipPlans)
        .where(and(eq(membershipPlans.code, code), eq(membershipPlans.isActive, true)));
      if (!target) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown membership plan" });
      const [cur] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, m.category));
      const q = membershipQuote(m, cur ?? null, target);
      if (!q) return null;
      return { ...q, planCode: target.code, planName: target.name, planFee: target.fee };
    }),

  /** Quotes for every active plan at once — drives renewal/upgrade pricing cards. */
  planQuotes: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m0 = await getMyMember(ctx.user.id);
    if (!m0) throw new TRPCError({ code: "NOT_FOUND", message: "Register first" });
    const m = await touchMembershipExpiry(m0);
    const [plans, cur] = await Promise.all([
      db.select().from(membershipPlans).where(eq(membershipPlans.isActive, true)),
      db.select().from(membershipPlans).where(eq(membershipPlans.code, m.category)),
    ]);
    const current = cur[0] ?? null;
    return plans.map((p) => {
      const q = membershipQuote(m, current, p);
      return q
        ? { ...q, planCode: p.code, planName: p.name, planFee: p.fee }
        : { planCode: p.code, planName: p.name, planFee: p.fee, amount: null as number | null, kind: null as string | null, label: null as string | null };
    });
  }),

  myPayments: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m = await getMyMember(ctx.user.id);
    if (!m) return [];
    return db
      .select()
      .from(payments)
      .where(eq(payments.memberId, m.id))
      .orderBy(desc(payments.createdAt))
      .limit(50);
  }),
  /** Property voucher — the plan's property credit (e.g. ₦1m on Executive).
   *  Balance + full credit/spend history so a member can always see exactly
   *  where their voucher stands. */
  myVoucher: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m = await getMyMember(ctx.user.id);
    if (!m) return null;
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, m.category));
    const rows = await db
      .select()
      .from(voucherTransactions)
      .where(eq(voucherTransactions.memberId, m.id))
      .orderBy(desc(voucherTransactions.createdAt))
      .limit(100);
    const credited = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const spent = rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
    return {
      balance: m.voucherBalance,
      planVoucher: plan?.voucherAmount ?? 0,
      planName: plan?.name ?? m.category,
      credited,
      spent,
      rows,
    };
  }),

  /** Spend part of the property voucher on a catalog product. A purchase
   *  request is created for the admin to confirm; the voucher is deducted
   *  immediately so it can't be double-spent (refunded if rejected). */
  spendVoucher: authedQuery
    .input(z.object({ productId: z.number().int().positive(), amount: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const m = await getMyMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Register first" });
      if (m.status !== "active")
        throw new TRPCError({ code: "FORBIDDEN", message: "Your membership must be active to use the voucher." });
      const [p] = await db.select().from(products).where(eq(products.id, input.productId));
      if (!p || p.status !== "live")
        throw new TRPCError({ code: "BAD_REQUEST", message: "That property is not available." });
      if (input.amount > m.voucherBalance)
        throw new TRPCError({ code: "BAD_REQUEST", message: `Your voucher balance is ₦${m.voucherBalance.toLocaleString()} — enter that amount or less.` });
      if (input.amount > p.price)
        throw new TRPCError({ code: "BAD_REQUEST", message: "The voucher can't cover more than the property price." });

      const newBalance = m.voucherBalance - input.amount;
      await db.update(members).set({ voucherBalance: newBalance }).where(eq(members.id, m.id));
      await db.insert(voucherTransactions).values({
        memberId: m.id,
        productId: p.id,
        amount: -input.amount,
        balanceAfter: newBalance,
        note: `Voucher applied to ${p.name} — awaiting admin confirmation`,
      });
      await db.insert(payments).values({
        memberId: m.id,
        type: "property",
        amount: input.amount,
        note: `[VOUCHER] ₦${input.amount.toLocaleString()} of property voucher applied to ${p.name}. Balance to pay: ₦${(p.price - input.amount).toLocaleString()}.`,
      });
      await notifyAdmins(
        "admin_task",
        "Voucher purchase request",
        `${m.firstName} ${m.lastName} (${m.membershipCode}) applied ₦${input.amount.toLocaleString()} of their property voucher to ${p.name}.`,
        "/admin/payments"
      );
      return { ok: true, balance: newBalance };
    }),

  /** Starter kit — onboarding materials, filtered to the member's plan. */
  starterKit: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const m = await getMyMember(ctx.user.id);
    const rows = await db
      .select()
      .from(starterKitResources)
      .where(eq(starterKitResources.isActive, true))
      .orderBy(starterKitResources.sortOrder, starterKitResources.id);
    // plans column: NULL/empty = every member; otherwise only listed plans
    return rows.filter((r) => {
      if (!r.plans || !r.plans.trim()) return true;
      if (!m) return false;
      const allowed = r.plans.split(",").map((c) => c.trim()).filter(Boolean);
      return allowed.includes(m.category);
    });
  }),
});
