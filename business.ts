import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  products,
  productCategories,
  members,
  sales,
  withdrawals,
  commissions,
  linkVisits,
  pointsLedger,
  rewards,
  redemptions,
  blogPosts,
  voucherTransactions,
} from "../../db/schema";
import { eq, desc, and, sql, inArray, notInArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyAdmins, CHAIN_SPLIT, chainDepthFor, getPlan, touchMembershipExpiry } from "../queries/engine";
import { ADMIN_EMAIL, FOUNDER_EMAIL } from "../lib/founders";
import crypto from "crypto";

async function myMember(userId: number) {
  const db = getDb();
  const [m] = await db.select().from(members).where(eq(members.userId, userId));
  // yearly renewal rule — flip lapsed memberships to "expired" on first touch
  return m ? touchMembershipExpiry(m) : null;
}

export const catalogRouter = createRouter({
  categories: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(productCategories).orderBy(productCategories.sortOrder);
  }),

  products: publicQuery
    .input(
      z
        .object({
          categoryId: z.number().optional(),
          country: z.string().max(80).optional(),
          state: z.string().max(80).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [eq(products.status, "live")];
      if (input?.categoryId) conds.push(eq(products.categoryId, input.categoryId));
      if (input?.country) conds.push(eq(products.country, input.country));
      if (input?.state) conds.push(eq(products.state, input.state));
      const rows = await db
        .select({ product: products, category: productCategories })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(and(...conds));
      return rows.map((r) => ({
        ...r.product,
        categoryName: r.category?.name,
        effectivePct: r.product.commissionPct ?? r.category?.commissionPct ?? 10,
      }));
    }),

  /** Country → states directory (admin-managed) merged with any legacy values
   *  already on live products, so filters never show an empty list. */
  locations: publicQuery.query(async () => {
    const db = getDb();
    const { productCountries, productStates } = await import("../../db/schema");
    const countries = await db.select().from(productCountries).orderBy(productCountries.sortOrder, productCountries.name);
    const states = await db.select().from(productStates).orderBy(productStates.sortOrder, productStates.name);
    const map = new Map<string, string[]>();
    for (const c of countries) map.set(c.name, []);
    for (const s of states) {
      const c = countries.find((x) => x.id === s.countryId);
      if (c) map.get(c.name)!.push(s.name);
    }
    // merge in any country/state already used by live products but not yet in the directory
    const rows = await db
      .selectDistinct({ country: products.country, state: products.state })
      .from(products)
      .where(eq(products.status, "live"));
    for (const r of rows) {
      const country = r.country || "Nigeria";
      const arr = map.get(country) ?? [];
      if (r.state && !arr.includes(r.state)) arr.push(r.state);
      if (!map.has(country)) map.set(country, arr);
    }
    return [...map.entries()].map(([country, states]) => ({ country, states: states.sort() }));
  }),

  /** Commission calculator: given product id + viewer plan code, return full split */
  calculator: publicQuery
    .input(z.object({ productId: z.number(), category: z.string().max(20).default("pro") }))
    .query(async ({ input }) => {
      const db = getDb();
      const [p] = await db.select().from(products).where(eq(products.id, input.productId));
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      const [cat] = await db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, p.categoryId));
      const pct = p.commissionPct ?? cat?.commissionPct ?? 10;
      const direct = Math.round((p.price * pct) / 100);
      const depth = await chainDepthFor(input.category);
      const chain = CHAIN_SPLIT.map((share, i) => ({
        level: i + 1,
        pct: share,
        amount: Math.round((direct * share) / 100),
        eligible: depth >= i + 1,
      }));
      const chainTotal = chain.filter((c) => c.eligible).reduce((s, c) => s + c.amount, 0);
      return {
        product: p,
        pct,
        direct,
        chain,
        chainTotal,
        total: direct + chainTotal,
        depth,
        typeName: cat?.name ?? "Land",
      };
    }),
});

export const salesRouter = createRouter({
  /**
   * Member reports a sale for approval — ALL evidence fields are compulsory:
   * product, amount paid, payment date, sender name, description, receipt image.
   * An authorised admin then exports the request to the finance office.
   */
  submit: authedQuery
    .input(
      z.object({
        productId: z.number(),
        salePrice: z.number().positive(),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date the payment was made"),
        senderName: z.string().trim().min(2, "Name of the person who sent the payment is required").max(160),
        description: z.string().trim().min(5, "Describe the sale — plot, payment type, buyer, etc.").max(2000),
        receiptUrl: z.string().trim().min(1, "Upload the payment receipt image").max(500),
        buyerName: z.string().max(160).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED", message: "Register first" });
      if (!m.notificationSetupDone)
        throw new TRPCError({ code: "FORBIDDEN", message: "Complete notification setup first" });
      if (m.status !== "active")
        throw new TRPCError({ code: "FORBIDDEN", message: "Membership not active" });
      // the receipt must be a file uploaded through our own uploader
      if (!input.receiptUrl.startsWith("/uploads/receipt/"))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload the payment receipt image first." });
      const db = getDb();
      const [p] = await db.select().from(products).where(eq(products.id, input.productId));
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      await db.insert(sales).values({
        productId: input.productId,
        sellerId: m.id,
        buyerName: input.buyerName,
        salePrice: input.salePrice,
        paymentDate: input.paymentDate,
        senderName: input.senderName.trim(),
        description: input.description.trim(),
        receiptUrl: input.receiptUrl.trim(),
        status: "pending",
      });
      await notifyAdmins(
        "admin_task",
        "Commission request submitted",
        `${m.firstName} ${m.lastName} reported a sale of ${p.name} — ₦${input.salePrice.toLocaleString()} paid by ${input.senderName.trim()} on ${input.paymentDate}. Receipt attached.`,
        "/admin/commissions"
      );
      return { ok: true };
    }),

  mine: authedQuery.query(async ({ ctx }) => {
    const m = await myMember(ctx.user.id);
    if (!m) return [];
    const db = getDb();
    const rows = await db
      .select({ sale: sales, product: products })
      .from(sales)
      .leftJoin(products, eq(sales.productId, products.id))
      .where(eq(sales.sellerId, m.id))
      .orderBy(desc(sales.createdAt));
    return rows;
  }),

  requestWithdrawal: authedQuery
    .input(z.object({ commissionId: z.number(), bankDetails: z.string().min(5).max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!m.notificationSetupDone)
        throw new TRPCError({ code: "FORBIDDEN", message: "Complete notification setup first" });
      // payout account comes from the member's profile — set once, reused forever
      const saved =
        m.bankName && m.accountNumber && m.accountName
          ? `${m.bankName}\n${m.accountNumber}\n${m.accountName}`
          : null;
      const bankDetails = input.bankDetails ?? saved;
      if (!bankDetails)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Set up your payout bank account in Profile → Payout bank account first.",
        });
      const db = getDb();
      const [c] = await db.select().from(commissions).where(eq(commissions.id, input.commissionId));
      if (!c || c.memberId !== m.id) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.status !== "approved")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Commission not withdrawable" });
      await db.insert(withdrawals).values({
        memberId: m.id,
        commissionId: c.id,
        amount: c.amount,
        bankDetails,
        status: "pending",
      });
      await db.update(commissions).set({ status: "paid" }).where(eq(commissions.id, c.id));
      await notifyAdmins(
        "admin_task",
        "Withdrawal requested",
        `${m.firstName} ${m.lastName} requested ₦${c.amount.toLocaleString()} payout.`,
        "/admin/commissions"
      );
      return { ok: true };
    }),

  myWithdrawals: authedQuery.query(async ({ ctx }) => {
    const m = await myMember(ctx.user.id);
    if (!m) return [];
    const db = getDb();
    return db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.memberId, m.id))
      .orderBy(desc(withdrawals.createdAt));
  }),
});

export const pointsRouter = createRouter({
  rewards: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(rewards).where(eq(rewards.status, "live"));
  }),

  redeem: authedQuery
    .input(z.object({ rewardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      const mPlan = await getPlan(m.category);
      if (!mPlan?.pointsEligible)
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            m.pointsBalance > 0
              ? "Your points are safe but frozen on Basic access — renew a paid plan to redeem them."
              : "Your membership plan does not earn points — upgrade to join the rewards programme.",
        });
      const db = getDb();
      const [r] = await db.select().from(rewards).where(eq(rewards.id, input.rewardId));
      if (!r || r.status !== "live") throw new TRPCError({ code: "NOT_FOUND" });
      if (m.pointsBalance < r.pointCost)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough points" });
      await db
        .update(members)
        .set({ pointsBalance: sql`points_balance - ${r.pointCost}` })
        .where(eq(members.id, m.id));
      await db.insert(pointsLedger).values({
        memberId: m.id,
        action: "redeem",
        points: -r.pointCost,
        meta: r.name,
      });
      await db.insert(redemptions).values({
        memberId: m.id,
        rewardId: r.id,
        pointsSpent: r.pointCost,
        status: "pending",
      });
      await notifyAdmins(
        "admin_task",
        "Reward redemption requested",
        `${m.firstName} ${m.lastName} redeemed ${r.name} (${r.pointCost.toLocaleString()} pts).`,
        "/admin/points"
      );
      return { ok: true };
    }),

  myRedemptions: authedQuery.query(async ({ ctx }) => {
    const m = await myMember(ctx.user.id);
    if (!m) return [];
    const db = getDb();
    const rows = await db
      .select({ redemption: redemptions, reward: rewards })
      .from(redemptions)
      .leftJoin(rewards, eq(redemptions.rewardId, rewards.id))
      .where(eq(redemptions.memberId, m.id))
      .orderBy(desc(redemptions.createdAt));
    return rows;
  }),

  /**
   * Pay for a gift with the PROPERTY VOUCHER instead of points. The voucher is
   * spendable from day one — on products and on gift items alike. Admin
   * confirms delivery from the redemptions queue.
   */
  redeemWithVoucher: authedQuery
    .input(z.object({ rewardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (m.status !== "active")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: m.status === "expired"
            ? "Your membership year has ended — renew to keep using your voucher."
            : "Your membership must be active to use your voucher.",
        });
      const db = getDb();
      const [r] = await db.select().from(rewards).where(eq(rewards.id, input.rewardId));
      if (!r || r.status !== "live") throw new TRPCError({ code: "NOT_FOUND" });
      if (!r.voucherCost || r.voucherCost <= 0)
        throw new TRPCError({ code: "BAD_REQUEST", message: "This gift is redeemed with points, not the voucher." });

      if (m.voucherBalance < r.voucherCost)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Your voucher balance is ₦${m.voucherBalance.toLocaleString()} — this gift costs ₦${r.voucherCost.toLocaleString()} of voucher.`,
        });

      const newBalance = m.voucherBalance - r.voucherCost;
      await db.update(members).set({ voucherBalance: newBalance }).where(eq(members.id, m.id));
      await db.insert(voucherTransactions).values({
        memberId: m.id,
        amount: -r.voucherCost,
        balanceAfter: newBalance,
        note: `Voucher redeemed for gift: ${r.name} — awaiting admin confirmation`,
      });
      await db.insert(redemptions).values({
        memberId: m.id,
        rewardId: r.id,
        pointsSpent: 0,
        voucherSpent: r.voucherCost,
        status: "pending",
      });
      await notifyAdmins(
        "admin_task",
        "Voucher gift redemption requested",
        `${m.firstName} ${m.lastName} redeemed ${r.name} with ₦${r.voucherCost.toLocaleString()} of their property voucher.`,
        "/admin/points"
      );
      return { ok: true, balance: newBalance };
    }),

  /** Voucher wallet + gift-unlock state for the Rewards page. */
  voucherWallet: authedQuery.query(async ({ ctx }) => {
    const m = await myMember(ctx.user.id);
    if (!m) return null;
    const db = getDb();
    const rows = await db
      .select()
      .from(voucherTransactions)
      .where(eq(voucherTransactions.memberId, m.id))
      .orderBy(desc(voucherTransactions.createdAt))
      .limit(50);
    const credited = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const spent = rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
    return { balance: m.voucherBalance, credited, spent, rows };
  }),

  /** Points leaderboard — members on points-earning plans (Pro and above). Founder accounts never appear. */
  pointsLeaderboard: publicQuery.query(async () => {
    const db = getDb();
    const { membershipPlans, users } = await import("../../db/schema");
    const plans = await db.select().from(membershipPlans);
    const codes = plans.filter((p) => p.pointsEligible).map((p) => p.code);
    if (!codes.length) return [];
    const founderRows = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [ADMIN_EMAIL, FOUNDER_EMAIL]));
    const founderIds = founderRows.map((r) => r.id);
    const conds = [eq(members.status, "active"), inArray(members.category, codes)];
    if (founderIds.length) conds.push(notInArray(members.userId, founderIds));
    return db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        category: members.category,
        points: members.pointsBalance,
      })
      .from(members)
      .where(and(...conds, sql`${members.pointsBalance} > 0`))
      .orderBy(desc(members.pointsBalance))
      .limit(20);
  }),

  /** Recruitment leaderboard — all-time referred joins per referrer (chain-earning plans compete). Founder accounts never appear. */
  recruitmentLeaderboard: publicQuery.query(async () => {
    const db = getDb();
    const { membershipPlans, users } = await import("../../db/schema");
    const plans = await db.select().from(membershipPlans);
    const codes = plans.filter((p) => p.chainDepth > 0).map((p) => p.code);
    if (!codes.length) return [];
    const founderRows = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [ADMIN_EMAIL, FOUNDER_EMAIL]));
    const founderIds = founderRows.map((r) => r.id);
    const conds = [eq(members.status, "active"), inArray(members.category, codes)];
    if (founderIds.length) conds.push(notInArray(members.userId, founderIds));
    const [eligible, counts] = await Promise.all([
      db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          category: members.category,
        })
        .from(members)
        .where(and(...conds))
        .limit(500),
      db
        .select({ referrerId: members.referrerId, n: sql<number>`COUNT(*)` })
        .from(members)
        .where(sql`${members.referrerId} IS NOT NULL`)
        .groupBy(members.referrerId),
    ]);
    const joinMap = new Map(counts.map((c) => [c.referrerId, Number(c.n)]));
    return eligible
      .map((m) => ({ ...m, joins: joinMap.get(m.id) ?? 0 }))
      .filter((m) => m.joins > 0)
      .sort((a, b) => b.joins - a.joins)
      .slice(0, 20);
  }),

  /** Top product sellers — total APPROVED sales volume + count per seller.
   *  Pro and above only (points-eligible plans). Founder accounts never appear. */
  salesLeaderboard: publicQuery.query(async () => {
    const db = getDb();
    const { membershipPlans, users } = await import("../../db/schema");
    const plans = await db.select().from(membershipPlans);
    const codes = plans.filter((p) => p.pointsEligible).map((p) => p.code);
    if (!codes.length) return [];
    const founderRows = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [ADMIN_EMAIL, FOUNDER_EMAIL]));
    const founderIds = founderRows.map((r) => r.id);
    const conds = [eq(members.status, "active"), inArray(members.category, codes)];
    if (founderIds.length) conds.push(notInArray(members.userId, founderIds));
    const [eligible, agg] = await Promise.all([
      db
        .select({ id: members.id, firstName: members.firstName, lastName: members.lastName, category: members.category })
        .from(members)
        .where(and(...conds))
        .limit(500),
      db
        .select({
          sellerId: sales.sellerId,
          vol: sql<number>`COALESCE(SUM(${sales.salePrice}), 0)`,
          n: sql<number>`COUNT(*)`,
        })
        .from(sales)
        .where(eq(sales.status, "approved"))
        .groupBy(sales.sellerId),
    ]);
    const aggMap = new Map(agg.map((a) => [a.sellerId, { vol: Number(a.vol), n: Number(a.n) }]));
    return eligible
      .map((m) => ({ ...m, volume: aggMap.get(m.id)?.vol ?? 0, salesCount: aggMap.get(m.id)?.n ?? 0 }))
      .filter((m) => m.salesCount > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);
  }),
});

export const trackRouter = createRouter({
  /** Record a click on a referral link (public). Returns the referral target info. */
  visit: publicQuery
    .input(z.object({ code: z.string().max(20), referrerUrl: z.string().max(500).optional(), deviceType: z.string().max(20).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [ref] = await db
        .select()
        .from(members)
        .where(eq(members.referralCode, input.code.toUpperCase()));
      if (!ref) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid link" });
      const ip =
        ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        ctx.req.headers.get("x-real-ip") ||
        "unknown";
      const ua = ctx.req.headers.get("user-agent") ?? "unknown";
      const visitorKey = crypto.createHash("sha256").update(ip + ua).digest("hex").slice(0, 40);
      // unique = first visit from this visitor today
      const [dupe] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(linkVisits)
        .where(
          and(
            eq(linkVisits.memberId, ref.id),
            eq(linkVisits.visitorKey, visitorKey),
            sql`created_at > NOW() - INTERVAL 1 DAY`
          )
        );
      const isUnique = !(dupe && Number(dupe.n) > 0);
      await db.insert(linkVisits).values({
        memberId: ref.id,
        visitorKey,
        referrerUrl: input.referrerUrl,
        deviceType: input.deviceType,
        isUniqueToday: isUnique,
      });
      // Points-earning plans get points on unique clicks only (anti-gaming)
      const refPlan = await getPlan(ref.category);
      if (isUnique && refPlan?.pointsEligible) {
        const { creditPoints, getPointRule } = await import("../queries/engine");
        const per = parseInt(await getPointRule("link_click", "1"));
        await creditPoints(ref.id, "link_click", per, "Unique link visit");
      }
      return { name: `${ref.firstName} ${ref.lastName}`, code: ref.referralCode };
    }),
});

/* ----------------------------------- blog ---------------------------------- */

export const blogRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        excerpt: blogPosts.excerpt,
        coverTheme: blogPosts.coverTheme,
        coverImage: blogPosts.coverImage,
        videoUrl: blogPosts.videoUrl,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(eq(blogPosts.status, "published"))
      .orderBy(desc(blogPosts.publishedAt));
  }),

  get: publicQuery.input(z.object({ slug: z.string().max(160) })).query(async ({ input }) => {
    const db = getDb();
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, input.slug), eq(blogPosts.status, "published")));
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
    return post;
  }),
});
