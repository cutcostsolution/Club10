import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { aiMarketingAssets, aiPlanDays, aiPlans, aiTaskReports, members, membershipPlans, products } from "../../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { aiConfigured, chatComplete } from "../lib/ai";
import { touchMembershipExpiry } from "../queries/engine";

const TOOLS = ["listing", "script", "followup", "guide"] as const;

/** Daily cap so a single member can't run the meter up. */
const DAILY_LIMIT = 30;

const BRAND_VOICE = `You are the built-in AI marketing assistant for Club 10 Realtors, a Nigerian real-estate network marketing company. You write marketing material for realtors (members) who sell land and property (plots, buy-to-own, buy-to-build) mainly across Nigeria.

Rules:
- Write in clear, persuasive, professional English with a warm Nigerian business tone. WhatsApp-friendly formatting (short paragraphs, line breaks, tasteful emoji) when the output is a message or script.
- Never invent specific facts that were not provided (plot sizes, exact title documents, payment plans). Use placeholders like [PLOT SIZE] when a detail is missing so the realtor can fill it in.
- Never promise guaranteed returns or use pressure/scam language. Keep claims honest and compliant.
- Keep it ready to copy-paste: no markdown headers with #, no meta commentary, no "Here is your script". Output ONLY the marketing text itself.`;

async function myActiveMember(userId: number) {
  const db = getDb();
  const [m0] = await db.select().from(members).where(eq(members.userId, userId));
  if (!m0) throw new TRPCError({ code: "NOT_FOUND", message: "Register as a member first" });
  // yearly renewal rule — lapsed memberships flip to "expired" on first touch
  const m = await touchMembershipExpiry(m0);
  if (m.status !== "active")
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        m.status === "expired"
          ? "Your membership year has ended — renew your plan from your dashboard to keep using the AI studio."
          : "The AI marketing studio unlocks once your membership is active.",
    });
  return m;
}

/**
 * The AI Marketing Studio is a Pro-and-above tool. Plans are ranked by
 * membership_plans.sort_order — the member's plan must rank at or above "pro".
 */
async function myStudioMember(userId: number) {
  const m = await myActiveMember(userId);
  const db = getDb();
  const [memberPlan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, m.category));
  const [proPlan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, "pro"));
  const memberRank = memberPlan?.sortOrder ?? 0;
  const proRank = proPlan?.sortOrder ?? 1;
  if (memberRank < proRank)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The AI Marketing Studio is available from the Pro membership and above. Upgrade your seat to unlock it.",
    });
  return m;
}

async function enforceDailyLimit(memberId: number) {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(aiMarketingAssets)
    .where(and(eq(aiMarketingAssets.memberId, memberId), sql`created_at >= CURDATE()`));
  if ((row?.n ?? 0) >= DAILY_LIMIT)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You've hit today's limit of ${DAILY_LIMIT} AI generations. Come back tomorrow — your saved assets stay available.`,
    });
}

function listingContext(p: typeof products.$inferSelect | null | undefined) {
  if (!p) return "";
  return [
    `Property name: ${p.name}`,
    p.tag ? `Tag: ${p.tag}` : null,
    p.location ? `Location: ${p.location}` : null,
    `State: ${p.state ?? ""}, Country: ${p.country}`,
    p.priceLabel ? `Price: ${p.priceLabel}` : `Price: ₦${p.price.toLocaleString()}`,
    p.titleStatus ? `Title status: ${p.titleStatus}` : null,
    p.description ? `Official description: ${p.description}` : null,
    p.highlights ? `Key highlights: ${p.highlights}` : null,
    p.features ? `Features & infrastructure: ${p.features}` : null,
    p.paymentPlan ? `Payment plan: ${p.paymentPlan}` : null,
    p.sellingNotes ? `Selling notes: ${p.sellingNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const toolInput = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("listing"),
    productId: z.number().int().positive().optional(),
    brief: z.string().max(2000).optional(),
    tone: z.enum(["professional", "friendly", "urgent", "luxury"]).default("professional"),
  }),
  z.object({
    tool: z.literal("script"),
    topic: z.string().min(3).max(500),
    productId: z.number().int().positive().optional(),
    audience: z.string().max(200).optional(),
    tone: z.enum(["professional", "friendly", "urgent", "luxury"]).default("friendly"),
  }),
  z.object({
    tool: z.literal("followup"),
    clientName: z.string().min(1).max(120),
    stage: z.enum(["new_lead", "inspected", "negotiating", "payment_pending", "after_sale"]),
    context: z.string().max(1500).optional(),
  }),
  z.object({
    tool: z.literal("guide"),
    focus: z.string().max(300).optional(),
    productId: z.number().int().positive().optional(),
  }),
]);

function buildPrompt(
  input: z.infer<typeof toolInput>,
  member: typeof members.$inferSelect,
  product: typeof products.$inferSelect | null
): { title: string; user: string } {
  const realtor = `${member.firstName} ${member.lastName}`;
  switch (input.tool) {
    case "listing": {
      const ctx = listingContext(product);
      return {
        title: product ? `Listing — ${product.name}` : "Listing description",
        user: `Write a compelling property listing description for a Club 10 realtor to post online (WhatsApp status, Instagram, Facebook).

${ctx ? `PROPERTY DETAILS (from the official catalog — treat as fact):\n${ctx}\n` : "No catalog product was selected. Base the listing ONLY on the realtor's brief below; use placeholders for any missing specifics.\n"}
Realtor's brief: ${input.brief?.trim() || "(none provided)"}
Tone: ${input.tone}

Structure: an attention-grabbing opening line, 3-6 short benefit-led paragraphs or bullet lines, a trust line about Club 10 Realtors, and a clear call to action telling readers to message ${realtor} directly. Under 250 words.`,
      };
    }
    case "script": {
      const ctx = listingContext(product);
      return {
        title: `Broadcast — ${input.topic.slice(0, 60)}`,
        user: `Write a WhatsApp broadcast message a Club 10 realtor can send to their contact list.

Topic / goal: ${input.topic}
Audience: ${input.audience?.trim() || "warm contacts and prospects"}
Tone: ${input.tone}
${ctx ? `\nRelated property (official details):\n${ctx}\n` : ""}
Keep it under 120 words, personal and conversational, first person from ${realtor}, with one clear call to action (reply to this message). Add an optional P.S. line if it strengthens the message.`,
      };
    }
    case "followup": {
      const stageText: Record<string, string> = {
        new_lead: "brand-new lead who just enquired and hasn't been engaged yet",
        inspected: "prospect who has already inspected the property",
        negotiating: "prospect actively negotiating price or terms",
        payment_pending: "client who agreed to buy but hasn't completed payment",
        after_sale: "past client after a completed purchase (check-in, referrals, upsell)",
      };
      return {
        title: `Follow-up — ${input.clientName}`,
        user: `Write a short, warm WhatsApp follow-up message from realtor ${realtor} (Club 10 Realtors) to a client.

Client name: ${input.clientName}
Situation: ${stageText[input.stage]}
Context from the realtor: ${input.context?.trim() || "(none)"}

Under 80 words. Sound human and personal, not automated. Address the client by name, reference the situation naturally, and end with a soft, specific next step (a question or a proposed time). No placeholders for the client name — use the name given.`,
      };
    }
    case "guide": {
      const day = new Date().toLocaleDateString("en-NG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const ctx = listingContext(product);
      return {
        title: product ? `Guide — ${product.name}` : `Daily guide — ${day}`,
        user: `Create today's AI marketing guide for ${realtor}, a Club 10 realtor in Nigeria. Date: ${day}.

${ctx ? `The realtor is currently pushing THIS property — build the whole guide around selling it (use only these official details as fact):\n${ctx}\n` : ""}${input.focus?.trim() ? `The realtor asked to focus on: ${input.focus.trim()}\n` : ""}
Give a practical, do-it-today plan with these sections (use the section names as plain lines, no # symbols):
1. TODAY'S FOCUS — one sentence on the single most important marketing move today.
2. MORNING ACTION — a concrete 15-minute task.
3. POST OF THE DAY — a ready-to-post WhatsApp status / social caption (under 60 words).
4. FOLLOW-UP REMINDER — who to chase and exactly what to say (one short message template).
5. MINDSET LINE — one short motivational line tied to real-estate selling.

Keep the whole guide under 220 words, energetic and specific to selling Nigerian property.`,
      };
    }
  }
}


/* ============================ 30-DAY PLAN ENGINE =========================== */

const PLAN_DAYS = 30;

type PlanDaySeed = { title: string; tasks: string[] };

/** Weekly rhythm used when the AI outline can't be produced — never fail plan creation. */
export function fallbackOutline(productName?: string | null): PlanDaySeed[] {
  const p = productName ? ` (${productName})` : "";
  const weeks: [string, string[]][] = [
    ["Foundation & visibility", [
      `Rewrite your WhatsApp bio and status to position you as the go-to realtor${p}`,
      "List 50 warm contacts and send a re-introduction message to 10 of them",
      `Post a strong introduction of the property${p} on your WhatsApp status`,
      "Join 2 community or business groups where your buyers gather",
    ]],
    ["Content & conversations", [
      `Post one benefit-led story about the property${p} (use the AI listing tool)`,
      "Follow up with every contact who replied last week",
      "Send the broadcast script to your warm list and log responses",
      "Ask 3 happy contacts for referrals or introductions",
    ]],
    ["Inspections & closing", [
      `Invite 5 hot prospects to inspect the property${p} this week`,
      "Post proof content — videos, client feedback, progress photos",
      "Handle the top 3 objections you're hearing with a written answer for each",
      "Present the payment plan clearly to every negotiating prospect",
    ]],
    ["Referrals & momentum", [
      "Check in with every client and ask for one referral each",
      "Run a 3-day countdown post series on any promo or price movement",
      "Review your pipeline: move every lead one stage forward or close the file",
      "Celebrate your wins publicly and set next month's target",
    ]],
  ];
  const days: PlanDaySeed[] = [];
  for (let w = 0; w < 4; w++) {
    const [theme, tasks] = weeks[w];
    for (let d = 0; d < 7 && days.length < 28; d++) {
      days.push({
        title: `${theme} — day ${d + 1}`,
        tasks: d === 6
          ? ["Review the week: what worked, what didn't, who to chase", "Plan next week's posts and follow-ups", "Rest, recharge, and visualise your target"]
          : [tasks[d % tasks.length], tasks[(d + 1) % tasks.length], tasks[(d + 2) % tasks.length]],
      });
    }
  }
  days.push({ title: "Full review & scorecard", tasks: ["Score the month: posts, conversations, inspections, sales", "Write your lessons learned and next-month strategy"] });
  days.push({ title: "Plan the next 30 days", tasks: ["Set your sales target for the new month", "Rebuild your contact list and pick your next focus property", "Book your first two inspections of the new month"] });
  return days.slice(0, PLAN_DAYS);
}

async function planStats(planId: number, totalTasks: number) {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(aiTaskReports)
    .where(eq(aiTaskReports.planId, planId));
  const done = row?.n ?? 0;
  return { totalTasks, doneTasks: done, percent: totalTasks ? Math.round((done / totalTasks) * 100) : 0 };
}

export const aiPlanRouter = createRouter({
  /** Create the member's 30-day plan (one active plan at a time). */
  create: authedQuery
    .input(
      z.object({
        productId: z.number().int().positive().optional(),
        goal: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const m = await myStudioMember(ctx.user.id);
      const db = getDb();
      const [existing] = await db
        .select()
        .from(aiPlans)
        .where(and(eq(aiPlans.memberId, m.id), eq(aiPlans.status, "active")));
      if (existing)
        throw new TRPCError({ code: "BAD_REQUEST", message: "You already have an active 30-day plan. Finish it first." });

      let product: typeof products.$inferSelect | null = null;
      if (input.productId) {
        const [p] = await db.select().from(products).where(eq(products.id, input.productId));
        if (!p) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown product" });
        product = p;
      }

      // Instant creation from the proven 30-day playbook (product name woven
      // into the tasks). The AI layer personalises each day LAZILY via the
      // per-day guide generator — a slow AI backend can never block or break
      // plan creation again.
      const outline = fallbackOutline(product?.name);
      const title = product ? `30-day push — ${product.name}` : "30-day marketing plan";
      const [row] = await db
        .insert(aiPlans)
        .values({ memberId: m.id, productId: product?.id ?? null, title, goal: input.goal?.trim() || null })
        .$returningId();
      for (let i = 0; i < outline.length; i++) {
        await db.insert(aiPlanDays).values({
          planId: row.id,
          day: i + 1,
          title: outline[i].title,
          tasks: outline[i].tasks,
        });
      }
      return { id: row.id, title, days: outline.length };
    }),

  /** The member's current (or most recent) plan with days, reports and progress. */
  mine: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [m] = await db.select().from(members).where(eq(members.userId, ctx.user.id));
    if (!m) return null;
    const [plan] = await db
      .select()
      .from(aiPlans)
      .where(eq(aiPlans.memberId, m.id))
      .orderBy(desc(aiPlans.createdAt))
      .limit(1);
    if (!plan) return null;
    const days = await db.select().from(aiPlanDays).where(eq(aiPlanDays.planId, plan.id)).orderBy(aiPlanDays.day);
    const reports = await db.select().from(aiTaskReports).where(eq(aiTaskReports.planId, plan.id));
    const totalTasks = days.reduce((sum, d) => sum + (d.tasks?.length ?? 0), 0);
    const stats = await planStats(plan.id, totalTasks);
    const [product] = plan.productId
      ? await db.select().from(products).where(eq(products.id, plan.productId))
      : [null];
    const currentDay = Math.min(
      PLAN_DAYS,
      Math.max(1, Math.floor((Date.now() - new Date(plan.createdAt).getTime()) / 86_400_000) + 1)
    );
    return {
      plan,
      product: product ? { id: product.id, name: product.name, location: product.location } : null,
      days: days.map((d) => ({ id: d.id, day: d.day, title: d.title, tasks: d.tasks, hasGuide: Boolean(d.guide) })),
      reports,
      stats,
      currentDay,
    };
  }),

  /** Detailed AI guide for a specific day — built from that day's actual tasks. Cached. */
  dayGuide: authedQuery
    .input(z.object({ day: z.number().int().min(1).max(PLAN_DAYS) }))
    .mutation(async ({ ctx, input }) => {
      const m = await myStudioMember(ctx.user.id);
      const db = getDb();
      const [plan] = await db
        .select()
        .from(aiPlans)
        .where(eq(aiPlans.memberId, m.id))
        .orderBy(desc(aiPlans.createdAt))
        .limit(1);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Create your 30-day plan first." });
      const [d] = await db
        .select()
        .from(aiPlanDays)
        .where(and(eq(aiPlanDays.planId, plan.id), eq(aiPlanDays.day, input.day)));
      if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Day not found in this plan." });
      if (d.guide) return { day: d.day, title: d.title, guide: d.guide, cached: true };

      let product: typeof products.$inferSelect | null = null;
      if (plan.productId) {
        const [p] = await db.select().from(products).where(eq(products.id, plan.productId));
        product = p ?? null;
      }
      const productCtx = product ? listingContext(product) : "";
      const user = `Today is Day ${d.day} of a 30-day marketing plan for realtor ${m.firstName} ${m.lastName} (Club 10, Nigeria).
Day title: ${d.title}
Today's assigned tasks:
${d.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}
${productCtx ? `\nProperty being pushed (official facts):\n${productCtx}\n` : ""}
Write a practical guide for executing THIS specific day. Sections (plain line names, no # symbols):
1. HOW TO NAIL TODAY — 2-3 sentences on the smartest way to approach these exact tasks.
2. READY-TO-USE CONTENT — a WhatsApp status post or message template that directly accomplishes today's posting/outreach task (under 70 words).
3. TRACK YOUR NUMBERS — remind them to report back with: people contacted, responses received, viewings/inspections booked, plus a short note on how it went.
Keep the whole guide under 200 words, energetic and specific.`;

      let guide: string;
      try {
        guide = await chatComplete({ system: BRAND_VOICE, user, maxTokens: 1200 });
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: e instanceof Error ? e.message : "AI generation failed",
        });
      }
      await db.update(aiPlanDays).set({ guide }).where(eq(aiPlanDays.id, d.id));
      return { day: d.day, title: d.title, guide, cached: false };
    }),

  /** Tick a task done — REQUIRES a feedback report on how it went. */
  reportTask: authedQuery
    .input(
      z.object({
        day: z.number().int().min(1).max(PLAN_DAYS),
        taskIndex: z.number().int().min(0).max(4),
        feedback: z.string().min(10, "Tell us how it went — a short report is required to tick a task done.").max(2000),
        contacted: z.number().int().min(0).max(100000).optional(),
        responses: z.number().int().min(0).max(100000).optional(),
        viewings: z.number().int().min(0).max(100000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const m = await myStudioMember(ctx.user.id);
      const db = getDb();
      const [plan] = await db
        .select()
        .from(aiPlans)
        .where(eq(aiPlans.memberId, m.id))
        .orderBy(desc(aiPlans.createdAt))
        .limit(1);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Create your 30-day plan first." });
      const [d] = await db
        .select()
        .from(aiPlanDays)
        .where(and(eq(aiPlanDays.planId, plan.id), eq(aiPlanDays.day, input.day)));
      if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Day not found in this plan." });
      if (input.taskIndex >= (d.tasks?.length ?? 0))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Task not found on this day." });

      const [existing] = await db
        .select()
        .from(aiTaskReports)
        .where(
          and(
            eq(aiTaskReports.planId, plan.id),
            eq(aiTaskReports.day, input.day),
            eq(aiTaskReports.taskIndex, input.taskIndex)
          )
        );
      if (existing) {
        await db
          .update(aiTaskReports)
          .set({
            feedback: input.feedback,
            contacted: input.contacted ?? null,
            responses: input.responses ?? null,
            viewings: input.viewings ?? null,
          })
          .where(eq(aiTaskReports.id, existing.id));
      } else {
        await db.insert(aiTaskReports).values({
          planId: plan.id,
          memberId: m.id,
          day: input.day,
          taskIndex: input.taskIndex,
          feedback: input.feedback,
          contacted: input.contacted ?? null,
          responses: input.responses ?? null,
          viewings: input.viewings ?? null,
        });
      }

      // auto-complete the plan when every task is reported
      const allDays = await db.select().from(aiPlanDays).where(eq(aiPlanDays.planId, plan.id));
      const totalTasks = allDays.reduce((sum, x) => sum + (x.tasks?.length ?? 0), 0);
      const stats = await planStats(plan.id, totalTasks);
      if (stats.doneTasks >= totalTasks && plan.status === "active") {
        await db.update(aiPlans).set({ status: "completed" }).where(eq(aiPlans.id, plan.id));
      }
      return { ok: true, ...stats };
    }),

  /** Untick a task (removes its report) in case it was marked done by mistake. */
  unreportTask: authedQuery
    .input(z.object({ day: z.number().int().min(1).max(PLAN_DAYS), taskIndex: z.number().int().min(0).max(4) }))
    .mutation(async ({ ctx, input }) => {
      const m = await myStudioMember(ctx.user.id);
      const db = getDb();
      const [plan] = await db
        .select()
        .from(aiPlans)
        .where(eq(aiPlans.memberId, m.id))
        .orderBy(desc(aiPlans.createdAt))
        .limit(1);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .delete(aiTaskReports)
        .where(
          and(
            eq(aiTaskReports.planId, plan.id),
            eq(aiTaskReports.day, input.day),
            eq(aiTaskReports.taskIndex, input.taskIndex)
          )
        );
      if (plan.status === "completed")
        await db.update(aiPlans).set({ status: "active" }).where(eq(aiPlans.id, plan.id));
      return { ok: true };
    }),
});

export const aiRouter = createRouter({
  /** Generate a marketing asset with AI, save it to the member's library. */
  generate: authedQuery.input(toolInput).mutation(async ({ ctx, input }) => {
    if (!aiConfigured())
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI service is not configured on this server." });
    const m = await myStudioMember(ctx.user.id);
    await enforceDailyLimit(m.id);
    const db = getDb();

    let product: typeof products.$inferSelect | null = null;
    if ("productId" in input && input.productId) {
      const [p] = await db.select().from(products).where(eq(products.id, input.productId));
      if (!p) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown product" });
      product = p;
    }

    const { title, user } = buildPrompt(input, m, product);
    let content: string;
    try {
      content = await chatComplete({ system: BRAND_VOICE, user });
    } catch (e) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: e instanceof Error ? e.message : "AI generation failed",
      });
    }

    const meta = JSON.stringify({
      tone: "tone" in input ? input.tone : undefined,
      productId: product?.id,
      productName: product?.name,
      stage: input.tool === "followup" ? input.stage : undefined,
    });
    const [row] = await db
      .insert(aiMarketingAssets)
      .values({ memberId: m.id, tool: input.tool, title, content, meta })
      .$returningId();
    const [saved] = await db
      .select()
      .from(aiMarketingAssets)
      .where(eq(aiMarketingAssets.id, row.id));
    return saved;
  }),

  /** Member's saved assets, newest first, optionally filtered by tool. */
  history: authedQuery
    .input(z.object({ tool: z.enum(TOOLS).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [m] = await db.select().from(members).where(eq(members.userId, ctx.user.id));
      if (!m) return [];
      const cond = input?.tool
        ? and(eq(aiMarketingAssets.memberId, m.id), eq(aiMarketingAssets.tool, input.tool))
        : eq(aiMarketingAssets.memberId, m.id);
      return db
        .select()
        .from(aiMarketingAssets)
        .where(cond)
        .orderBy(desc(aiMarketingAssets.createdAt))
        .limit(100);
    }),

  /** How many generations the member has left today. */
  usage: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [m] = await db.select().from(members).where(eq(members.userId, ctx.user.id));
    if (!m) return { used: 0, limit: DAILY_LIMIT };
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(aiMarketingAssets)
      .where(and(eq(aiMarketingAssets.memberId, m.id), sql`created_at >= CURDATE()`));
    return { used: row?.n ?? 0, limit: DAILY_LIMIT };
  }),

  /** Delete one of the member's own saved assets. */
  remove: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [m] = await db.select().from(members).where(eq(members.userId, ctx.user.id));
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      const [row] = await db
        .select()
        .from(aiMarketingAssets)
        .where(and(eq(aiMarketingAssets.id, input.id), eq(aiMarketingAssets.memberId, m.id)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      await db.delete(aiMarketingAssets).where(eq(aiMarketingAssets.id, row.id));
      return { ok: true };
    }),
});
