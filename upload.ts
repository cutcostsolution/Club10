import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { verifySessionToken } from "../kimi/session";

/**
 * File uploads — product photos, avatars, starter-kit files, CMS images.
 *
 * Security posture:
 *  - session-authenticated (same signed kimi_sid cookie as tRPC)
 *  - admin role required EXCEPT "avatar" kind (any logged-in member)
 *  - allow-listed MIME types + extension allowlist, 10MB cap
 *  - content sniffed by magic bytes — a renamed .exe never gets through
 *  - files land under the durable brand store (/mnt/agents/output/brands/club10/uploads/<kind>/)
 *    — OUTSIDE the app project, so platform version snapshots and rebuilds
 *    can never wipe uploaded photos again. Falls back to ./data/uploads
 *    when the durable store is unavailable (local dev).
 */

// Candidate roots, in order — first writable one wins. The brand folder under
// /mnt/agents/output is the only storage that survives environment rebuilds.
const CANDIDATES = [
  "/mnt/agents/output/brands/club10/uploads",
  "/mnt/agents/data/club10-files/uploads",
  path.resolve(process.cwd(), "data/uploads"),
];
const UPLOAD_ROOT = (() => {
  for (const root of CANDIDATES) {
    try {
      fs.mkdirSync(root, { recursive: true });
      const probe = path.join(root, ".probe");
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
      return root;
    } catch { /* try next */ }
  }
  return path.resolve(process.cwd(), "data/uploads");
})();
// static serve root: /uploads/<kind>/<file> maps to <SERVE_ROOT>/uploads/<kind>/<file>
const SERVE_ROOT = path.dirname(UPLOAD_ROOT);

const MAGIC: Record<string, { mime: string; ext: string }> = {
  "ffd8ff": { mime: "image/jpeg", ext: "jpg" },
  "89504e47": { mime: "image/png", ext: "png" },
  "47494638": { mime: "image/gif", ext: "gif" },
  "25504446": { mime: "application/pdf", ext: "pdf" },
};

function sniff(buf: Buffer): { mime: string; ext: string } | null {
  const hex4 = buf.subarray(0, 4).toString("hex");
  if (MAGIC[hex4]) return MAGIC[hex4];
  const hex3 = buf.subarray(0, 3).toString("hex");
  if (MAGIC[hex3]) return MAGIC[hex3];
  // webp: "RIFF" .... "WEBP"
  if (hex4 === "52494646" && buf.subarray(8, 12).toString("hex") === "57454250")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
const KINDS = new Set(["product", "avatar", "starter", "cms", "receipt"]);
// kinds any logged-in member may upload (everything else is admin-only)
const MEMBER_KINDS = new Set(["avatar", "receipt"]);

async function userRole(unionId: string): Promise<string | null> {
  const { getDb } = await import("../queries/connection");
  const { users } = await import("@db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.unionId, unionId));
  return u?.role ?? null;
}

export function registerUploadRoutes(app: Hono<{ Bindings: HttpBindings }>) {
  // serve uploaded files (read-only; long cache — filenames are unique)
  app.use("/uploads/*", serveStatic({ root: SERVE_ROOT }));

  app.post("/api/upload", bodyLimit({ maxSize: 26 * 1024 * 1024, onError: (c) => c.json({ error: "File too large (25MB max)" }, 413) }), async (c) => {
    const cookie = c.req.header("cookie") ?? "";
    const token = cookie.match(/kimi_sid=([^;]+)/)?.[1];
    const session = await verifySessionToken(token ?? "");
    if (!session?.unionId) return c.json({ error: "Sign in to upload files." }, 401);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    const kind = String(form?.get("kind") ?? "cms");
    if (!(file instanceof File)) return c.json({ error: "No file attached." }, 400);
    if (!KINDS.has(kind)) return c.json({ error: "Unknown upload kind." }, 400);

    // member kinds (avatar, payment receipts): the member themselves;
    // everything else is back-office → admin only
    if (!MEMBER_KINDS.has(kind)) {
      const role = await userRole(session.unionId);
      if (role !== "admin") return c.json({ error: "Admin access required for this upload." }, 403);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 25 * 1024 * 1024) return c.json({ error: "File too large (25MB max)." }, 413);
    const sniffed = sniff(buf);
    if (!sniffed || !ALLOWED_MIME.has(sniffed.mime))
      return c.json({ error: "Only PNG, JPG, GIF, WEBP images or PDF documents are allowed." }, 415);

    const dir = path.join(UPLOAD_ROOT, kind);
    fs.mkdirSync(dir, { recursive: true });
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${sniffed.ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return c.json({ url: `/uploads/${kind}/${name}`, mime: sniffed.mime, size: buf.length });
  });
}
