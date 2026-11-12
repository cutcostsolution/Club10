/**
 * v18e test suite — Club 10
 * Covers:
 *  1. Notification action URLs — every URL emitted by notify()/notifyAdmins()
 *     in the codebase AND every URL stored in the live DB resolves to a real
 *     React route (no more 404s).
 *  2. Rewards page — no double "pts" suffix (fmtPoints already appends it).
 *  3. Voucher — gift redemption with the voucher is NOT gated behind a first
 *     sale any more: a member with voucher balance and zero sales can redeem.
 *  4. Commission calculator in the member dashboard (AppHome) with a dropdown
 *     product picker.
 *  5. Target calculator — sliders drive the suggested route live, and the
 *     route can be applied back into the sliders.
 * Run: npx tsx scripts-test-v18e.ts   (server on :3000)
 */
import { signSessionToken } from "./api/kimi/session";
import { getDb } from "./api/queries/connection";
import { users, members, rewards, redemptions, voucherTransactions, notifications, sales, lessons, modules, courses, blogPosts, payments, commissions, membershipPlans } from "./db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./api/lib/password";
import fs from "fs";

const BASE = "http://localhost:3000";
const VOUCHER_EMAIL = "v18e-voucher@test.local";
const ADMIN_EMAIL = "realestateintelligencelab@gmail.com";

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, name: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}`); }
}

const QUERIES = new Set(["points.voucherWallet", "points.rewards", "member.me", "academy.lesson", "blog.get", "blog.list", "admin.commissionSettings", "member.me", "member.earnings", "admin.commissionLedger"]);

async function trpc(token: string, path: string, input?: unknown) {
  const useGet = QUERIES.has(path);
  let res: Response;
  if (useGet) {
    const q = input === undefined ? "" : `&input=${encodeURIComponent(JSON.stringify({ "0": { json: input } }))}`;
    res = await fetch(`${BASE}/api/trpc/${path}?batch=1${q}`, { headers: { Cookie: `kimi_sid=${token}` } });
  } else {
    res = await fetch(`${BASE}/api/trpc/${path}?batch=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kimi_sid=${token}` },
      body: JSON.stringify({ "0": { json: input ?? null } }),
    });
  }
  const body = (await res.json()) as any[];
  const item = body?.[0] ?? {};
  if (item.error) return { error: item.error.json?.message ?? "error", status: res.status };
  return { data: item.result?.data?.json, status: res.status };
}

const mint = (email: string) => signSessionToken({ unionId: `email:${email}`, clientId: "club10" });

/* Every route that exists in src/App.tsx */
const VALID_ROUTES = new Set([
  "/", "/brand", "/business", "/academy", "/join", "/blog", "/verify", "/login",
  "/app", "/app/properties", "/app/training", "/app/earnings", "/app/team",
  "/app/rewards", "/app/links", "/app/marketing", "/app/starter-kit", "/app/profile",
  "/admin", "/admin/realtors", "/admin/products", "/admin/payments", "/admin/blog",
  "/admin/commissions", "/admin/points", "/admin/academy", "/admin/compliance",
  "/admin/plans", "/admin/cms", "/admin/settings", "/admin/starter-kit", "/admin/marketing-tracker",
]);

async function main() {
  const db = getDb();

  /* ================= 1. notification URLs resolve to real routes ================= */
  console.log("\nnotification URLs");
  const apiFiles = [
    "api/queries/engine.ts", "api/routers/academy.ts", "api/routers/admin.ts",
    "api/routers/business.ts", "api/routers/member.ts", "api/routers/payments.ts",
  ];
  let badInCode = 0;
  for (const f of apiFiles) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/"(\/(?:app|admin|dashboard)[^"]*)"/g)) {
      const url = m[1];
      if (!VALID_ROUTES.has(url)) {
        badInCode++;
        console.log(`    stale URL in ${f}: ${url}`);
      }
    }
  }
  ok(badInCode === 0, "every notification URL in the codebase is a real route");
  ok(!apiFiles.some((f) => fs.existsSync(f) && fs.readFileSync(f, "utf8").includes('"/dashboard')), "no /dashboard URLs left in code");

  const dbRows = await db.select({ actionUrl: notifications.actionUrl }).from(notifications);
  const badInDb = dbRows.filter((r) => r.actionUrl && !VALID_ROUTES.has(r.actionUrl));
  ok(badInDb.length === 0, `all ${dbRows.length} stored notifications point at real routes`);

  /* ================= 2. no double "pts" on the rewards page ================= */
  console.log("\nrewards page pts rendering");
  const rewardsSrc = fs.readFileSync("src/pages/app/Rewards.tsx", "utf8");
  ok(!/fmtPoints\([^)]*\)\} (pts|points)/.test(rewardsSrc), "no fmtPoints() followed by pts/points suffix");
  ok(!/\$\{fmtPoints\([^)]*\)\} pts/.test(rewardsSrc), "no template-string fmtPoints with pts suffix");

  /* ================= 3. voucher usable without any sale ================= */
  console.log("\nvoucher redemption without a sale");
  // clean prior run
  {
    const [u] = await db.select().from(users).where(eq(users.email, VOUCHER_EMAIL));
    if (u) {
      const [m] = await db.select().from(members).where(eq(members.userId, u.id));
      if (m) {
        await db.delete(redemptions).where(eq(redemptions.memberId, m.id));
        await db.delete(voucherTransactions).where(eq(voucherTransactions.memberId, m.id));
        await db.delete(sales).where(eq(sales.sellerId, m.id));
        await db.delete(notifications).where(eq(notifications.userId, u.id));
        await db.delete(members).where(eq(members.id, m.id));
      }
      await db.delete(users).where(eq(users.id, u.id));
    }
  }
  const passwordHash = await hashPassword("TestPass123!");
  const [uIns] = await db.insert(users).values({
    unionId: `email:${VOUCHER_EMAIL}`, email: VOUCHER_EMAIL, passwordHash, role: "user", name: "V18e Voucher",
  });
  const userId = Number((uIns as any).insertId);
  const [mIns] = await db.insert(members).values({
    userId, firstName: "V18e", lastName: "Voucher", email: VOUCHER_EMAIL,
    phone: "08000000018", category: "pro", status: "active",
    membershipCode: "CLB-V18E01", referralCode: "V18ETEST",
    voucherBalance: 500_000, pointsBalance: 0,
  });
  const memberId = Number((mIns as any).insertId);

  // voucher-priced reward owned by the test (deleted afterwards)
  const [rIns] = await db.insert(rewards).values({
    name: "V18e Voucher Gift", description: "test", pointCost: 999999,
    voucherCost: 200_000, status: "live",
  });
  const rewardId = Number((rIns as any).insertId);

  const token = await mint(VOUCHER_EMAIL);
  const wallet = await trpc(token, "points.voucherWallet");
  ok(wallet.data?.balance === 500_000, `voucher wallet reads balance 500,000 (got ${wallet.data?.balance})`);
  ok(wallet.data && !("giftUnlocked" in wallet.data), "wallet no longer reports a gift-unlock gate");

  const redeem = await trpc(token, "points.redeemWithVoucher", { rewardId });
  ok(!redeem.error, `voucher redemption succeeds with zero sales (${redeem.error ?? "ok"})`);
  const walletAfter = await trpc(token, "points.voucherWallet");
  ok(walletAfter.data?.balance === 300_000, `balance debited to 300,000 (got ${walletAfter.data?.balance})`);
  const [red] = await db.select().from(redemptions).where(eq(redemptions.memberId, memberId));
  ok(!!red && red.voucherSpent === 200_000 && red.pointsSpent === 0, "redemption recorded as voucher spend");

  // cleanup
  await db.delete(redemptions).where(eq(redemptions.memberId, memberId));
  await db.delete(voucherTransactions).where(eq(voucherTransactions.memberId, memberId));
  await db.delete(rewards).where(eq(rewards.id, rewardId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(members).where(eq(members.id, memberId));
  await db.delete(users).where(eq(users.id, userId));

  /* ================= 4. calculator in member dashboard, dropdown picker ================= */
  console.log("\nmember dashboard commission calculator");
  const homeSrc = fs.readFileSync("src/pages/app/AppHome.tsx", "utf8");
  ok(homeSrc.includes('CommissionCalculator variant="member"'), "AppHome embeds the commission calculator (member variant)");
  const calcSrc = fs.readFileSync("src/components/business/CommissionCalculator.tsx", "utf8");
  ok(calcSrc.includes("<select") && calcSrc.includes("Select product"), "member variant uses a dropdown product picker");
  ok(calcSrc.includes('variant === "member" ? me?.plan?.code'), "member variant defaults the seat to the member's own plan");
  ok(calcSrc.includes('enabled: variant === "member"'), "member profile only fetched in member variant (public page unaffected)");

  /* ================= 5. target calculator sliders are the plan ================= */
  console.log("\ntarget calculator sliders");
  const tcSrc = fs.readFileSync("src/components/business/TargetCalculator.tsx", "utf8");
  ok(tcSrc.includes("const gap = Math.max(target - projected, 0)"), "suggested route plans only the gap left by the sliders");
  ok(tcSrc.includes("[target, projected, paidPlans"), "route recalculates the moment any slider moves");
  ok(tcSrc.includes("applySuggestion") && tcSrc.includes("Apply this route to my plan below"), "route can be applied into the sliders");
  ok(tcSrc.includes("resetSliders"), "plan can be reset");
  ok(tcSrc.includes("Suggested route for the remaining"), "route header shows the remaining gap when sliders cover part of the target");

  /* ================= 6. scroll restoration + dropdown pickers (v18f) ================= */
  console.log("\nscroll restoration & dropdown pickers");
  const mainSrc = fs.readFileSync("src/main.tsx", "utf8");
  ok(mainSrc.includes("ScrollToTop") && mainSrc.includes("window.scrollTo(0, 0)"), "app scrolls to top on every navigation");
  ok(mainSrc.includes("hash.slice(1)") && mainSrc.includes("scrollIntoView"), "anchor links (#chairman) still land on their section");
  ok(!/<button[^>]*>\s*\{p\.name/.test(calcSrc) && !calcSrc.includes("rounded-full border px-4 py-2"), "public calculator product picker is a dropdown (no pill buttons)");
  ok((calcSrc.match(/<select/g) ?? []).length === 2, "both pickers (product + seat) are dropdowns on every variant");
  ok(calcSrc.includes("Select product") && calcSrc.includes("Your seat"), "dropdown labels present");

  /* ================= 7. YouTube trainings & blog videos (v18g) ================= */
  console.log("\nYouTube trainings & blog videos");
  const { youtubeEmbedUrl } = await import("./src/lib/youtube");
  ok(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ") === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "watch?v= link converts to embed");
  ok(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")?.endsWith("/dQw4w9WgXcQ") ?? false, "youtu.be short link converts");
  ok(youtubeEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.endsWith("/dQw4w9WgXcQ") ?? false, "shorts link converts");
  ok(youtubeEmbedUrl("dQw4w9WgXcQ")?.endsWith("/dQw4w9WgXcQ") ?? false, "bare video id converts");
  ok(youtubeEmbedUrl("https://example.com/not-youtube") === null && youtubeEmbedUrl("") === null, "non-YouTube and empty links render nothing");

  const schemaSrc = fs.readFileSync("db/schema.ts", "utf8");
  ok(schemaSrc.includes('videoUrl: text("video_url"), // YouTube training link'), "lessons table carries video_url");
  ok(schemaSrc.includes('videoUrl: text("video_url"), // supportive YouTube video'), "blog_posts table carries video_url");

  const ADMIN_TOKEN = await mint(ADMIN_EMAIL);
  const adminTrpc = (path: string, input?: unknown) => trpc(ADMIN_TOKEN, path, input);

  // --- lesson video: admin saves it, member sees it ---
  const [course] = await db.select().from(courses).limit(1);
  const [mod] = await db.select().from(modules).where(eq(modules.courseId, course.id)).limit(1);
  const saveLesson = await adminTrpc("admin.saveLesson", {
    moduleId: mod.id, code: "V18G.1", title: "V18g Video Lesson", minutes: 5,
    body: "Test body", videoUrl: "https://youtu.be/dQw4w9WgXcQ", sortOrder: 999,
  });
  ok(!saveLesson.error, `admin saves a lesson with a YouTube link (${saveLesson.error ?? "ok"})`);
  const [savedLesson] = await db.select().from(lessons).where(eq(lessons.code, "V18G.1"));
  ok(savedLesson?.videoUrl === "https://youtu.be/dQw4w9WgXcQ", "lesson video persisted");
  // admin (Charity, executive) reads the lesson through the member academy query
  const lessonView = await trpc(ADMIN_TOKEN, "academy.lesson", { id: savedLesson.id });
  ok(lessonView.data?.lesson?.videoUrl === "https://youtu.be/dQw4w9WgXcQ", "member lesson view returns the video link");
  await db.delete(lessons).where(eq(lessons.id, savedLesson.id));

  // --- blog video: admin saves it, public reads it ---
  const savePost = await adminTrpc("admin.savePost", {
    title: "V18g Video Post", slug: "v18g-video-post", body: "Body text",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", status: "published",
  });
  ok(!savePost.error, `admin saves a post with a supportive video (${savePost.error ?? "ok"})`);
  const post = await trpc("", "blog.get", { slug: "v18g-video-post" });
  ok(post.data?.videoUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "public post endpoint returns the video link");
  await db.delete(blogPosts).where(eq(blogPosts.slug, "v18g-video-post"));

  // --- frontend rendering wired ---
  const lessonViewSrc = fs.readFileSync("src/pages/app/LessonView.tsx", "utf8");
  ok(lessonViewSrc.includes("YouTubeEmbed") && lessonViewSrc.includes("lesson.videoUrl"), "lesson page embeds the training video");
  const blogPostSrc = fs.readFileSync("src/pages/BlogPost.tsx", "utf8");
  ok(blogPostSrc.includes("YouTubeEmbed") && blogPostSrc.includes("post.videoUrl"), "blog post page embeds the supportive video");
  const academySrc = fs.readFileSync("src/pages/admin/AdminAcademy.tsx", "utf8");
  ok(academySrc.includes("YouTube training link") && academySrc.includes("videoUrl"), "admin lesson editor takes a YouTube link");
  const adminBlogSrc = fs.readFileSync("src/pages/admin/AdminBlog.tsx", "utf8");
  ok(adminBlogSrc.includes("Supportive YouTube video") && adminBlogSrc.includes("videoUrl"), "admin blog editor takes a YouTube link");

  /* ================= 8. recruit commission lives on Membership Plans (v18h) ================= */
  console.log("\nrecruit commission placement");
  const compSrc = fs.readFileSync("src/components/admin/CommissionSettings.tsx", "utf8");
  ok(compSrc.includes("Registration commission") && compSrc.includes("saveCommissionSettings"), "commission editor is a shared component");
  ok(compSrc.includes("per recruit"), "shows per-plan ₦ per recruit preview");
  const plansSrc = fs.readFileSync("src/pages/admin/AdminPlans.tsx", "utf8");
  ok(plansSrc.includes("<CommissionSettings />"), "commission editor renders on the Membership Plans page");
  const settingsSrc = fs.readFileSync("src/pages/admin/AdminSettings.tsx", "utf8");
  ok(!settingsSrc.includes("CommissionSettings"), "no duplicate editor left in Settings");
  const cs = await adminTrpc("admin.commissionSettings");
  ok(typeof cs.data?.registrationPct === "number" && cs.data.registrationPct > 0, `live rate reads ${cs.data?.registrationPct}%`);

  /* ================= 9. uplines earn on renewals & upgrades (v18i) ================= */
  console.log("\nupline renewal & upgrade commissions");
  const REF_EMAIL = "v18i-upline@test.local";
  const DOWN_EMAIL = "v18i-downline@test.local";
  // clean prior runs
  for (const em of [REF_EMAIL, DOWN_EMAIL]) {
    const [u] = await db.select().from(users).where(eq(users.email, em));
    if (u) {
      const [m] = await db.select().from(members).where(eq(members.userId, u.id));
      if (m) {
        await db.delete(commissions).where(eq(commissions.memberId, m.id));
        await db.delete(payments).where(eq(payments.memberId, m.id));
        await db.delete(notifications).where(eq(notifications.userId, u.id));
        await db.delete(members).where(eq(members.id, m.id));
      }
      await db.delete(users).where(eq(users.id, u.id));
    }
  }
  const pw = await hashPassword("TestPass123!");
  const [ruIns] = await db.insert(users).values({ unionId: `email:${REF_EMAIL}`, email: REF_EMAIL, name: "V18i Upline", passwordHash: pw, role: "user" });
  const refUserId = Number((ruIns as any).insertId);
  const [rmIns] = await db.insert(members).values({
    userId: refUserId, firstName: "V18i", lastName: "Upline", email: REF_EMAIL, phone: "08000000021",
    category: "elite", status: "active", membershipCode: "CLB-V18IUP", referralCode: "V18IUP001",
  });
  const refMemberId = Number((rmIns as any).insertId);
  const [duIns] = await db.insert(users).values({ unionId: `email:${DOWN_EMAIL}`, email: DOWN_EMAIL, name: "V18i Down", passwordHash: pw, role: "user" });
  const downUserId = Number((duIns as any).insertId);
  const [dmIns] = await db.insert(members).values({
    userId: downUserId, firstName: "V18i", lastName: "Down", email: DOWN_EMAIL, phone: "08000000022",
    category: "pro", status: "active", membershipCode: "CLB-V18IDN", referralCode: "V18IDN001",
    referrerId: refMemberId, expiresAt: new Date(Date.now() - 86400000), // expired — renewal path
  });
  await db.execute((await import("drizzle-orm")).sql`UPDATE members SET status = 'expired' WHERE id = ${Number((dmIns as any).insertId)}`);
  const downMemberId = Number((dmIns as any).insertId);

  const [proPlan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, "pro"));
  const [elitePlan] = await db.select().from(membershipPlans).where(eq(membershipPlans.code, "elite"));
  const cs2 = await adminTrpc("admin.commissionSettings");
  const rate = cs2.data.registrationPct;

  // --- RENEWAL: downline renews Pro at 50% (same-plan renewal) ---
  const renewalAmount = Math.round(proPlan.fee * 0.5);
  const [payIns] = await db.insert(payments).values({
    memberId: downMemberId, type: "membership", amount: renewalAmount, planCode: "pro",
    note: "v18i renewal test", status: "pending",
  });
  const renewPayId = Number((payIns as any).insertId);
  const approveRenewal = await adminTrpc("admin.reviewPayment", { id: renewPayId, approve: true });
  ok(!approveRenewal.error, `renewal payment approved (${approveRenewal.error ?? "ok"})`);
  const [renewComm] = await db.select().from(commissions).where(eq(commissions.memberId, refMemberId));
  const expectedRenew = Math.round(renewalAmount * rate / 100);
  ok(!!renewComm && renewComm.amount === expectedRenew, `upline earned ₦${expectedRenew.toLocaleString()} renewal commission (${rate}% of ₦${renewalAmount.toLocaleString()} paid)`);
  ok(renewComm?.note?.startsWith("Renewal") ?? false, "renewal commission labelled 'Renewal'");
  ok(renewComm?.status === "approved", "renewal commission approved and withdrawable");

  // idempotency: approving the same payment row again must NOT double-pay
  const again = await adminTrpc("admin.reviewPayment", { id: renewPayId, approve: true });
  const renewRows = await db.select().from(commissions).where(eq(commissions.memberId, refMemberId));
  ok(renewRows.length === 1, `no double payment on re-review (${renewRows.length} row)`);

  // --- UPGRADE: downline (now active Pro) upgrades to Elite, pays the balance ---
  const upgradeAmount = elitePlan.fee - proPlan.fee;
  const [payIns2] = await db.insert(payments).values({
    memberId: downMemberId, type: "membership", amount: upgradeAmount, planCode: "elite",
    note: "v18i upgrade test", status: "pending",
  });
  const upPayId = Number((payIns2 as any).insertId);
  const approveUpgrade = await adminTrpc("admin.reviewPayment", { id: upPayId, approve: true });
  ok(!approveUpgrade.error, `upgrade payment approved (${approveUpgrade.error ?? "ok"})`);
  const allRows = await db.select().from(commissions).where(eq(commissions.memberId, refMemberId));
  const upComm = allRows.find((c) => c.note?.startsWith("Upgrade"));
  const expectedUp = Math.round(upgradeAmount * rate / 100);
  ok(!!upComm && upComm.amount === expectedUp, `upline earned ₦${expectedUp.toLocaleString()} upgrade commission (${rate}% of ₦${upgradeAmount.toLocaleString()} balance)`);
  ok(allRows.length === 2, "exactly two plan-payment commissions (renewal + upgrade)");

  // --- member + admin ledgers show the labels ---
  const refTok = await mint(REF_EMAIL);
  const earnings = await trpc(refTok, "member.earnings");
  ok(earnings.data?.rows?.some((c: any) => c.note?.startsWith("Renewal")) ?? false, "member earnings ledger carries the renewal label");
  const ledger = await adminTrpc("admin.commissionLedger");
  ok(ledger.data?.some((c: any) => c.note?.startsWith("Upgrade")) ?? false, "admin commission ledger carries the upgrade label");

  // engine wiring guards
  const engineSrc = fs.readFileSync("api/queries/engine.ts", "utf8");
  ok(engineSrc.includes('reason?: "registration" | "renewal" | "upgrade"'), "payReferralCommission supports renewal/upgrade reasons");
  const adminSrc = fs.readFileSync("api/routers/admin.ts", "utf8");
  ok(adminSrc.includes('reason: renewal ? "renewal" : "upgrade"'), "reviewPayment pays renewals and upgrades");
  ok(adminSrc.includes("amountOverride: p.amount"), "commission is on the amount actually paid");

  // cleanup
  await db.delete(commissions).where(eq(commissions.memberId, refMemberId));
  await db.delete(payments).where(eq(payments.memberId, downMemberId));
  await db.delete(notifications).where(eq(notifications.userId, refUserId));
  await db.delete(notifications).where(eq(notifications.userId, downUserId));
  await db.delete(voucherTransactions).where(eq(voucherTransactions.memberId, downMemberId));
  await db.delete(members).where(eq(members.id, downMemberId));
  await db.delete(members).where(eq(members.id, refMemberId));
  await db.delete(users).where(eq(users.id, downUserId));
  await db.delete(users).where(eq(users.id, refUserId));

  /* ================= summary ================= */
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("FAILED:", failures.join(" | "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
