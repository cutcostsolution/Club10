import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, or } from "drizzle-orm";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { hashPassword, verifyPassword } from "./lib/password";
import { signSessionToken } from "./kimi/session";
import { env } from "./lib/env";

function setSessionCookie(ctx: { req: Request; resHeaders: Headers }, unionId: string) {
  return signSessionToken({ unionId, clientId: env.appId || "club10" }).then((token) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, token, {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: Session.maxAgeMs / 1000,
      }),
    );
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  /** Create a MEMBER account with email + password. Admin accounts are never
   *  created here — only the Central Admin can create them (admin.createAdmin). */
  register: publicQuery
    .input(
      z.object({
        firstName: z.string().trim().min(1, "First name is required").max(120),
        lastName: z.string().trim().min(1, "Last name is required").max(120),
        email: z.string().max(320).refine((v) => EMAIL_RE.test(v), "Enter a valid email address"),
        phone: z.string().max(40).optional(),
        password: z.string().min(8, "Password must be at least 8 characters").max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists — sign in instead." });
      }
      const unionId = `email:${email}`;
      await db.insert(users).values({
        unionId,
        name: `${input.firstName} ${input.lastName}`.trim(),
        email,
        phone: input.phone?.trim() || null,
        passwordHash: await hashPassword(input.password),
        role: "user",
        lastSignInAt: new Date(),
      });
      await setSessionCookie(ctx, unionId);
      return { ok: true, role: "user" };
    }),

  /** Sign in with email (or phone) + password. */
  login: publicQuery
    .input(z.object({ identifier: z.string().min(1).max(320), password: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const id = input.identifier.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(or(eq(users.email, id), eq(users.phone, input.identifier.trim()), eq(users.unionId, id)))
        .limit(1);
      if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Wrong email/phone or password." });
      }
      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
      await setSessionCookie(ctx, user.unionId);
      return { ok: true, role: user.role, name: user.name };
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
