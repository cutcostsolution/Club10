import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { verifySessionToken } from "../kimi/session";
import { getDb } from "../queries/connection";
import { users, pushSubscriptions } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getVapidKeys } from "./deliver";

/**
 * Device push (Web Push API) — subscribe/unsubscribe the signed-in user's
 * browser or phone. Sends ride on notifyAdmins/notify via lib/deliver.ts.
 */

export function registerPushRoutes(app: Hono<{ Bindings: HttpBindings }>) {
  // public VAPID key for the subscription handshake (404 until keys are generated)
  app.get("/api/push/vapid", async (c) => {
    const keys = await getVapidKeys();
    if (!keys) return c.json({ error: "Push not configured yet." }, 404);
    return c.json({ publicKey: keys.pub });
  });

  app.post("/api/push/subscribe", async (c) => {
    const cookie = c.req.header("cookie") ?? "";
    const session = await verifySessionToken(cookie.match(/kimi_sid=([^;]+)/)?.[1] ?? "");
    if (!session?.unionId) return c.json({ error: "Sign in first." }, 401);
    const body = await c.req.json().catch(() => null) as {
      endpoint?: string; keys?: { p256dh?: string; auth?: string };
    } | null;
    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth)
      return c.json({ error: "Invalid subscription." }, 400);

    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.unionId, session.unionId));
    if (!u) return c.json({ error: "Account not found." }, 404);

    // one row per endpoint per user — resubscribing the same device just refreshes keys
    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, u.id), eq(pushSubscriptions.endpoint, body.endpoint)));
    const keysJson = JSON.stringify({ p256dh: body.keys.p256dh, auth: body.keys.auth });
    if (existing) {
      await db.update(pushSubscriptions).set({ keys: keysJson }).where(eq(pushSubscriptions.id, existing.id));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: u.id,
        endpoint: body.endpoint,
        keys: keysJson,
        userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
      });
    }
    return c.json({ ok: true });
  });

  app.post("/api/push/unsubscribe", async (c) => {
    const cookie = c.req.header("cookie") ?? "";
    const session = await verifySessionToken(cookie.match(/kimi_sid=([^;]+)/)?.[1] ?? "");
    if (!session?.unionId) return c.json({ error: "Sign in first." }, 401);
    const body = await c.req.json().catch(() => null) as { endpoint?: string } | null;
    if (!body?.endpoint) return c.json({ error: "Invalid request." }, 400);
    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.unionId, session.unionId));
    if (u) {
      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, u.id), eq(pushSubscriptions.endpoint, body.endpoint)));
    }
    return c.json({ ok: true });
  });
}
