import { getDb } from "../queries/connection";
import { settings, pushSubscriptions, users } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Out-of-app notification delivery: device push (Web Push / VAPID) and email
 * (SMTP via nodemailer). Both are best-effort — delivery failures never block
 * the in-app notification, which is always written first.
 *
 * Admin configures both under Admin → Settings → "Admin alerts":
 *  - device push: generate keys once, admins subscribe from the same card
 *  - email: SMTP host/port/user/pass + the admin alert inbox
 */

let vapidReady = false;

export async function getSettingValue(key: string): Promise<string | null> {
  const db = getDb();
  const [r] = await db.select().from(settings).where(eq(settings.key, key));
  return r?.value ?? null;
}

export async function getVapidKeys(): Promise<{ pub: string; priv: string } | null> {
  const [pub, priv] = await Promise.all([getSettingValue("vapid_public"), getSettingValue("vapid_private")]);
  if (!pub || !priv) return null;
  if (!vapidReady) {
    const webpush = ((m)=>m.default??m)(await import("web-push"));
    webpush.setVapidDetails("mailto:admin@club10.local", pub, priv);
    vapidReady = true;
  }
  return { pub, priv };
}

/** Generate and persist a VAPID keypair (admin action, one time). */
export async function ensureVapidKeys(): Promise<{ pub: string; priv: string }> {
  const existing = await getVapidKeys();
  if (existing) return existing;
  const webpush = ((m)=>m.default??m)(await import("web-push"));
  const pair = webpush.generateVAPIDKeys();
  const db = getDb();
  for (const [key, value] of [
    ["vapid_public", pair.publicKey],
    ["vapid_private", pair.privateKey],
  ] as const) {
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  }
  const webpush2 = ((m)=>m.default??m)(await import("web-push"));
  webpush2.setVapidDetails("mailto:admin@club10.local", pair.publicKey, pair.privateKey);
  vapidReady = true;
  return { pub: pair.publicKey, priv: pair.privateKey };
}

/** Send a device push to every subscription of the given user. */
export async function sendPushToUser(
  userId: number,
  payload: { title: string; body?: string; url?: string }
): Promise<number> {
  const keys = await getVapidKeys();
  if (!keys) return 0;
  const db = getDb();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (!subs.length) return 0;
  const webpush = ((m)=>m.default??m)(await import("web-push"));
  let sent = 0;
  for (const s of subs) {
    try {
      const k = JSON.parse(s.keys) as { p256dh: string; auth: string };
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: k },
        JSON.stringify({ title: payload.title, body: payload.body ?? "", url: payload.url ?? "/" })
      );
      sent++;
    } catch (e) {
      // gone/410 = stale subscription — remove it
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      }
    }
  }
  return sent;
}

/** Send push to all admins (used alongside notifyAdmins). */
export async function sendPushToAdmins(payload: { title: string; body?: string; url?: string }) {
  const db = getDb();
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  for (const a of admins) await sendPushToUser(a.id, payload);
}

/* --------------------------------- email --------------------------------- */

async function smtpConfig() {
  const [host, port, user, pass, from, to] = await Promise.all([
    getSettingValue("smtp.host"),
    getSettingValue("smtp.port"),
    getSettingValue("smtp.user"),
    getSettingValue("smtp.pass"),
    getSettingValue("smtp.from"),
    getSettingValue("admin.alert_email"),
  ]);
  if (!host || !user || !pass || !to) return null;
  return { host, port: parseInt(port ?? "587", 10), user, pass, from: from || user, to };
}

/** True when email alerts are fully configured. */
export async function emailConfigured(): Promise<boolean> {
  return (await smtpConfig()) != null;
}

/** Send an email alert to the admin alert inbox. No-op until SMTP is configured. */
export async function sendAdminEmail(subject: string, text: string): Promise<boolean> {
  const cfg = await smtpConfig();
  if (!cfg) return false;
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transport.sendMail({ from: cfg.from, to: cfg.to, subject, text });
    return true;
  } catch {
    return false;
  }
}

/** Combined admin alert: in-app + push + email. */
export async function alertAdmins(title: string, message: string, url?: string) {
  await Promise.allSettled([
    sendPushToAdmins({ title, body: message, url }),
    sendAdminEmail(`Club 10 — ${title}`, `${message}${url ? `\n\nOpen: ${url}` : ""}`),
  ]);
}
