import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { memberRouter } from "./routers/member";
import { catalogRouter, salesRouter, pointsRouter, trackRouter, blogRouter } from "./routers/business";
import { academyRouter } from "./routers/academy";
import { adminRouter, cmsRouter } from "./routers/admin";
import { notificationsRouter } from "./routers/notifications";
import { aiPlanRouter, aiRouter } from "./routers/ai";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  member: memberRouter,
  catalog: catalogRouter,
  sales: salesRouter,
  points: pointsRouter,
  track: trackRouter,
  academy: academyRouter,
  blog: blogRouter,
  admin: adminRouter,
  cms: cmsRouter,
  notifications: notificationsRouter,
  ai: aiRouter,
  aiPlan: aiPlanRouter,
});

export type AppRouter = typeof appRouter;
