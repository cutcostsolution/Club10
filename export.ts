import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { verifySessionToken } from "../kimi/session";
import { getDb } from "../queries/connection";
import { users, members, products, productCategories, payments, sales, commissions, pointsLedger } from "../../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

/**
 * Admin CSV exports — biodata (with upline + status), products, payment
 * history and product sales, all filterable by date range.
 * Session-authenticated, admin-only, streamed as text/csv downloads.
 */

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return "﻿" + lines.join("\n"); // BOM so Excel opens UTF-8 correctly
}

function fmtDT(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().replace("T", " ").slice(0, 19);
}

function fmtD(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

async function requireAdmin(cookie: string | undefined) {
  const token = cookie?.match(/kimi_sid=([^;]+)/)?.[1] ?? "";
  const session = await verifySessionToken(token);
  if (!session?.unionId) return null;
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.unionId, session.unionId));
  return u?.role === "admin" ? u : null;
}

function rangeConds(col: ReturnType<typeof sql> | never, from?: string, to?: string) {
  const conds = [];
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) conds.push(gte(col as never, new Date(`${from}T00:00:00Z`) as never));
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conds.push(lte(col as never, new Date(`${to}T23:59:59Z`) as never));
  return conds;
}

export function registerExportRoutes(app: Hono<{ Bindings: HttpBindings }>) {
  app.get("/api/export/:dataset", async (c) => {
    const admin = await requireAdmin(c.req.header("cookie"));
    if (!admin) return c.json({ error: "Admin access required." }, 403);

    const dataset = c.req.param("dataset");
    const from = c.req.query("from");
    const to = c.req.query("to");
    // per-dashboard filters — each export honours the natural filters of its page
    const fStatus = c.req.query("status");
    const fCategory = c.req.query("category");   // members: plan code · products: category id
    const fType = c.req.query("type");           // payments: membership | property | commission_claim
    const fProduct = c.req.query("productId");   // sales
    const fAction = c.req.query("action");       // points ledger
    const db = getDb();
    let csv = "";
    let filename = `${dataset}.csv`;

    if (dataset === "members") {
      const rows = await db
        .select({ m: members, email: users.email, upline: sql<string | null>`(SELECT CONCAT(m2.first_name, ' ', m2.last_name, ' (', m2.membership_code, ')') FROM members m2 WHERE m2.id = ${members.referrerId})` })
        .from(members)
        .leftJoin(users, eq(members.userId, users.id))
        .orderBy(members.id);
      const filtered = rows.filter((r) => {
        const d = new Date(r.m.createdAt).getTime();
        if (from && d < new Date(`${from}T00:00:00Z`).getTime()) return false;
        if (to && d > new Date(`${to}T23:59:59Z`).getTime()) return false;
        if (fStatus && r.m.status !== fStatus) return false;
        if (fCategory && r.m.category !== fCategory) return false;
        return true;
      });
      csv = toCsv(
        ["Membership code", "First name", "Last name", "Email", "Phone", "Plan", "Status", "Upline", "Referral code", "Points", "Voucher balance (₦)", "Street", "City", "State", "Country", "Bank name", "Account number", "Account name", "Joined", "Membership expires"],
        filtered.map((r) => [
          r.m.membershipCode, r.m.firstName, r.m.lastName, r.email ?? "", r.m.phone ?? "",
          r.m.category, r.m.status, r.upline ?? "— (direct)", r.m.referralCode,
          r.m.pointsBalance, r.m.voucherBalance,
          r.m.address ?? "", r.m.city ?? "", r.m.state ?? "", r.m.country ?? "",
          r.m.bankName ?? "", r.m.accountNumber ?? "", r.m.accountName ?? "",
          fmtDT(r.m.createdAt), fmtD(r.m.expiresAt),
        ])
      );
      filename = "club10-realtors.csv";
    } else if (dataset === "products") {
      const prodConds = [];
      if (fStatus) prodConds.push(eq(products.status, fStatus as never));
      if (fCategory && !Number.isNaN(Number(fCategory))) prodConds.push(eq(products.categoryId, Number(fCategory)));
      const rows = await db
        .select({ p: products, catName: productCategories.name, catPct: productCategories.commissionPct })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(prodConds.length ? and(...prodConds) : undefined)
        .orderBy(products.id);
      csv = toCsv(
        ["ID", "Product", "Community / category", "Tag", "Status", "Price (₦)", "Price label", "Location", "State", "Country", "Title status", "Commission %", "Highlights", "Features & infrastructure", "Payment plan", "Listed"],
        rows.map((r) => [
          r.p.id, r.p.name, r.catName ?? "", r.p.tag ?? "", r.p.status, r.p.price, r.p.priceLabel ?? "",
          r.p.location ?? "", r.p.state ?? "", r.p.country ?? "", r.p.titleStatus ?? "",
          r.p.commissionPct ?? r.catPct ?? "",
          (r.p.highlights ?? "").replace(/\n/g, " | "), (r.p.features ?? "").replace(/\n/g, " | "),
          (r.p.paymentPlan ?? "").replace(/\n/g, " | "), fmtD(r.p.createdAt),
        ])
      );
      filename = "club10-products.csv";
    } else if (dataset === "payments") {
      const conds = rangeConds(sql`${payments.createdAt}` as never, from, to);
      if (fStatus) conds.push(eq(payments.status, fStatus as never) as never);
      if (fType) conds.push(eq(payments.type, fType as never) as never);
      const rows = await db
        .select({
          p: payments,
          memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
          code: members.membershipCode,
        })
        .from(payments)
        .leftJoin(members, eq(payments.memberId, members.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(payments.id);
      csv = toCsv(
        ["ID", "Date", "Member", "Code", "Type", "Plan", "Amount (₦)", "Status", "Reviewed at", "Note"],
        rows.map((r) => [
          r.p.id, fmtDT(r.p.createdAt), r.memberName ?? "", r.code ?? "", r.p.type, r.p.planCode ?? "",
          r.p.amount, r.p.status, fmtDT(r.p.reviewedAt), (r.p.note ?? "").replace(/\n/g, " "),
        ])
      );
      filename = "club10-payments.csv";
    } else if (dataset === "sales") {
      const conds = rangeConds(sql`${sales.createdAt}` as never, from, to);
      if (fStatus) conds.push(eq(sales.status, fStatus as never) as never);
      if (fProduct && !Number.isNaN(Number(fProduct))) conds.push(eq(sales.productId, Number(fProduct)) as never);
      const rows = await db
        .select({
          s: sales,
          productName: products.name,
          sellerName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
          sellerCode: members.membershipCode,
        })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .leftJoin(members, eq(sales.sellerId, members.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(sales.id);
      csv = toCsv(
        ["ID", "Date", "Product", "Seller", "Seller code", "Buyer", "Sale price (₦)", "Payment date", "Sender", "Status", "Description"],
        rows.map((r) => [
          r.s.id, fmtDT(r.s.createdAt), r.productName ?? "", r.sellerName ?? "", r.sellerCode ?? "",
          r.s.buyerName ?? "", r.s.salePrice, r.s.paymentDate ?? "", r.s.senderName ?? "", r.s.status,
          (r.s.description ?? "").replace(/\n/g, " "),
        ])
      );
      filename = "club10-sales.csv";
    } else if (dataset === "commissions") {
      const conds = rangeConds(sql`${commissions.createdAt}` as never, from, to);
      if (fStatus) conds.push(eq(commissions.status, fStatus as never) as never);
      const rows = await db
        .select({
          c2: commissions,
          memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
          code: members.membershipCode,
        })
        .from(commissions)
        .leftJoin(members, eq(commissions.memberId, members.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(commissions.id);
      csv = toCsv(
        ["ID", "Date", "Member", "Code", "Sale ID", "Level", "Amount (₦)", "Status"],
        rows.map((r) => [
          r.c2.id, fmtDT(r.c2.createdAt), r.memberName ?? "", r.code ?? "",
          r.c2.saleId ?? "plan payment",
          r.c2.level === -1
            ? r.c2.note?.startsWith("Renewal") ? "renewal"
            : r.c2.note?.startsWith("Upgrade") ? "upgrade"
            : "registration"
            : r.c2.level === 0 ? "direct" : `chain L${r.c2.level}`,
          r.c2.amount, r.c2.status,
        ])
      );
      filename = "club10-commissions.csv";
    } else if (dataset === "points") {
      const conds = rangeConds(sql`${pointsLedger.createdAt}` as never, from, to);
      if (fAction) conds.push(eq(pointsLedger.action, fAction as never) as never);
      const rows = await db
        .select({
          pl: pointsLedger,
          memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
          code: members.membershipCode,
        })
        .from(pointsLedger)
        .leftJoin(members, eq(pointsLedger.memberId, members.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(pointsLedger.id);
      csv = toCsv(
        ["ID", "Date", "Member", "Code", "Action", "Points", "Detail"],
        rows.map((r) => [r.pl.id, fmtDT(r.pl.createdAt), r.memberName ?? "", r.code ?? "", r.pl.action, r.pl.points, r.pl.meta ?? ""])
      );
      filename = "club10-points.csv";
    } else {
      return c.json({ error: "Unknown dataset — members | products | payments | sales | commissions | points" }, 400);
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
