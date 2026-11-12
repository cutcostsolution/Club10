import { z } from "zod";
import { createRouter, adminQuery, centralQuery, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  users,
  members,
  membershipPlans,
  products,
  productCategories,
  productCountries,
  productStates,
  sales,
  commissions,
  withdrawals,
  linkVisits,
  pointRules,
  rewards,
  redemptions,
  pointsLedger,
  siteContent,
  activityLogs,
  courses,
  modules,
  lessons,
  examQuestions,
  exams,
  payments,
  blogPosts,
  starterKitResources,
  settings,
  voucherTransactions,
  aiPlans,
  aiPlanDays,
  aiTaskReports,
  aiMarketingAssets,
} from "../../db/schema";
import { eq, desc, asc, sql, and, like, gte, lte, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { distributeCommissions, notify, payReferralCommission, membershipQuote, registrationCommissionPct } from "../queries/engine";
import { founderTitle, isAdmin, isFounder, reviewerDisplay, ADMIN_EMAIL, FOUNDER_EMAIL } from "../lib/founders";
import { hashPassword, verifyPassword } from "../lib/password";

async function log(userId: number, action: string, module: string, details?: string) {
  const db = getDb();
  await db.insert(activityLogs).values({ userId, action, module, details });
}

export const adminRouter = createRouter({
  overview: adminQuery.query(async () => {
    const db = getDb();
    const [totalMembers] = await db.select({ n: sql<number>`COUNT(*)` }).from(members);
    const [activeMembers] = await db.select({ n: sql<number>`COUNT(*)` }).from(members).where(eq(members.status, "active"));
    const [pendingRegs] = await db.select({ n: sql<number>`COUNT(*)` }).from(members).where(eq(members.status, "pending"));
    const [pendingSales] = await db.select({ n: sql<number>`COUNT(*)` }).from(sales).where(eq(sales.status, "pending"));
    const [pendingValue] = await db
      .select({ s: sql<number>`COALESCE(SUM(sale_price),0)` })
      .from(sales)
      .where(eq(sales.status, "pending"));
    const [totalSales] = await db
      .select({ s: sql<number>`COALESCE(SUM(sale_price),0)`, n: sql<number>`COUNT(*)` })
      .from(sales)
      .where(eq(sales.status, "approved"));
    const [pts] = await db.select({ s: sql<number>`COALESCE(SUM(points_balance),0)` }).from(members);
    const [propsLive] = await db.select({ n: sql<number>`COUNT(*)` }).from(products).where(eq(products.status, "live"));
    const recentSales = await db
      .select({ sale: sales, product: products, seller: members })
      .from(sales)
      .leftJoin(products, eq(sales.productId, products.id))
      .leftJoin(members, eq(sales.sellerId, members.id))
      .orderBy(desc(sales.createdAt))
      .limit(5);
    const pendingMembers = await db
      .select()
      .from(members)
      .where(eq(members.status, "pending"))
      .orderBy(desc(members.createdAt))
      .limit(6);
    const activity = await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(10);
    return {
      totalMembers: Number(totalMembers.n),
      activeMembers: Number(activeMembers.n),
      pendingRegs: Number(pendingRegs.n),
      pendingSales: Number(pendingSales.n),
      pendingValue: Number(pendingValue.s),
      totalSalesValue: Number(totalSales.s),
      totalSalesCount: Number(totalSales.n),
      pointsInCirculation: Number(pts.s),
      propsLive: Number(propsLive.n),
      recentSales,
      pendingMembers,
      activity,
    };
  }),

  /** Deeper analytics with optional filters: product category ("community")
   *  and individual realtor. Drives the Overview charts. */
  analytics: adminQuery
    .input(z.object({ categoryId: z.number().optional(), memberId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const saleConds = [];
      if (input?.categoryId) saleConds.push(eq(products.categoryId, input.categoryId));
      if (input?.memberId) saleConds.push(eq(sales.sellerId, input.memberId));

      const filtered = await db
        .select({ sale: sales, product: products, seller: members })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .leftJoin(members, eq(sales.sellerId, members.id))
        .where(saleConds.length ? and(...saleConds) : undefined)
        .orderBy(desc(sales.createdAt))
        .limit(2000);

      // members by plan
      const planCounts = await db
        .select({ category: members.category, n: sql<number>`COUNT(*)` })
        .from(members)
        .groupBy(members.category);
      const plans = await db.select().from(membershipPlans).orderBy(asc(membershipPlans.sortOrder));
      const membersByPlan = plans.map((p) => ({
        code: p.code,
        name: p.name,
        count: Number(planCounts.find((c) => c.category === p.code)?.n ?? 0),
      }));

      // monthly sales trend (last 6 months, approved)
      const byMonth = new Map<string, { value: number; count: number }>();
      for (const r of filtered) {
        if (r.sale.status !== "approved") continue;
        const key = r.sale.createdAt.toISOString().slice(0, 7);
        const cur = byMonth.get(key) ?? { value: 0, count: 0 };
        cur.value += r.sale.salePrice;
        cur.count += 1;
        byMonth.set(key, cur);
      }
      const salesByMonth = [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, v]) => ({ month, ...v }));

      // top realtors by approved sales value (within the filter)
      const byRealtor = new Map<number, { name: string; value: number; count: number }>();
      for (const r of filtered) {
        if (r.sale.status !== "approved" || !r.seller) continue;
        const cur = byRealtor.get(r.seller.id) ?? {
          name: `${r.seller.firstName} ${r.seller.lastName}`,
          value: 0,
          count: 0,
        };
        cur.value += r.sale.salePrice;
        cur.count += 1;
        byRealtor.set(r.seller.id, cur);
      }
      const topRealtors = [...byRealtor.values()].sort((a, b) => b.value - a.value).slice(0, 8);

      // sales by product category ("communities")
      const byCat = new Map<string, { value: number; count: number }>();
      for (const r of filtered) {
        if (r.sale.status !== "approved") continue;
        const key = r.product?.name ?? "Unknown";
        const cur = byCat.get(key) ?? { value: 0, count: 0 };
        cur.value += r.sale.salePrice;
        cur.count += 1;
        byCat.set(key, cur);
      }
      const salesByProduct = [...byCat.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      // pipeline status breakdown (within the filter)
      const statusCount = { pending: 0, approved: 0, rejected: 0 };
      for (const r of filtered) statusCount[r.sale.status as keyof typeof statusCount]++;

      // filter dropdown data
      const categories = await db.select().from(productCategories).orderBy(asc(productCategories.sortOrder));
      const realtors = await db
        .select({ id: members.id, firstName: members.firstName, lastName: members.lastName })
        .from(members)
        .where(eq(members.status, "active"))
        .orderBy(asc(members.firstName))
        .limit(500);

      return {
        membersByPlan,
        salesByMonth,
        topRealtors,
        salesByProduct,
        statusCount,
        categories,
        realtors,
      };
    }),

  /* ---------------------------- admin accounts ---------------------------- */
  /**
   * List admin accounts (Central Admin only).
   * SECURITY: Charity's admin identity is hidden from everyone but herself —
   * Moses and any other admin must not know she is an admin.
   */
  listAdmins: centralQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        adminRole: users.adminRole,
        createdAt: users.createdAt,
        lastSignInAt: users.lastSignInAt,
      })
      .from(users)
      .where(eq(users.role, "admin"))
      .orderBy(asc(users.createdAt));
    return rows
      .filter((r) => !isAdmin(r.email) || isAdmin(ctx.user.email))
      .map((r) => ({ ...r, title: founderTitle(r.email) }));
  }),

  /**
   * There is NO form-based admin creation anymore — admins are appointed
   * from registered members only (grantAdminByMember below), and access is
   * removed by demoting back to member (revokeAdmin), never by deleting
   * the person's account.
   */

  /** Any admin changes their OWN password. */
  changePassword: adminQuery
    .input(
      z.object({
        currentPassword: z.string().min(1).max(100),
        newPassword: z.string().min(8, "Password must be at least 8 characters").max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      if (!u?.passwordHash || !(await verifyPassword(input.currentPassword, u.passwordHash)))
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is wrong." });
      await db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, u.id));
      await log(ctx.user.id, "change_password", "settings", "own password");
      return { ok: true };
    }),

  /* ------------------------------- realtors ------------------------------- */
  membersList: adminQuery
    .input(
      z.object({
        status: z.string().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.status) conds.push(eq(members.status, input.status as any));
      if (input.category) conds.push(eq(members.category, input.category as any));
      if (input.search)
        conds.push(
          sql`(first_name LIKE ${"%" + input.search + "%"} OR last_name LIKE ${"%" + input.search + "%"} OR membership_code LIKE ${"%" + input.search + "%"})`
        );
      if (input.from) conds.push(gte(members.createdAt, new Date(input.from)));
      if (input.to) conds.push(lte(members.createdAt, new Date(input.to)));
      const rows = await db
        .select()
        .from(members)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(members.createdAt))
        .limit(200);
      // attach the inviter's name/code to every row — approval decisions need it
      const refIds = [...new Set(rows.map((r) => r.referrerId).filter((x): x is number => x != null))];
      const refs = refIds.length
        ? await db.select().from(members).where(inArray(members.id, refIds))
        : [];
      const refMap = new Map(refs.map((r) => [r.id, r]));
      // NOTE: the admin console always shows the real plan — the
      // background-monitoring mask applies to member/public views only.
      return rows.map((r) => ({
        ...r,
        category: r.category, // admin console always sees the real plan (masking is for member/public views)
        inviter: r.referrerId
          ? {
              id: r.referrerId,
              name: `${refMap.get(r.referrerId)?.firstName ?? ""} ${refMap.get(r.referrerId)?.lastName ?? ""}`.trim(),
              code: refMap.get(r.referrerId)?.membershipCode ?? "",
            }
          : null,
      }));
    }),

  approveMember: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const [m] = await db.select().from(members).where(eq(members.id, input.id));
    if (!m) throw new TRPCError({ code: "NOT_FOUND" });
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, m.category));
    // Registration commission is paid ONCE — on first activation only.
    // Commission first — if it fails the member stays pending and retry is safe.
    if (m.status === "pending") await payReferralCommission(m.id);
    // Voucher is credited HERE — when the membership is approved/confirmed, not at registration.
    const approveBal = plan && plan.voucherAmount > m.voucherBalance ? plan.voucherAmount : m.voucherBalance;
    await db
      .update(members)
      .set({
        status: "active",
        voucherBalance: approveBal,
        expiresAt: new Date(Date.now() + 365 * 86400000),
      })
      .where(eq(members.id, m.id));
    if (approveBal > m.voucherBalance) {
      await db.insert(voucherTransactions).values({
        memberId: m.id,
        amount: approveBal - m.voucherBalance,
        balanceAfter: approveBal,
        note: `${plan?.name ?? m.category} membership confirmed — property voucher credited`,
      });
    }
    await notify(m.userId, "system", "Membership approved", `Welcome to Club 10 — your ${plan?.name ?? m.category} membership is now active.`, "/app");
    await log(ctx.user.id, "approve_member", "realtors", `${m.firstName} ${m.lastName} (${m.membershipCode})`);
    return { ok: true };
  }),

  setMemberStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["pending", "active", "suspended", "expired"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(members).set({ status: input.status }).where(eq(members.id, input.id));
      await log(ctx.user.id, "set_status", "realtors", `member ${input.id} → ${input.status}`);
      return { ok: true };
    }),

  setMemberCategory: adminQuery
    .input(z.object({ id: z.number(), category: z.string().min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [m] = await db.select().from(members).where(eq(members.id, input.id));
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      const [mu] = await db.select({ email: users.email }).from(users).where(eq(users.id, m.userId));
      if (mu && isAdmin(mu.email) && !isAdmin(ctx.user.email))
        throw new TRPCError({ code: "FORBIDDEN", message: "That account's plan cannot be changed here." });
      const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, input.category));
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown membership plan" });
      // Only ACTIVE members carry a voucher balance — a pending member's plan
      // change just updates the seat; approval will credit the correct amount.
      const newBal = m.status === "active" ? Math.max(m.voucherBalance, plan.voucherAmount) : m.voucherBalance;
      await db
        .update(members)
        .set({ category: plan.code, voucherBalance: newBal })
        .where(eq(members.id, input.id));
      if (newBal > m.voucherBalance) {
        await db.insert(voucherTransactions).values({
          memberId: m.id,
          amount: newBal - m.voucherBalance,
          balanceAfter: newBal,
          note: `Plan change to ${plan.name} — voucher topped up`,
        });
      }
      await notify(m.userId, "system", "Membership plan updated", `You are now on ${plan.name}.`, "/app");
      await log(ctx.user.id, "set_category", "realtors", `member ${input.id} → ${plan.code}`);
      return { ok: true };
    }),

  /** Re-attach a realtor under a different upline — for fixing registrations
   *  that went wrong. Guards against self-parenting and tree cycles. */
  moveMemberUpline: adminQuery
    .input(z.object({ id: z.number(), newUplineId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.id === input.newUplineId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "A realtor can't be their own inviter." });
      const [m] = await db.select().from(members).where(eq(members.id, input.id));
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      const [up] = await db.select().from(members).where(eq(members.id, input.newUplineId));
      if (!up) throw new TRPCError({ code: "NOT_FOUND", message: "New upline not found" });
      // walk the new upline's chain — if we hit this member, the move would loop the tree
      let cursor: number | null = up.referrerId;
      for (let i = 0; i < 15 && cursor != null; i++) {
        if (cursor === input.id)
          throw new TRPCError({ code: "BAD_REQUEST", message: "That would create a loop — the new upline is in this realtor's own downline." });
        const [row] = await db.select({ referrerId: members.referrerId }).from(members).where(eq(members.id, cursor));
        cursor = row?.referrerId ?? null;
      }
      await db.update(members).set({ referrerId: input.newUplineId }).where(eq(members.id, input.id));
      await log(
        ctx.user.id,
        "move_upline",
        "realtors",
        `member ${input.id} (${m.firstName} ${m.lastName}) moved under ${up.firstName} ${up.lastName} (${up.membershipCode})`
      );
      return { ok: true };
    }),

  /** Grant an existing member admin access — search the member, pick the tier,
   *  done. No second registration, their login just opens the admin panel. */
  grantAdminByMember: centralQuery
    .input(z.object({ memberId: z.number(), adminRole: z.enum(["central", "manager"]).default("manager") }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [m] = await db.select().from(members).where(eq(members.id, input.memberId));
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      const [u] = await db.select().from(users).where(eq(users.id, m.userId));
      if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "That member has no login account" });
      if (u.role === "admin")
        throw new TRPCError({ code: "BAD_REQUEST", message: `${m.firstName} ${m.lastName} already has ${u.adminRole ?? "admin"} access.` });
      await db.update(users).set({ role: "admin", adminRole: input.adminRole }).where(eq(users.id, u.id));
      await notify(
        m.userId,
        "system",
        "Admin access granted",
        `You now have ${input.adminRole === "central" ? "Central Admin" : "Admin"} access to the Club 10 back-office. Open the Admin panel from your dashboard.`,
        "/admin"
      );
      await log(ctx.user.id, "grant_admin", "settings", `${m.firstName} ${m.lastName} (${m.membershipCode}) → ${input.adminRole}`);
      return { ok: true };
    }),

  /** Withdraw admin access — the account stays a normal member.
   *  Founder rules: nobody can revoke Charity (the Admin); only Charity can
   *  revoke Moses (the Founder); both can revoke anyone else. */
  revokeAdmin: centralQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.userId === ctx.user.id)
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't revoke your own access." });
      const [target] = await db.select().from(users).where(eq(users.id, input.userId));
      if (!target || target.role !== "admin")
        throw new TRPCError({ code: "NOT_FOUND", message: "Admin account not found" });
      if (isAdmin(target.email))
        throw new TRPCError({ code: "FORBIDDEN", message: "Charity Wealth is the Admin — her access can never be revoked." });
      if (isFounder(target.email) && !isAdmin(ctx.user.email))
        throw new TRPCError({ code: "FORBIDDEN", message: "Moses is a Founder — only Charity (the Admin) can revoke his access." });
      if (target.adminRole === "central") {
        const [centralCount] = await db
          .select({ n: sql<number>`COUNT(*)` })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.adminRole, "central")));
        if (Number(centralCount.n) <= 1)
          throw new TRPCError({ code: "BAD_REQUEST", message: "There must always be at least one Central Admin." });
      }
      await db.update(users).set({ role: "user", adminRole: null }).where(eq(users.id, input.userId));
      await log(ctx.user.id, "revoke_admin", "settings", `${target.name} <${target.email}> access revoked`);
      return { ok: true };
    }),

  /* --------------------------- starter kit admin --------------------------- */
  listStarterKit: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(starterKitResources).orderBy(starterKitResources.sortOrder, starterKitResources.id);
  }),

  saveStarterKit: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        title: z.string().min(1).max(160),
        description: z.string().max(1000).optional(),
        kind: z.enum(["file", "link"]),
        url: z.string().min(1).max(2000),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
        // plan codes that can see this resource; empty = every member
        plans: z.array(z.string().max(40)).max(20).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, plans: planList, ...rest } = input;
      const data = { ...rest, plans: planList.length ? planList.join(",") : null };
      if (id) {
        await db.update(starterKitResources).set(data).where(eq(starterKitResources.id, id));
      } else {
        await db.insert(starterKitResources).values(data);
      }
      await log(ctx.user.id, id ? "edit_starter_kit" : "add_starter_kit", "starter kit", input.title);
      return { ok: true };
    }),

  deleteStarterKit: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(starterKitResources).where(eq(starterKitResources.id, input.id));
      await log(ctx.user.id, "delete_starter_kit", "starter kit", `resource ${input.id}`);
      return { ok: true };
    }),

  /** Full 360° view of one realtor: bio-data, who invited them, their referral
   *  link, their direct downline, sales and earnings. */
  memberDetail: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [m] = await db.select().from(members).where(eq(members.id, input.id));
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      const [u] = await db.select().from(users).where(eq(users.id, m.userId));
      const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, m.category));
      const [inviter] = m.referrerId
        ? await db.select().from(members).where(eq(members.id, m.referrerId))
        : [null];
      const downline = await db
        .select()
        .from(members)
        .where(eq(members.referrerId, m.id))
        .orderBy(desc(members.createdAt));
      const memberSales = await db
        .select({ sale: sales, product: products })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .where(eq(sales.sellerId, m.id))
        .orderBy(desc(sales.createdAt))
        .limit(50);
      const [earned] = await db
        .select({ s: sql<number>`COALESCE(SUM(amount),0)` })
        .from(commissions)
        .where(and(eq(commissions.memberId, m.id), inArray(commissions.status, ["approved", "paid"])));
      const voucherTx = await db
        .select()
        .from(voucherTransactions)
        .where(eq(voucherTransactions.memberId, m.id))
        .orderBy(desc(voucherTransactions.createdAt))
        .limit(50);
      // 30-day AI marketing plan progress (latest plan)
      const [aiPlan] = await db
        .select()
        .from(aiPlans)
        .where(eq(aiPlans.memberId, m.id))
        .orderBy(desc(aiPlans.createdAt))
        .limit(1);
      let aiPlanSummary = null;
      if (aiPlan) {
        const planDays = await db.select().from(aiPlanDays).where(eq(aiPlanDays.planId, aiPlan.id));
        const totalTasks = planDays.reduce((sum, d) => sum + (d.tasks?.length ?? 0), 0);
        const reports = await db
          .select()
          .from(aiTaskReports)
          .where(eq(aiTaskReports.planId, aiPlan.id))
          .orderBy(desc(aiTaskReports.createdAt));
        const [aiProduct] = aiPlan.productId
          ? await db.select().from(products).where(eq(products.id, aiPlan.productId))
          : [null];
        aiPlanSummary = {
          id: aiPlan.id,
          title: aiPlan.title,
          status: aiPlan.status,
          createdAt: aiPlan.createdAt,
          productName: aiProduct?.name ?? null,
          totalTasks,
          doneTasks: reports.length,
          percent: totalTasks ? Math.round((reports.length / totalTasks) * 100) : 0,
          recentReports: reports.slice(0, 10),
        };
      }
      // SECURITY: Charity's admin identity is hidden from everyone but herself —
      // other admins (including Moses) see her as an ordinary member account.
      const hideCharityAdmin = u && isAdmin(u.email) && !isAdmin(ctx.user.email);
      return {
        member: m ?? m, // admin console sees the real category — masking applies outside
        user: u
          ? {
              email: u.email,
              phone: u.phone,
              lastSignInAt: u.lastSignInAt,
              role: hideCharityAdmin ? "member" : u.role,
              adminRole: hideCharityAdmin ? null : u.adminRole,
            }
          : null,
        plan: plan ?? null,
        inviter: inviter ?? null,
        downline,
        sales: memberSales,
        voucherTx,
        totalEarned: Number(earned.s),
        aiPlan: aiPlanSummary,
      };
    }),


  /* --------------------------- AI marketing tracker --------------------------- */
  /** Every member's AI marketing activity: 30-day plan progress + quick-tool usage. */
  aiTracker: adminQuery.query(async () => {
    const db = getDb();
    const allPlans = await db
      .select({ plan: aiPlans, member: members, product: products })
      .from(aiPlans)
      .innerJoin(members, eq(aiPlans.memberId, members.id))
      .leftJoin(products, eq(aiPlans.productId, products.id))
      .orderBy(desc(aiPlans.createdAt))
      .limit(300);

    type TrackerRow = {
      planId: number | null;
      memberId: number;
      memberName: string;
      membershipCode: string;
      category: string;
      memberStatus: string;
      title: string;
      goal: string | null;
      productName: string | null;
      status: string;
      createdAt: Date | null;
      totalTasks: number;
      doneTasks: number;
      percent: number;
      currentDay: number;
      lastReportAt: string | null;
      generations: number;
      lastGenerationAt: string | null;
    };
    const rows: TrackerRow[] = [];
    for (const r of allPlans) {
      const days = await db.select().from(aiPlanDays).where(eq(aiPlanDays.planId, r.plan.id));
      const totalTasks = days.reduce((sum, d) => sum + (d.tasks?.length ?? 0), 0);
      const [doneRow] = await db
        .select({ n: sql<number>`COUNT(*)`, last: sql<string | null>`MAX(created_at)` })
        .from(aiTaskReports)
        .where(eq(aiTaskReports.planId, r.plan.id));
      const done = doneRow?.n ?? 0;
      const currentDay = Math.min(
        30,
        Math.max(1, Math.floor((Date.now() - new Date(r.plan.createdAt).getTime()) / 86_400_000) + 1)
      );
      rows.push({
        planId: r.plan.id,
        memberId: r.member.id,
        memberName: `${r.member.firstName} ${r.member.lastName}`,
        membershipCode: r.member.membershipCode,
        category: r.member.category,
        memberStatus: r.member.status,
        title: r.plan.title,
        goal: r.plan.goal,
        productName: r.product?.name ?? null,
        status: r.plan.status,
        createdAt: r.plan.createdAt,
        totalTasks,
        doneTasks: done,
        percent: totalTasks ? Math.round((done / totalTasks) * 100) : 0,
        currentDay,
        lastReportAt: doneRow?.last ?? null,
        generations: 0,
        lastGenerationAt: null,
      });
    }

    // quick-tool (listing / broadcast / follow-up / daily guide) usage per member
    const assetRows = await db
      .select({
        memberId: aiMarketingAssets.memberId,
        n: sql<number>`COUNT(*)`,
        last: sql<string | null>`MAX(created_at)`,
      })
      .from(aiMarketingAssets)
      .groupBy(aiMarketingAssets.memberId)
      .limit(500);
    const assetMap = new Map(assetRows.map((a) => [a.memberId, { count: a.n, last: a.last }]));
    for (const r of rows) {
      const a = assetMap.get(r.memberId);
      r.generations = a?.count ?? 0;
      r.lastGenerationAt = a?.last ?? null;
      assetMap.delete(r.memberId);
    }
    // members who used quick tools but never built a plan
    const leftoverIds = [...assetMap.keys()];
    if (leftoverIds.length) {
      const leftoverMembers = await db.select().from(members).where(inArray(members.id, leftoverIds));
      for (const m of leftoverMembers) {
        const a = assetMap.get(m.id)!;
        rows.push({
          planId: null,
          memberId: m.id,
          memberName: `${m.firstName} ${m.lastName}`,
          membershipCode: m.membershipCode,
          category: m.category,
          memberStatus: m.status,
          title: "(no 30-day plan)",
          goal: null,
          productName: null,
          status: "none",
          createdAt: null,
          totalTasks: 0,
          doneTasks: 0,
          percent: 0,
          currentDay: 0,
          lastReportAt: null,
          generations: a.count,
          lastGenerationAt: a.last,
        });
      }
    }
    rows.sort((a, b) => {
      const ta = new Date(a.lastReportAt ?? a.lastGenerationAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.lastReportAt ?? b.lastGenerationAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    });

    // founder accounts are background monitoring protocols — never tracked
    const founderRows = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [ADMIN_EMAIL, FOUNDER_EMAIL]));
    const founderUserIds = founderRows.map((f) => f.id);
    if (founderUserIds.length) {
      const fm = await db.select({ id: members.id }).from(members).where(inArray(members.userId, founderUserIds));
      const fmIds = new Set(fm.map((f) => f.id));
      for (let i = rows.length - 1; i >= 0; i--) if (fmIds.has(rows[i].memberId)) rows.splice(i, 1);
    }


    return rows;
  }),

  /** Full plan detail for one member: every day, every task, every report. */
  aiPlanDetail: adminQuery
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [m] = await db.select().from(members).where(eq(members.id, input.memberId));
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      const [plan] = await db
        .select()
        .from(aiPlans)
        .where(eq(aiPlans.memberId, m.id))
        .orderBy(desc(aiPlans.createdAt))
        .limit(1);
      if (!plan) return null;
      const days = await db.select().from(aiPlanDays).where(eq(aiPlanDays.planId, plan.id)).orderBy(aiPlanDays.day);
      const reports = await db
        .select()
        .from(aiTaskReports)
        .where(eq(aiTaskReports.planId, plan.id))
        .orderBy(desc(aiTaskReports.createdAt));
      const [product] = plan.productId
        ? await db.select().from(products).where(eq(products.id, plan.productId))
        : [null];
      const totalTasks = days.reduce((sum, d) => sum + (d.tasks?.length ?? 0), 0);
      return {
        member: { id: m.id, name: `${m.firstName} ${m.lastName}`, code: m.membershipCode, category: m.category },
        plan,
        productName: product?.name ?? null,
        days: days.map((d) => ({ id: d.id, day: d.day, title: d.title, tasks: d.tasks })),
        reports,
        stats: {
          totalTasks,
          doneTasks: reports.length,
          percent: totalTasks ? Math.round((reports.length / totalTasks) * 100) : 0,
        },
      };
    }),

  /* ------------------------------- properties ------------------------------ */
  productsList: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ product: products, category: productCategories })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .orderBy(desc(products.createdAt));
    return rows;
  }),

  saveProduct: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        categoryId: z.number(),
        name: z.string().min(1).max(160),
        tag: z.string().max(80).optional(),
        description: z.string().optional(),
        price: z.number().positive(),
        priceLabel: z.string().max(60).optional(),
        location: z.string().max(160).optional(),
        country: z.string().max(80).optional(),
        state: z.string().max(80).optional(),
        titleStatus: z.string().max(80).optional(),
        commissionPct: z.number().min(0).max(100).optional().nullable(),
        sellingNotes: z.string().optional(),
        highlights: z.string().optional(),
        features: z.string().optional(),
        paymentPlan: z.string().optional(),
        imageUrl: z.string().max(2000).optional().nullable(),
        imageTheme: z.string().max(30).optional(),
        status: z.enum(["live", "draft", "sold", "coming_soon"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(products).set(data).where(eq(products.id, id));
        await log(ctx.user.id, "edit_product", "properties", data.name);
      } else {
        await db.insert(products).values(data);
        await log(ctx.user.id, "create_product", "properties", data.name);
      }
      return { ok: true };
    }),

  deleteProduct: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    await db.delete(products).where(eq(products.id, input.id));
    await log(ctx.user.id, "delete_product", "properties", `#${input.id}`);
    return { ok: true };
  }),

  saveCategory: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(80),
        description: z.string().optional(),
        commissionPct: z.number().min(0).max(100),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) await db.update(productCategories).set(data).where(eq(productCategories.id, id));
      else await db.insert(productCategories).values(data);
      await log(ctx.user.id, "save_category", "properties", data.name);
      return { ok: true };
    }),

  /* ---------------------- location directory (countries) --------------------- */
  listLocations: adminQuery.query(async () => {
    const db = getDb();
    const countries = await db.select().from(productCountries).orderBy(productCountries.sortOrder, productCountries.name);
    const states = await db.select().from(productStates).orderBy(productStates.sortOrder, productStates.name);
    return countries.map((c) => ({
      ...c,
      states: states.filter((s) => s.countryId === c.id),
    }));
  }),

  saveCountry: adminQuery
    .input(z.object({ id: z.number().optional(), name: z.string().min(1).max(80), sortOrder: z.number().default(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const name = input.name.trim();
      if (input.id) {
        await db.update(productCountries).set({ name, sortOrder: input.sortOrder }).where(eq(productCountries.id, input.id));
      } else {
        const [dupe] = await db.select().from(productCountries).where(eq(productCountries.name, name));
        if (dupe) throw new TRPCError({ code: "BAD_REQUEST", message: "That country already exists." });
        await db.insert(productCountries).values({ name, sortOrder: input.sortOrder });
      }
      await log(ctx.user.id, "save_country", "properties", name);
      return { ok: true };
    }),

  deleteCountry: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [c] = await db.select().from(productCountries).where(eq(productCountries.id, input.id));
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(productStates).where(eq(productStates.countryId, c.id));
      await db.delete(productCountries).where(eq(productCountries.id, c.id));
      await log(ctx.user.id, "delete_country", "properties", c.name);
      return { ok: true };
    }),

  saveState: adminQuery
    .input(z.object({ id: z.number().optional(), countryId: z.number(), name: z.string().min(1).max(80), sortOrder: z.number().default(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const name = input.name.trim();
      if (input.id) {
        await db.update(productStates).set({ name, sortOrder: input.sortOrder }).where(eq(productStates.id, input.id));
      } else {
        const [dupe] = await db
          .select()
          .from(productStates)
          .where(and(eq(productStates.countryId, input.countryId), eq(productStates.name, name)));
        if (dupe) throw new TRPCError({ code: "BAD_REQUEST", message: "That state already exists under this country." });
        await db.insert(productStates).values({ countryId: input.countryId, name, sortOrder: input.sortOrder });
      }
      await log(ctx.user.id, "save_state", "properties", name);
      return { ok: true };
    }),

  deleteState: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(productStates).where(eq(productStates.id, input.id));
      await log(ctx.user.id, "delete_state", "properties", `#${input.id}`);
      return { ok: true };
    }),

  /* ------------------------------ commissions ------------------------------ */
  salesQueue: adminQuery
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({ sale: sales, product: products, seller: members })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .leftJoin(members, eq(sales.sellerId, members.id))
        .where(input.status ? eq(sales.status, input.status as any) : undefined)
        .orderBy(desc(sales.createdAt))
        .limit(100);
      // Resolve reviewers and apply approval-attribution privacy:
      // Charity's reviews show as "Admin office" to everyone but herself.
      const reviewerIds = [...new Set(rows.map((r) => r.sale.reviewedBy).filter((x): x is number => x != null))];
      const reviewerRows = reviewerIds.length
        ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, reviewerIds))
        : [];
      const reviewerMap = new Map(reviewerRows.map((u) => [u.id, u]));
      return rows.map((r) => ({
        ...r,
        reviewer: r.sale.reviewedBy ? reviewerDisplay(ctx.user.email, reviewerMap.get(r.sale.reviewedBy) ?? null) : null,
      }));
    }),

  approveSale: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const [s] = await db.select().from(sales).where(eq(sales.id, input.id));
    if (!s) throw new TRPCError({ code: "NOT_FOUND" });
    if (s.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Already reviewed" });
    await db.update(sales).set({ status: "approved", reviewedBy: ctx.user.id, reviewedAt: new Date() }).where(eq(sales.id, s.id));
    await distributeCommissions(s.id);
    await log(ctx.user.id, "approve_sale", "commissions", `sale #${s.id} ₦${s.salePrice}`);
    return { ok: true };
  }),

  rejectSale: adminQuery
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [s] = await db.select().from(sales).where(eq(sales.id, input.id));
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(sales).set({ status: "rejected", reviewedBy: ctx.user.id, reviewedAt: new Date() }).where(eq(sales.id, s.id));
      const [m] = await db.select().from(members).where(eq(members.id, s.sellerId));
      if (m)
        await notify(m.userId, "commission", "Commission request declined", input.reason ?? "Your sale submission was declined. Contact support.", "/app/earnings");
      await log(ctx.user.id, "reject_sale", "commissions", `sale #${s.id}`);
      return { ok: true };
    }),

  /** Revoke an ALREADY-APPROVED sale (human-error reversal). The sale flips to
   *  "revoked", its unpaid commissions are rejected, points credited for it are
   *  reversed with a negative ledger entry, and the seller is notified. If part
   *  of the chain was already withdrawn, those rows stay paid and the count is
   *  returned so the finance office can recover them manually. */
  revokeSale: adminQuery
    .input(z.object({ id: z.number(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [s] = await db.select().from(sales).where(eq(sales.id, input.id));
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      if (s.status !== "approved")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only an approved sale can be revoked." });
      await db
        .update(sales)
        .set({ status: "revoked", reviewedBy: ctx.user.id, reviewedAt: new Date() })
        .where(eq(sales.id, s.id));
      const crows = await db.select().from(commissions).where(eq(commissions.saleId, s.id));
      let paidOut = 0;
      for (const c of crows) {
        if (c.status === "paid") { paidOut++; continue; }
        await db.update(commissions).set({ status: "rejected" }).where(eq(commissions.id, c.id));
      }
      // reverse points credited for this sale (meta is "Sale #<id>")
      const pl = await db
        .select()
        .from(pointsLedger)
        .where(and(eq(pointsLedger.action, "commission"), eq(pointsLedger.meta, `Sale #${s.id}`)));
      for (const l of pl) {
        if (l.points <= 0) continue;
        await db.insert(pointsLedger).values({
          memberId: l.memberId,
          action: "reversal",
          points: -l.points,
          meta: `Revoked sale #${s.id}`,
        });
        await db
          .update(members)
          .set({ pointsBalance: sql`GREATEST(points_balance - ${l.points}, 0)` })
          .where(eq(members.id, l.memberId));
      }
      const [m] = await db.select().from(members).where(eq(members.id, s.sellerId));
      if (m)
        await notify(
          m.userId,
          "commission",
          "A sale approval was revoked",
          input.reason ??
            `Sale #${s.id} was revoked by the admin office${input.reason ? "" : " (error correction)"}. The commissions from it were reversed — contact support if this looks wrong.`,
          "/app/earnings"
        );
      await log(
        ctx.user.id,
        "revoke_sale",
        "commissions",
        `sale #${s.id} ₦${s.salePrice.toLocaleString()} revoked${paidOut ? ` — ${paidOut} commission(s) already paid out` : ""}`
      );
      return { ok: true, paidOut };
    }),

  /** Full commission ledger (newest first) for the admin console — the rows the
   *  deleteCommission control acts on. */
  commissionLedger: adminQuery
    .input(z.object({ memberId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          c: commissions,
          memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
          memberCode: members.membershipCode,
        })
        .from(commissions)
        .leftJoin(members, eq(commissions.memberId, members.id))
        .where(input?.memberId ? eq(commissions.memberId, input.memberId) : undefined)
        .orderBy(desc(commissions.id))
        .limit(300);
      return rows.map((r) => ({ ...r.c, memberName: r.memberName, memberCode: r.memberCode }));
    }),

  /** Delete a commission row (error correction). Paid rows are protected — they
   *  are already attached to a withdrawal request, so revoke the sale instead. */
  deleteCommission: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [c] = await db.select().from(commissions).where(eq(commissions.id, input.id));
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.status === "paid")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This commission is already paid out via a withdrawal — revoke the parent sale instead.",
        });
      await db.delete(commissions).where(eq(commissions.id, c.id));
      await log(ctx.user.id, "delete_commission", "commissions", `commission #${c.id} member #${c.memberId} ₦${c.amount.toLocaleString()} (${c.status}) deleted`);
      return { ok: true };
    }),

  /** Points ledger for the admin console (newest first). */
  pointsLedgerList: adminQuery
    .input(z.object({ memberId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          p: pointsLedger,
          memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
          memberCode: members.membershipCode,
        })
        .from(pointsLedger)
        .leftJoin(members, eq(pointsLedger.memberId, members.id))
        .where(input?.memberId ? eq(pointsLedger.memberId, input.memberId) : undefined)
        .orderBy(desc(pointsLedger.id))
        .limit(300);
      return rows.map((r) => ({ ...r.p, memberName: r.memberName, memberCode: r.memberCode }));
    }),

  /** Delete a points ledger entry (error correction) — the member's balance is
   *  adjusted by the entry's value (credits subtract, debits refund). */
  deletePointsEntry: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(pointsLedger).where(eq(pointsLedger.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(pointsLedger).where(eq(pointsLedger.id, row.id));
      await db
        .update(members)
        .set({ pointsBalance: sql`GREATEST(points_balance - ${row.points}, 0)` })
        .where(eq(members.id, row.memberId));
      await log(ctx.user.id, "delete_points_entry", "points", `points entry #${row.id} member #${row.memberId} ${row.points} pts (${row.action}) deleted`);
      return { ok: true };
    }),

  /**
   * Export sale requests for the finance office — every compulsory evidence
   * field (amount paid, payment date, sender name, description, receipt image)
   * so finance can confirm each payment against bank records.
   */
  financeExport: adminQuery
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const status = input?.status ?? "pending";
      const rows = await db
        .select({ sale: sales, product: products, seller: members })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .leftJoin(members, eq(sales.sellerId, members.id))
        .where(status === "all" ? undefined : eq(sales.status, status))
        .orderBy(desc(sales.createdAt))
        .limit(500);
      await log(ctx.user.id, "finance_export", "commissions", `${rows.length} ${status} sale request(s) exported for finance`);
      return rows.map((r) => ({
        id: r.sale.id,
        product: r.product?.name ?? "",
        seller: r.seller ? `${r.seller.firstName} ${r.seller.lastName}` : "",
        sellerCode: r.seller?.membershipCode ?? "",
        sellerPhone: r.seller?.phone ?? "",
        amountPaid: r.sale.salePrice,
        paymentDate: r.sale.paymentDate ?? "",
        senderName: r.sale.senderName ?? "",
        buyerName: r.sale.buyerName ?? "",
        description: r.sale.description ?? "",
        receiptUrl: r.sale.receiptUrl ?? "",
        status: r.sale.status,
        submitted: r.sale.createdAt,
      }));
    }),

  /* ------------------------------ withdrawals ------------------------------ */
  withdrawalsList: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({ withdrawal: withdrawals, member: members, commission: commissions, product: products })
      .from(withdrawals)
      .leftJoin(members, eq(withdrawals.memberId, members.id))
      .leftJoin(commissions, eq(withdrawals.commissionId, commissions.id))
      .leftJoin(sales, eq(commissions.saleId, sales.id))
      .leftJoin(products, eq(sales.productId, products.id))
      .orderBy(desc(withdrawals.createdAt))
      .limit(100);
  }),

  setWithdrawalStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["pending", "processing", "paid", "rejected"]), reference: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [w] = await db.select().from(withdrawals).where(eq(withdrawals.id, input.id));
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(withdrawals).set({ status: input.status, reference: input.reference }).where(eq(withdrawals.id, w.id));
      const [m] = await db.select().from(members).where(eq(members.id, w.memberId));
      if (m)
        await notify(m.userId, "withdrawal", `Withdrawal ${input.status}`, `Your payout of ₦${w.amount.toLocaleString()} is now ${input.status}${input.reference ? ` — ref ${input.reference}` : ""}.`, "/app/earnings");
      await log(ctx.user.id, "withdrawal_status", "withdrawals", `#${w.id} → ${input.status}`);
      return { ok: true };
    }),

  /* --------------------------------- points -------------------------------- */
  getPointRules: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(pointRules);
  }),

  savePointRule: adminQuery
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(pointRules).set({ value: input.value }).where(eq(pointRules.key, input.key));
      await log(ctx.user.id, "edit_point_rule", "points", `${input.key} = ${input.value}`);
      return { ok: true };
    }),

  addPointRule: adminQuery
    .input(
      z.object({
        key: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscore only"),
        label: z.string().min(1).max(120),
        value: z.string().min(1).max(40),
        note: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [dupe] = await db.select().from(pointRules).where(eq(pointRules.key, input.key));
      if (dupe) throw new TRPCError({ code: "CONFLICT", message: "A rule with this key already exists" });
      await db.insert(pointRules).values(input);
      await log(ctx.user.id, "add_point_rule", "points", `${input.key} = ${input.value}`);
      return { ok: true };
    }),

  deletePointRule: adminQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(pointRules).where(eq(pointRules.key, input.key));
      await log(ctx.user.id, "delete_point_rule", "points", input.key);
      return { ok: true };
    }),

  rewardsList: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(rewards).orderBy(asc(rewards.pointCost));
  }),

  saveReward: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(120),
        description: z.string().optional(),
        imageUrl: z.string().max(2000).nullish(),
        pointCost: z.number().positive(),
        // optional naira price — lets members pay for this gift with their
        // property voucher (unlocked for them after their first own/team sale)
        voucherCost: z.number().positive().nullish(),
        stock: z.number(),
        status: z.enum(["live", "paused"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...raw } = input;
      const data = { ...raw, imageUrl: raw.imageUrl ?? null };
      if (id) await db.update(rewards).set(data).where(eq(rewards.id, id));
      else await db.insert(rewards).values(data);
      await log(ctx.user.id, "save_reward", "points", data.name);
      return { ok: true };
    }),

  redemptionsQueue: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({ redemption: redemptions, member: members, reward: rewards })
      .from(redemptions)
      .leftJoin(members, eq(redemptions.memberId, members.id))
      .leftJoin(rewards, eq(redemptions.rewardId, rewards.id))
      .orderBy(desc(redemptions.createdAt))
      .limit(100);
  }),

  setRedemptionStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["pending", "processing", "fulfilled", "declined"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [r] = await db.select().from(redemptions).where(eq(redemptions.id, input.id));
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(redemptions).set({ status: input.status }).where(eq(redemptions.id, r.id));
      const [m] = await db.select().from(members).where(eq(members.id, r.memberId));
      if (m) await notify(m.userId, "points", `Reward ${input.status}`, `Your redemption is now ${input.status}.`, "/app/rewards");
      await log(ctx.user.id, "redemption_status", "points", `#${r.id} → ${input.status}`);
      return { ok: true };
    }),

  /* ------------------------------ membership ------------------------------- */
  plansList: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(membershipPlans).orderBy(asc(membershipPlans.sortOrder));
  }),

  /** Create or update a membership plan — plans are FULLY dynamic.
   *  sortOrder doubles as the plan rank (higher = more senior). */
  savePlan: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        code: z.string().min(2).max(20).regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscore only"),
        name: z.string().min(1).max(60),
        fee: z.number().min(0),
        renewalDiscountPct: z.number().min(0).max(100),
        voucherAmount: z.number().min(0),
        chainDepth: z.number().min(0).max(10),
        pointsEligible: z.boolean(),
        pointsMultiplier: z.string().max(10).default("1"),
        features: z.array(z.string()),
        sortOrder: z.number().min(0).max(100),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const mult = parseFloat(data.pointsMultiplier);
      if (Number.isNaN(mult) || mult <= 0 || mult > 10)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Points multiplier must be a number between 0 and 10" });
      if (id) {
        const [existing] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, id));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        // code is immutable once members hold it — changing it would orphan them
        await db
          .update(membershipPlans)
          .set({ ...data, code: existing.code })
          .where(eq(membershipPlans.id, id));
        await log(ctx.user.id, "edit_plan", "settings", `${existing.code} (${data.name})`);
      } else {
        const [dupe] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, data.code));
        if (dupe) throw new TRPCError({ code: "CONFLICT", message: "A plan with this code already exists" });
        await db.insert(membershipPlans).values(data);
        await log(ctx.user.id, "create_plan", "settings", `${data.code} (${data.name})`);
      }
      return { ok: true };
    }),

  /** Delete a plan — only while no member is on it. */
  deletePlan: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, input.id));
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      const [{ n }] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(members)
        .where(eq(members.category, plan.code));
      if (Number(n) > 0)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${n} member(s) are on this plan — move them to another plan first (or set the plan inactive).`,
        });
      await db.delete(membershipPlans).where(eq(membershipPlans.id, plan.id));
      await log(ctx.user.id, "delete_plan", "settings", plan.code);
      return { ok: true };
    }),

  /* ---------------------------------- CMS ---------------------------------- */
  getContent: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(siteContent);
  }),

  setContent: adminQuery
    .input(z.object({ key: z.string().max(120), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(siteContent).where(eq(siteContent.key, input.key));
      if (row) await db.update(siteContent).set({ value: input.value }).where(eq(siteContent.id, row.id));
      else await db.insert(siteContent).values({ key: input.key, value: input.value });
      await log(ctx.user.id, "edit_content", "cms", input.key);
      return { ok: true };
    }),

  /* --------------------------------- academy ------------------------------- */
  /** Batched: 5 queries total (was 2 + 3×courses) — the admin academy
   *  dashboard must open fast even with many courses. */
  academyTree: adminQuery.query(async () => {
    const db = getDb();
    const [cs, allMods, allLessons, allExams, qCounts] = await Promise.all([
      db.select().from(courses).orderBy(asc(courses.sortOrder)),
      db.select().from(modules).orderBy(asc(modules.sortOrder)),
      db.select().from(lessons).orderBy(asc(lessons.sortOrder)),
      db.select().from(exams),
      db.select({ examId: examQuestions.examId, n: sql<number>`COUNT(*)` }).from(examQuestions).groupBy(examQuestions.examId),
    ]);
    const qByExam = new Map(qCounts.map((q) => [q.examId, Number(q.n)]));
    const examByCourse = new Map(allExams.map((e) => [e.courseId, e]));
    const lessonsByModule = new Map<number, typeof allLessons>();
    for (const l of allLessons) {
      const arr = lessonsByModule.get(l.moduleId) ?? [];
      arr.push(l);
      lessonsByModule.set(l.moduleId, arr);
    }
    const modsByCourse = new Map<number, typeof allMods>();
    for (const mod of allMods) {
      const arr = modsByCourse.get(mod.courseId) ?? [];
      arr.push(mod);
      modsByCourse.set(mod.courseId, arr);
    }
    return cs.map((c) => ({
      ...c,
      modules: (modsByCourse.get(c.id) ?? []).map((mod) => ({
        ...mod,
        lessons: lessonsByModule.get(mod.id) ?? [],
      })),
      questionCount: qByExam.get(examByCourse.get(c.id)?.id ?? -1) ?? 0,
    }));
  }),

  /** Create or update a course. New courses automatically get an empty exam. */
  saveCourse: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        code: z.string().min(1).max(10),
        title: z.string().min(1),
        category: z.string().min(1).max(20),
        tagline: z.string().optional(),
        description: z.string().optional(),
        promise: z.string().optional(),
        audience: z.string().optional(),
        prerequisites: z.string().optional(),
        outcomes: z.array(z.string()).optional(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        const [existing] = await db.select().from(courses).where(eq(courses.id, id));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await db.update(courses).set({ ...data, code: existing.code }).where(eq(courses.id, id));
        await log(ctx.user.id, "edit_course", "academy", `${existing.code} — ${data.title}`);
      } else {
        const [dupe] = await db.select().from(courses).where(eq(courses.code, data.code));
        if (dupe) throw new TRPCError({ code: "CONFLICT", message: "A course with this code already exists" });
        const [row] = await db.insert(courses).values(data).$returningId();
        await db.insert(exams).values({ courseId: row.id, passMark: 60 });
        await log(ctx.user.id, "create_course", "academy", `${data.code} — ${data.title}`);
      }
      return { ok: true };
    }),

  /** Delete a course and everything under it (modules, lessons, exam, questions). */
  deleteCourse: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [c] = await db.select().from(courses).where(eq(courses.id, input.id));
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      const mods = await db.select().from(modules).where(eq(modules.courseId, c.id));
      for (const mod of mods) {
        const ls = await db.select().from(lessons).where(eq(lessons.moduleId, mod.id));
        for (const l of ls) {
          const { lessonProgress } = await import("../../db/schema");
          await db.delete(lessonProgress).where(eq(lessonProgress.lessonId, l.id));
        }
        await db.delete(lessons).where(eq(lessons.moduleId, mod.id));
      }
      await db.delete(modules).where(eq(modules.courseId, c.id));
      const [exam] = await db.select().from(exams).where(eq(exams.courseId, c.id));
      if (exam) {
        await db.delete(examQuestions).where(eq(examQuestions.examId, exam.id));
        const { examAttempts } = await import("../../db/schema");
        await db.delete(examAttempts).where(eq(examAttempts.examId, exam.id));
        await db.delete(exams).where(eq(exams.id, exam.id));
      }
      await db.delete(courses).where(eq(courses.id, c.id));
      await log(ctx.user.id, "delete_course", "academy", `${c.code} — ${c.title}`);
      return { ok: true };
    }),

  saveModule: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        courseId: z.number(),
        title: z.string().min(1).max(200),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) await db.update(modules).set(data).where(eq(modules.id, id));
      else await db.insert(modules).values(data);
      await log(ctx.user.id, "save_module", "academy", data.title);
      return { ok: true };
    }),

  deleteModule: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ls = await db.select().from(lessons).where(eq(lessons.moduleId, input.id));
      for (const l of ls) {
        const { lessonProgress } = await import("../../db/schema");
        await db.delete(lessonProgress).where(eq(lessonProgress.lessonId, l.id));
      }
      await db.delete(lessons).where(eq(lessons.moduleId, input.id));
      await db.delete(modules).where(eq(modules.id, input.id));
      await log(ctx.user.id, "delete_module", "academy", `#${input.id}`);
      return { ok: true };
    }),

  saveLesson: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        moduleId: z.number(),
        code: z.string().min(1).max(20),
        title: z.string().min(1),
        minutes: z.number().min(1),
        outcome: z.string().optional(),
        body: z.string(),
        videoUrl: z.string().max(500).optional().nullable(),
        fieldTool: z.string().optional(),
        deepPoint: z.string().optional(),
        selfCheck: z.string().optional(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(lessons).set(data).where(eq(lessons.id, id));
        await log(ctx.user.id, "edit_lesson", "academy", `#${id}`);
      } else {
        await db.insert(lessons).values(data);
        await log(ctx.user.id, "create_lesson", "academy", data.code);
      }
      return { ok: true };
    }),

  deleteLesson: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { lessonProgress } = await import("../../db/schema");
      await db.delete(lessonProgress).where(eq(lessonProgress.lessonId, input.id));
      await db.delete(lessons).where(eq(lessons.id, input.id));
      await log(ctx.user.id, "delete_lesson", "academy", `#${input.id}`);
      return { ok: true };
    }),

  /* ------------------------------ exam questions --------------------------- */
  /* ------------------------- training compliance tracker --------------------- */
  trainingCompliance: adminQuery
    .input(
      z.object({
        courseId: z.number().optional(), // omit = all courses aggregated
        planCode: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const { lessonProgress, examAttempts, certificates } = await import("../../db/schema");

      const allCourses = await db.select().from(courses).orderBy(asc(courses.sortOrder));
      const allModules = await db.select().from(modules);
      const allLessons = await db.select().from(lessons);
      const allExams = await db.select().from(exams);
      const allProgress = await db.select().from(lessonProgress);
      const allAttempts = await db.select().from(examAttempts);
      const allCerts = await db.select().from(certificates).where(eq(certificates.revoked, false));

      // course metadata with lesson counts + exam pass mark
      const courseMeta = allCourses.map((c) => {
        const modIds = allModules.filter((mo) => mo.courseId === c.id).map((mo) => mo.id);
        const lessonIds = allLessons.filter((l) => modIds.includes(l.moduleId)).map((l) => l.id);
        const exam = allExams.find((e) => e.courseId === c.id);
        return { id: c.id, code: c.code, title: c.title, category: c.category, lessonIds, lessonCount: lessonIds.length, passMark: exam?.passMark ?? null, examId: exam?.id ?? null };
      });

      // scope: one course or everything
      const scope = input.courseId ? courseMeta.filter((c) => c.id === input.courseId) : courseMeta;
      const scopeLessonIds = new Set(scope.flatMap((c) => c.lessonIds));
      const scopeExamIds = new Set(scope.map((c) => c.examId).filter((x): x is number => x != null));
      const lessonsTotal = scopeLessonIds.size;

      // members (realtors), optional plan/search filter
      const conds = [];
      if (input.planCode) conds.push(eq(members.category, input.planCode));
      if (input.search)
        conds.push(
          sql`(CONCAT(first_name, ' ', last_name) LIKE ${"%" + input.search + "%"} OR membership_code LIKE ${"%" + input.search + "%"})`
        );
      const memRows = await db
        .select()
        .from(members)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(asc(members.firstName));

      const rows = memRows.map((m) => {
        const prog = allProgress.filter((p) => p.memberId === m.id && scopeLessonIds.has(p.lessonId));
        const attempts = allAttempts.filter((a) => a.memberId === m.id && scopeExamIds.has(a.examId));
        const best = attempts.reduce((mx, a) => Math.max(mx, a.score), -1);
        const passed = attempts.some((a) => a.passed);
        const scopeCodes = new Set(scope.map((c) => c.code));
        const aggregated = !input.courseId;
        const certs = allCerts.filter((ct) => ct.memberId === m.id && (aggregated || scopeCodes.has(ct.scope)));
        const activityTimes = [
          ...prog.map((p) => p.completedAt?.getTime() ?? 0),
          ...attempts.map((a) => a.createdAt?.getTime?.() ?? 0),
        ];
        const lastActivity = activityTimes.length ? new Date(Math.max(...activityTimes)).toISOString() : null;
        const lessonsDone = prog.length;
        const pct = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
        return {
          member: {
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            category: m.category,
            status: m.status,
            membershipCode: m.membershipCode,
          },
          lessonsDone,
          lessonsTotal,
          pct,
          attempts: attempts.length,
          bestScore: best >= 0 ? best : null,
          passed,
          certificates: certs.map((ct) => ({ scope: ct.scope, title: ct.title, verificationCode: ct.verificationCode })),
          lastActivity,
        };
      });

      const summary = {
        realtors: rows.length,
        notStarted: rows.filter((r) => r.lessonsDone === 0 && r.attempts === 0).length,
        inProgress: rows.filter((r) => (r.lessonsDone > 0 || r.attempts > 0) && !r.passed).length,
        examPassed: rows.filter((r) => r.passed).length,
        certified: rows.filter((r) => r.certificates.length > 0).length,
      };

      return {
        courses: courseMeta.map((c) => ({ id: c.id, code: c.code, title: c.title, category: c.category, lessonCount: c.lessonCount, passMark: c.passMark })),
        selectedCourseId: input.courseId ?? null,
        lessonsTotal,
        summary,
        rows,
      };
    }),

  /** Send an in-app training reminder to a realtor */
  remindTraining: adminQuery
    .input(z.object({ memberId: z.number(), courseId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [m] = await db.select().from(members).where(eq(members.id, input.memberId));
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      let courseTitle = "your training";
      if (input.courseId) {
        const [c] = await db.select().from(courses).where(eq(courses.id, input.courseId));
        if (c) courseTitle = `“${c.title}”`;
      }
      await notify(
        m.userId,
        "course",
        "Training reminder from the club",
        `Hi ${m.firstName} — the club is tracking training compliance and your progress in ${courseTitle} is still open. Please continue your lessons and sit the exam.`,
        "/app/training"
      );
      await log(ctx.user.id, "training_reminder", "academy", `${m.firstName} ${m.lastName}${input.courseId ? ` (course #${input.courseId})` : ""}`);
      return { ok: true };
    }),

  examDetail: adminQuery
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      let [exam] = await db.select().from(exams).where(eq(exams.courseId, input.courseId));
      if (!exam) {
        await db.insert(exams).values({ courseId: input.courseId, passMark: 60 });
        [exam] = await db.select().from(exams).where(eq(exams.courseId, input.courseId));
      }
      const questions = await db
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.examId, exam.id))
        .orderBy(asc(examQuestions.sortOrder));
      return { exam, questions };
    }),

  setExamPassMark: adminQuery
    .input(z.object({ courseId: z.number(), passMark: z.number().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [exam] = await db.select().from(exams).where(eq(exams.courseId, input.courseId));
      if (!exam) await db.insert(exams).values({ courseId: input.courseId, passMark: input.passMark });
      else await db.update(exams).set({ passMark: input.passMark }).where(eq(exams.id, exam.id));
      await log(ctx.user.id, "exam_pass_mark", "academy", `course #${input.courseId} → ${input.passMark}%`);
      return { ok: true };
    }),

  saveExamQuestion: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        courseId: z.number(),
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2).max(6),
        correctIndex: z.number().min(0),
        explanation: z.string().optional(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, courseId, ...data } = input;
      if (data.correctIndex >= data.options.length)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Correct answer index is out of range" });
      let [exam] = await db.select().from(exams).where(eq(exams.courseId, courseId));
      if (!exam) {
        await db.insert(exams).values({ courseId, passMark: 60 });
        [exam] = await db.select().from(exams).where(eq(exams.courseId, courseId));
      }
      if (id) await db.update(examQuestions).set(data).where(eq(examQuestions.id, id));
      else await db.insert(examQuestions).values({ ...data, examId: exam.id });
      await log(ctx.user.id, "save_exam_question", "academy", `course #${courseId}`);
      return { ok: true };
    }),

  deleteExamQuestion: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(examQuestions).where(eq(examQuestions.id, input.id));
      await log(ctx.user.id, "delete_exam_question", "academy", `#${input.id}`);
      return { ok: true };
    }),

  /* --------------------------------- exports ------------------------------- */
  exportData: adminQuery
    .input(z.object({ type: z.enum(["members", "sales", "commissions", "withdrawals", "points"]) }))
    .query(async ({ input }) => {
      const db = getDb();
      if (input.type === "members") {
        const rows = await db.select().from(members).orderBy(desc(members.createdAt));
        return rows.map((r) => ({
          code: r.membershipCode, name: `${r.firstName} ${r.lastName}`, category: r.category,
          status: r.status, phone: r.phone, points: r.pointsBalance, joined: r.createdAt,
        }));
      }
      if (input.type === "sales") {
        const rows = await db.select({ sale: sales, product: products, seller: members }).from(sales)
          .leftJoin(products, eq(sales.productId, products.id)).leftJoin(members, eq(sales.sellerId, members.id));
        return rows.map((r) => ({
          id: r.sale.id, product: r.product?.name, seller: r.seller ? `${r.seller.firstName} ${r.seller.lastName}` : "",
          price: r.sale.salePrice, paymentDate: r.sale.paymentDate ?? "", senderName: r.sale.senderName ?? "",
          description: r.sale.description ?? "", receiptUrl: r.sale.receiptUrl ?? "",
          status: r.sale.status, date: r.sale.createdAt,
        }));
      }
      if (input.type === "commissions") {
        const rows = await db
          .select({ c: commissions, m: members, sale: sales, product: products })
          .from(commissions)
          .leftJoin(members, eq(commissions.memberId, members.id))
          .leftJoin(sales, eq(commissions.saleId, sales.id))
          .leftJoin(products, eq(sales.productId, products.id));
        return rows.map((r) => ({
          id: r.c.id, member: r.m ? `${r.m.firstName} ${r.m.lastName}` : "",
          type: r.c.level === -1
            ? r.c.note?.startsWith("Renewal") ? "renewal"
            : r.c.note?.startsWith("Upgrade") ? "upgrade"
            : "registration"
            : r.c.level === 0 ? "direct sale" : `chain L${r.c.level}`,
          product: r.product?.name ?? (r.c.level === -1 ? "(membership payment)" : "—"),
          amount: r.c.amount, status: r.c.status, date: r.c.createdAt,
        }));
      }
      if (input.type === "withdrawals") {
        const rows = await db
          .select({ w: withdrawals, m: members, c: commissions, sale: sales, product: products })
          .from(withdrawals)
          .leftJoin(members, eq(withdrawals.memberId, members.id))
          .leftJoin(commissions, eq(withdrawals.commissionId, commissions.id))
          .leftJoin(sales, eq(commissions.saleId, sales.id))
          .leftJoin(products, eq(sales.productId, products.id))
          .orderBy(desc(withdrawals.createdAt));
        return rows.map((r) => ({
          id: r.w.id, member: r.m ? `${r.m.firstName} ${r.m.lastName}` : "",
          product: r.product?.name ?? (r.c?.level === -1 ? "(membership referral)" : "—"),
          amount: r.w.amount, status: r.w.status, reference: r.w.reference ?? "",
          bank: r.w.bankDetails, requested: r.w.createdAt,
        }));
      }
      const rows = await db.select({ p: pointsLedger, m: members }).from(pointsLedger).leftJoin(members, eq(pointsLedger.memberId, members.id));
      return rows.map((r) => ({
        member: r.m ? `${r.m.firstName} ${r.m.lastName}` : "", action: r.p.action,
        points: r.p.points, meta: r.p.meta, date: r.p.createdAt,
      }));
    }),

  /* ------------------------------- link analytics --------------------------- */
  linkAnalytics: adminQuery.query(async () => {
    const db = getDb();
    const [memberRows, clickCounts, uniqueCounts, convCounts] = await Promise.all([
      db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          category: members.category,
          referralCode: members.referralCode,
        })
        .from(members)
        .limit(500),
      db
        .select({ memberId: linkVisits.memberId, n: sql<number>`COUNT(*)` })
        .from(linkVisits)
        .groupBy(linkVisits.memberId),
      db
        .select({ memberId: linkVisits.memberId, n: sql<number>`COUNT(*)` })
        .from(linkVisits)
        .where(eq(linkVisits.isUniqueToday, true))
        .groupBy(linkVisits.memberId),
      db
        .select({ referrerId: members.referrerId, n: sql<number>`COUNT(*)` })
        .from(members)
        .where(sql`${members.referrerId} IS NOT NULL`)
        .groupBy(members.referrerId),
    ]);
    const clicks = new Map(clickCounts.map((c) => [c.memberId, Number(c.n)]));
    const uniq = new Map(uniqueCounts.map((c) => [c.memberId, Number(c.n)]));
    const conv = new Map(convCounts.map((c) => [c.referrerId, Number(c.n)]));
    return memberRows
      .map((m) => ({
        ...m,
        clicks: clicks.get(m.id) ?? 0,
        uniqueClicks: uniq.get(m.id) ?? 0,
        conversions: conv.get(m.id) ?? 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);
  }),

  /* --------------------------------- payments ------------------------------ */
  paymentsList: adminQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({ payment: payments, member: members })
        .from(payments)
        .leftJoin(members, eq(payments.memberId, members.id))
        .where(input?.status ? eq(payments.status, input.status as "pending" | "approved" | "rejected") : undefined)
        .orderBy(desc(payments.createdAt))
        .limit(200);
      // Approval-attribution privacy: Charity's reviews show as "Admin office"
      // to everyone but herself; other admins are tracked by name.
      const reviewerIds = [...new Set(rows.map((r) => r.payment.reviewedBy).filter((x): x is number => x != null))];
      const reviewerRows = reviewerIds.length
        ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, reviewerIds))
        : [];
      const reviewerMap = new Map(reviewerRows.map((u) => [u.id, u]));
      // expected amount for membership payments (50% renewal / upgrade balance / full fee)
      const plans = await db.select().from(membershipPlans);
      return rows.map((r) => {
        let expected: { amount: number; label: string } | null = null;
        if (r.payment.type === "membership" && r.member) {
          const target = plans.find((pl) => pl.code === (r.payment.planCode ?? r.member!.category));
          const cur = plans.find((pl) => pl.code === r.member!.category);
          if (target) {
            const q = membershipQuote(r.member, cur ?? null, target);
            if (q) expected = { amount: q.amount, label: q.label };
          }
        }
        return {
          ...r,
          expected,
          reviewer: r.payment.reviewedBy ? reviewerDisplay(ctx.user.email, reviewerMap.get(r.payment.reviewedBy) ?? null) : null,
        };
      });
    }),

  /** Approve → activate the member's access (membership) and pay referral commission */
  reviewPayment: adminQuery
    .input(z.object({ id: z.number(), approve: z.boolean(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [p] = await db.select().from(payments).where(eq(payments.id, input.id));
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      if (p.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Already reviewed" });
      const [m] = await db.select().from(members).where(eq(members.id, p.memberId));

      // Side effects run BEFORE the status flip — if anything fails, the payment
      // stays "pending" and the admin can safely retry (no half-approved state).
      if (input.approve && p.type === "membership" && m) {
        const cat = p.planCode ?? m.category;
        const [plan] = await db
          .select()
          .from(membershipPlans)
          .where(eq(membershipPlans.code, cat));
        // Enforce the club's pricing: 50% same-plan renewal, 100% renewal into
        // another plan, balance-only upgrades while active, full fee for Basic.
        if (plan) {
          const [curPlan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, m.category));
          const q = membershipQuote(m, curPlan ?? null, plan);
          if (q && p.amount < q.amount)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `This payment is ₦${p.amount.toLocaleString()} but ${q.label} for ${plan.name} is ₦${q.amount.toLocaleString()}. Ask the member to complete the balance first.`,
            });
        }
        const firstActivation = m.status === "pending";
        const renewal = m.status === "expired";
        // Voucher rule: first activation credits the plan voucher; an UPGRADE
        // tops up to the new plan's amount; a RENEWAL starts a fresh membership
        // year, so the plan voucher is credited fresh (a new year, a new fee).
        const payBal = plan
          ? renewal
            ? plan.voucherAmount
            : Math.max(m.voucherBalance, plan.voucherAmount)
          : m.voucherBalance;
        await db
          .update(members)
          .set({
            status: "active",
            category: cat,
            voucherBalance: payBal,
            expiresAt: new Date(Date.now() + 365 * 86400000),
          })
          .where(eq(members.id, m.id));
        if (payBal !== m.voucherBalance) {
          await db.insert(voucherTransactions).values({
            memberId: m.id,
            amount: payBal - m.voucherBalance,
            balanceAfter: payBal,
            note: renewal
              ? `${plan?.name ?? cat} membership renewed — fresh property voucher credited for the new year`
              : `${plan?.name ?? cat} membership confirmed — property voucher credited`,
          });
        }
        // Plan-payment commissions to the direct referrer, at the live
        // registration rate: first activation pays on the full plan fee;
        // renewals and upgrades pay on the amount actually paid, ONCE per
        // approved payment (the payment row's status flip is the idempotency
        // guard — retrying a failed side-effect run is still safe because the
        // payment only flips to approved after everything above succeeds).
        if (firstActivation) await payReferralCommission(m.id);
        else await payReferralCommission(m.id, {
          amountOverride: p.amount,
          reason: renewal ? "renewal" : "upgrade",
        });
        await notify(
          m.userId,
          "system",
          renewal ? "Membership renewed — welcome back" : "Payment confirmed — membership active",
          renewal
            ? `Your ${plan?.name ?? cat} membership is active for another year.`
            : `Your ${plan?.name ?? cat} membership is now active. Welcome to Club 10.`,
          "/app"
        );
      } else if (m) {
        await notify(
          m.userId,
          "system",
          input.approve ? "Payment confirmed" : "Payment not confirmed",
          input.approve
            ? `Your ${p.type} payment of ₦${p.amount.toLocaleString()} has been confirmed.`
            : `Your ${p.type} payment of ₦${p.amount.toLocaleString()} could not be confirmed.${input.reason ? ` Reason: ${input.reason}` : ""} Please contact the club on WhatsApp.`,
          "/app"
        );
      }
      await db
        .update(payments)
        .set({
          status: input.approve ? "approved" : "rejected",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          note: input.reason ? `${p.note ?? ""}\n[Admin] ${input.reason}`.trim() : p.note,
        })
        .where(eq(payments.id, p.id));
      await log(ctx.user.id, input.approve ? "approve_payment" : "reject_payment", "payments", `#${p.id} ${p.type} ₦${p.amount}`);
      return { ok: true };
    }),

  /* ------------------------- commission settings -------------------------- */
  /** Registration commission % — admin-editable (default 30). */
  commissionSettings: adminQuery.query(async () => {
    return { registrationPct: await registrationCommissionPct() };
  }),

  saveCommissionSettings: adminQuery
    .input(z.object({ registrationPct: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .insert(settings)
        .values({ key: "registration_commission_pct", value: String(input.registrationPct) })
        .onDuplicateKeyUpdate({ set: { value: String(input.registrationPct) } });
      await log(ctx.user.id, "edit_commission_settings", "settings", `registration commission → ${input.registrationPct}%`);
      return { ok: true, registrationPct: input.registrationPct };
    }),

  /* ------------------------- admin alerts (push + email) ------------------------- */

  /** Current alert configuration — push readiness + SMTP fields (password never returned). */
  alertSettings: adminQuery.query(async () => {
    const { getVapidKeys, getSettingValue, emailConfigured } = await import("../lib/deliver");
    const vapid = await getVapidKeys();
    const [smtpHost, smtpPort, smtpUser, smtpFrom, smtpPass, alertEmail] = await Promise.all([
      getSettingValue("smtp.host"),
      getSettingValue("smtp.port"),
      getSettingValue("smtp.user"),
      getSettingValue("smtp.from"),
      getSettingValue("smtp.pass"),
      getSettingValue("admin.alert_email"),
    ]);
    return {
      pushConfigured: vapid != null,
      vapidPublic: vapid?.pub ?? null,
      emailConfigured: await emailConfigured(),
      smtpHost: smtpHost ?? "",
      smtpPort: smtpPort ?? "587",
      smtpUser: smtpUser ?? "",
      smtpFrom: smtpFrom ?? "",
      smtpHasPass: !!smtpPass,
      alertEmail: alertEmail ?? "",
    };
  }),

  /** One-time device-push setup — generates the VAPID keypair. */
  setupPush: adminQuery.mutation(async ({ ctx }) => {
    const { ensureVapidKeys } = await import("../lib/deliver");
    const keys = await ensureVapidKeys();
    await log(ctx.user.id, "setup_push", "settings", "device push keys generated");
    return { ok: true, publicKey: keys.pub };
  }),

  /** Save SMTP + admin alert inbox. Empty password keeps the stored one. */
  saveAlertSettings: adminQuery
    .input(
      z.object({
        smtpHost: z.string().max(200),
        smtpPort: z.string().max(10),
        smtpUser: z.string().max(200),
        smtpPass: z.string().max(200).optional(),
        smtpFrom: z.string().max(200),
        alertEmail: z.string().max(320),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const pairs: Array<[string, string]> = [
        ["smtp.host", input.smtpHost.trim()],
        ["smtp.port", input.smtpPort.trim() || "587"],
        ["smtp.user", input.smtpUser.trim()],
        ["smtp.from", input.smtpFrom.trim()],
        ["admin.alert_email", input.alertEmail.trim()],
      ];
      if (input.smtpPass?.trim()) pairs.push(["smtp.pass", input.smtpPass.trim()]);
      for (const [key, value] of pairs) {
        await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
      }
      await log(ctx.user.id, "edit_alert_settings", "settings", `alert email → ${input.alertEmail}`);
      const { emailConfigured } = await import("../lib/deliver");
      return { ok: true, emailConfigured: await emailConfigured() };
    }),

  /** Test the email pipeline — sends a real message to the alert inbox. */
  testAdminEmail: adminQuery.mutation(async () => {
    const { sendAdminEmail } = await import("../lib/deliver");
    const ok = await sendAdminEmail(
      "Test alert — email pipeline works",
      "This is a test alert from the Club 10 back office. Payment reports, new registrations and sale submissions will land here."
    );
    if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Email not sent — check the SMTP settings and alert inbox above." });
    return { ok: true };
  }),

  /* ----------------------------------- blog -------------------------------- */
  blogList: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt)).limit(200);
  }),

  savePost: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        title: z.string().min(1).max(220),
        slug: z.string().min(1).max(160),
        excerpt: z.string().optional(),
        body: z.string().optional(),
        coverTheme: z.string().max(30).optional(),
        coverImage: z.string().max(2000).optional().nullable(),
        videoUrl: z.string().max(500).optional().nullable(),
        status: z.enum(["draft", "published"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
      if (id) {
        const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
        await db
          .update(blogPosts)
          .set({
            ...data,
            slug,
            publishedAt:
              data.status === "published" && existing?.status !== "published"
                ? new Date()
                : existing?.publishedAt,
          })
          .where(eq(blogPosts.id, id));
        await log(ctx.user.id, "edit_post", "blog", data.title);
      } else {
        await db.insert(blogPosts).values({
          ...data,
          slug,
          publishedAt: data.status === "published" ? new Date() : null,
        });
        await log(ctx.user.id, "create_post", "blog", data.title);
      }
      return { ok: true };
    }),

  deletePost: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    await db.delete(blogPosts).where(eq(blogPosts.id, input.id));
    await log(ctx.user.id, "delete_post", "blog", `#${input.id}`);
    return { ok: true };
  }),
});

export const cmsRouter = createRouter({
  /** Public: fetch a page's content as key→value map */
  page: publicQuery.input(z.object({ prefix: z.string() })).query(async ({ input }) => {
    const db = getDb();
    const rows = await db.select().from(siteContent).where(like(siteContent.key, `${input.prefix}.%`));
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value ?? "";
    return map;
  }),
});
