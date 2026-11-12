import { getDb } from "../api/queries/connection";
import {
  membershipPlans,
  productCategories,
  products,
  pointRules,
  rewards,
  siteContent,
  courses,
  modules,
  lessons,
  exams,
  examQuestions,
} from "./schema";
import academySeed from "./academy-seed.json";
import { eq, inArray } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  Seed content — everything on the public site is editable from the  */
/*  admin CMS; these are the launch defaults.                          */
/* ------------------------------------------------------------------ */

const PLANS = [
  {
    code: "basic",
    name: "Basic",
    fee: 0,
    renewalDiscountPct: 0,
    voucherAmount: 0,
    sortOrder: 0,
    features: [
      "Core sales fundamentals",
      "Estate & product mastery",
      "First-closing playbook",
      "Weekly group coaching",
      "Direct commission on every sale",
      "Your personal referral link",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    fee: 100_000,
    renewalDiscountPct: 50,
    voucherAmount: 0,
    sortOrder: 1,
    features: [
      "All Starter training",
      "Digital domination lab",
      "Advanced closing studio",
      "Team-building bootcamp",
      "Chain commissions to level 5",
      "Recruiter-of-the-week race entry",
    ],
  },
  {
    code: "elite",
    name: "Elite",
    fee: 250_000,
    renewalDiscountPct: 50,
    voucherAmount: 250_000,
    sortOrder: 2,
    features: [
      "All Builder training",
      "Leadership intensives",
      "Recruitment systems",
      "Portfolio & mandate playbooks",
      "Chain commissions to level 10",
      "Equity points + ₦250k product voucher",
      "Rewards store access",
    ],
  },
  {
    code: "executive",
    name: "Executive",
    fee: 1_000_000,
    renewalDiscountPct: 50,
    voucherAmount: 1_000_000,
    sortOrder: 3,
    features: [
      "All Leader training",
      "Chairman's strategy sessions",
      "First access to new estates",
      "Exclusive Apex retreats",
      "Chain commissions to level 10",
      "Equity points + ₦1m product voucher",
      "Brand-leverage rights for your own products",
    ],
  },
];

const CATEGORIES = [
  {
    name: "Land",
    description:
      "Verified plots and estates — buy-to-own land with clean titles, flexible payment plans and fast allocation.",
    commissionPct: 10,
    icon: "land",
    sortOrder: 0,
  },
  {
    name: "House",
    description:
      "Finished and off-plan homes — terraces, duplexes and smart homes from our development partners.",
    commissionPct: 3,
    icon: "house",
    sortOrder: 1,
  },
];

const PRODUCTS: Array<{
  name: string;
  category: string;
  tag: string;
  price: number;
  priceLabel: string;
  location: string;
  titleStatus: string;
  imageTheme: string;
  description: string;
  sellingNotes: string;
  status: "live" | "draft" | "sold" | "coming_soon";
}> = [
  {
    name: "Pearl Estate",
    category: "Land",
    tag: "LAND · BUY TO OWN",
    price: 19_000_000,
    priceLabel: "₦19,000,000",
    location: "Pyakasa, Lugbe — Abuja",
    titleStatus: "Verified title",
    imageTheme: "dark",
    description:
      "The flagship. A fast-appreciating corridor estate off the Airport Road axis — the listing every member learns to sell first.",
    sellingNotes:
      "Open with the corridor story, not the price. Verify the title in front of the buyer. Payment plans available — match the plan to the buyer's salary date.",
    status: "live",
  },
  {
    name: "Gidan Hutu",
    category: "Land",
    tag: "LAND · BUY TO OWN",
    price: 3_500_000,
    priceLabel: "₦3,500,000",
    location: "Dhafara, Kuje — Abuja",
    titleStatus: "Verified title",
    imageTheme: "gold",
    description:
      "The entry plot — first-time buyers and salary earners start their land ownership story here.",
    sellingNotes:
      "The affordability play. Perfect for payment-engineering conversations — a 6 or 12 month plan turns 'I can't' into 'I just did'.",
    status: "live",
  },
  {
    name: "Hill City Estate",
    category: "Land",
    tag: "LAND · BUY TO OWN",
    price: 3_450_000,
    priceLabel: "₦3,450,000",
    location: "Kuje — Abuja",
    titleStatus: "Verified title",
    imageTheme: "gold",
    description:
      "A growing Kuje address — buy-to-own plots positioned on the expansion corridor.",
    sellingNotes:
      "Sell the trajectory: show what the corridor looked like three years ago versus today. Pair with Gidan Hutu for comparison visits.",
    status: "live",
  },
  {
    name: "Mosaic Royale",
    category: "Land",
    tag: "LAND · 400–500SQM",
    price: 9_500_000,
    priceLabel: "₦9.5m – ₦10.5m",
    location: "Pyakasa — Abuja",
    titleStatus: "Verified title",
    imageTheme: "gold",
    description:
      "Premium 400–500sqm plots from Mosaic Homes' own stable — the developer behind the club.",
    sellingNotes:
      "The developer-direct story is the pitch: same family as the club itself. Ideal for diaspora buyers who want maximum documentation comfort.",
    status: "live",
  },
  {
    name: "4-Bed Terrace",
    category: "House",
    tag: "HOUSE · 4 BEDROOM",
    price: 50_000_000,
    priceLabel: "₦50,000,000",
    location: "Lekki — Lagos",
    titleStatus: "Verified title",
    imageTheme: "green",
    description:
      "A finished 4-bedroom terrace in Lekki — the house listing for buyers ready to stop renting.",
    sellingNotes:
      "Rent-versus-own mathematics opens this conversation. Virtual tour first, physical inspection second. House sales pay 3% direct.",
    status: "live",
  },
  {
    name: "Smart Duplex",
    category: "House",
    tag: "HOUSE · SMART HOME",
    price: 85_000_000,
    priceLabel: "₦85,000,000",
    location: "Ajah — Lagos",
    titleStatus: "Verified title",
    imageTheme: "green",
    description:
      "A smart-enabled duplex on the Ajah corridor — premium finish, premium buyer.",
    sellingNotes:
      "The smart features are the hook; the title file is the close. Diaspora institutional buyers respond to the documentation pack.",
    status: "live",
  },
];

const POINT_RULES = [
  { key: "commission_per_1m", label: "Commission earned", value: "400", note: "Points per ₦1m of commission earned" },
  { key: "lesson", label: "Lesson completed", value: "25", note: "Per completed academy lesson" },
  { key: "exam", label: "Exam passed", value: "300", note: "Per course exam passed at 60%+" },
  { key: "recruit", label: "New recruit activated", value: "150", note: "When a member you referred is approved" },
  { key: "link_click", label: "Unique link visit", value: "1", note: "Per unique daily visitor on your referral link" },
  { key: "elite_multiplier", label: "Elite multiplier", value: "1.5", note: "Points multiplier applied at Elite level and above" },
];

const REWARDS = [
  { name: "Smartphone", description: "A workhorse smartphone — your sales floor, upgraded.", pointCost: 48_000 },
  { name: "Smart watch", description: "Notifications, calls and your daily numbers on your wrist.", pointCost: 16_500 },
  { name: "Shopping voucher", description: "A shopping voucher — points turned into a gift for someone you appreciate.", pointCost: 10_000 },
  { name: "Getaway weekend", description: "A weekend for two — rest earned, not borrowed.", pointCost: 85_000 },
];

/* ----------------------- CMS launch copy (from UI/UX v6) ----------------------- */

const CONTENT: Array<{ key: string; value: string; type?: string }> = [
  // ---- global ----
  { key: "global.tagline", value: "Learn · Get guided · Get paid" },
  { key: "global.footer.blurb", value: "The real estate sales hub where busy professionals learn, get guided daily, and earn through ten levels — powered by Mosaic Homes." },
  { key: "global.footer.copyright", value: "© 2026 CLUB 10 · A Mosaic Homes initiative" },

  // ---- home ----
  { key: "home.hero.kicker", value: "The Real Estate Sales Hub" },
  { key: "home.hero.headline", value: "Learn real estate. Get guided daily. Get paid — through ten levels." },
  { key: "home.hero.sub", value: "CLUB 10 is where busy professionals master real estate sales without quitting their job — real products to sell, an engine that pays automatically, a community where your effort earns points and rank." },
  { key: "home.hero.stat1", value: "4|Certified courses" },
  { key: "home.hero.stat2", value: "10|Earning levels" },
  { key: "home.hero.stat3", value: "24/7|Daily guidance" },
  { key: "home.hero.stat4", value: "100%|Auto payouts" },
  { key: "home.walls.kicker", value: "Why people stall" },
  { key: "home.walls.headline", value: "Three walls. One way through." },
  { key: "home.walls.1.title", value: "The time wall" },
  { key: "home.walls.1.body", value: "Week-long trainings lose the busy professional by day two. Our lessons are short, phone-first — study at lunch, implement in the evening." },
  { key: "home.walls.2.title", value: "The knowledge wall" },
  { key: "home.walls.2.body", value: "Enthusiasm without structure collapses. A certified training system takes you from first lesson to first closing, level by level." },
  { key: "home.walls.3.title", value: "The guidance wall" },
  { key: "home.walls.3.body", value: "\u201cWhat do I do today?\u201d kills momentum. The AI guide answers every morning — exact leads, exact posts, exact follow-ups." },
  { key: "home.how.kicker", value: "How it works" },
  { key: "home.how.headline", value: "From first login to first payment." },
  { key: "home.how.1.title", value: "Join the club" },
  { key: "home.how.1.body", value: "Pick your path — realtor, homeowner or partner. Onboarding takes minutes, not days." },
  { key: "home.how.2.title", value: "Pick your product" },
  { key: "home.how.2.body", value: "Choose from the live catalogue of estates and properties uploaded by our partners." },
  { key: "home.how.3.title", value: "Follow the guide" },
  { key: "home.how.3.body", value: "Daily, weekly and monthly AI playbooks for the exact product in your hands." },
  { key: "home.how.4.title", value: "Earn & rise" },
  { key: "home.how.4.body", value: "Commissions post automatically, equity points accumulate like shares, your rank rises." },
  { key: "home.products.kicker", value: "The Business · Products" },
  { key: "home.products.headline", value: "Real products. Right now." },
  { key: "home.academy.kicker", value: "The Academy" },
  { key: "home.academy.headline", value: "Taught, not just onboarded." },
  { key: "home.points.kicker", value: "Community & Points" },
  { key: "home.points.headline", value: "Points that behave like shares." },
  { key: "home.points.body", value: "For Elite members: every sale, lesson and team milestone credits equity points to your dashboard. They accumulate like shares, set your rank on the weekly leaderboard, and can be redeemed for gadgets and gifts in the Rewards Store. The highest level of the community is earned, never bought." },
  { key: "home.engine.headline", value: "One sale moves money through ten levels." },
  { key: "home.engine.body", value: "The Leverage engine pays direct commissions on land and houses, then flows through ten levels of your team — calculated and displayed automatically." },
  { key: "home.testimonials.kicker", value: "Testimonies" },
  { key: "home.testimonials.headline", value: "Members, in their own words." },
  { key: "home.testimonial.1.quote", value: "Club10 has good listings that enable me sell and earn good commissions. Commission is sweet and you should try it." },
  { key: "home.testimonial.1.name", value: "Becky Banks" },
  { key: "home.testimonial.1.role", value: "Club10 Realtor" },
  { key: "home.testimonial.2.quote", value: "I have a regular job, but I still create time to make money through real estate. I urge you — if you have a smartphone, join our club10 community." },
  { key: "home.testimonial.2.name", value: "Maureen Ekwealor" },
  { key: "home.testimonial.2.role", value: "Club10 Realtor" },
  { key: "home.testimonial.3.quote", value: "From day one until now, I still see lots of love. Thank you, Dr Moses, for the vision of club10. I am Austin Emmanuel, your club10 number one fan." },
  { key: "home.testimonial.3.name", value: "Austin Emmanuel" },
  { key: "home.testimonial.3.role", value: "Club10 Realtor" },
  { key: "home.cta.headline", value: "Your seat in the club is open." },
  { key: "home.cta.sub", value: "Join now, pick your product, and let the guide tell you exactly what to do every morning." },

  // ---- the brand ----
  { key: "brand.hero.kicker", value: "The Brand" },
  { key: "brand.hero.headline", value: "Built for the working class who refuse to stay stuck." },
  { key: "brand.hero.body", value: "CLUB 10 is the brokerage club of Mosaic Homes — the network where anyone, regardless of background, earns, learns and grows in real estate sales through education, technology and a powerful community." },
  { key: "brand.vision.title", value: "Our Vision" },
  { key: "brand.vision.body", value: "To be the leading real estate brokerage club that enables individuals to build wealth through real estate sales and partnerships — no matter their background or location." },
  { key: "brand.mission.title", value: "Our Mission" },
  { key: "brand.mission.body", value: "To provide a platform where anyone can earn, learn, and grow in real estate sales — through education, technology, and a powerful network of partners." },
  { key: "brand.values.kicker", value: "What we believe" },
  { key: "brand.values.headline", value: "Values that carry market weight." },
  { key: "brand.values.1.title", value: "Integrity" },
  { key: "brand.values.1.body", value: "Every listing verified, every transaction legally backed, every commission traceable. Trust is the product." },
  { key: "brand.values.2.title", value: "Innovation" },
  { key: "brand.values.2.body", value: "From virtual tours to AI-guided selling — we equip members with tools most brokerages only promise." },
  { key: "brand.values.3.title", value: "Quality" },
  { key: "brand.values.3.body", value: "Training, listings and support held to one standard: would a professional build their life on this?" },
  { key: "brand.leadership.kicker", value: "Leadership" },
  { key: "brand.leadership.headline", value: "The vision of Dr Moses." },
  { key: "brand.leadership.body", value: "What began as a chairman's teaching on property trade has grown into a movement of realtors who pay rent, subsidize bills and build wealth through commission. The Fireside Chat Conference — from solo deals to mega partnerships — is where the community gathers, learns and celebrates." },
  { key: "brand.partners.kicker", value: "Backed by" },
  { key: "brand.partners.headline", value: "A development house behind every listing." },

  // ---- the business ----
  { key: "business.hero.kicker", value: "The Business" },
  { key: "business.hero.headline", value: "Products to sell. An engine that pays. A community that rises." },
  { key: "business.hero.body", value: "Everything about earning at CLUB 10 lives on this one page — the catalogue of properties for sale, the commission engine, the points and rankings, and the rewards they unlock." },
  { key: "business.catalogue.kicker", value: "The Catalogue" },
  { key: "business.catalogue.headline", value: "Every property for sale, in one place." },
  { key: "business.engine.kicker", value: "The Engine" },
  { key: "business.engine.headline", value: "Pick a property. The math does itself." },
  { key: "business.engine.body", value: "The calculator reads the selected listing and applies the right rate automatically — 10% direct for land, 3% for houses — then splits the chain across all ten levels. The same engine runs live inside every member's dashboard." },
  { key: "business.engine.posting", value: "When the sale closes, direct commission credits the seller's dashboard instantly and each level's share posts to the right member automatically — itemised, transparent, no spreadsheets." },
  { key: "business.community.kicker", value: "The Community" },
  { key: "business.community.headline", value: "Equity points — they behave like shares." },
  { key: "business.community.body", value: "Reserved for Elite members — the highest membership category. Every sale, completed lesson and team milestone credits points to your dashboard automatically. They accumulate like shares, set your rank, and rise in value with your level." },
  { key: "business.ranked.headline", value: "Ranked, every week." },
  { key: "business.ranked.body", value: "Leaderboards reset weekly; season champions are crowned at every Fireside Chat. A push notification tells you when you move up — or when someone is about to overtake you. The leaderboard is open to every member — Basic, Pro and Elite; rankings reflect weekly performance." },
  { key: "business.race.headline", value: "One crown. Pro & Elite only." },
  { key: "business.race.body", value: "The member who brings in the most new registrations each week wears the crown — announced at the Fireside Chat, celebrated by the whole club. Basic and Pro members both see the race; only Pro & Elite can win it. That gap is the point: it turns the free tier's hunger into upgrades." },
  { key: "business.rewards.kicker", value: "The Rewards" },
  { key: "business.rewards.headline", value: "Points become gadgets & gifts." },
  { key: "business.rewards.1.title", value: "Earn" },
  { key: "business.rewards.1.body", value: "Sales, lessons and team growth credit points automatically." },
  { key: "business.rewards.2.title", value: "Accumulate" },
  { key: "business.rewards.2.body", value: "Your balance compounds like shares — higher levels multiply each action." },
  { key: "business.rewards.3.title", value: "Redeem" },
  { key: "business.rewards.3.body", value: "Pick from the catalogue. Points deduct instantly; confirmation within 24 hours." },
  { key: "business.rewards.4.title", value: "Receive" },
  { key: "business.rewards.4.body", value: "Gadgets and gifts delivered to you — or to someone you choose to appreciate." },
  { key: "business.cta.headline", value: "The engine is excellent. Become one of its drivers." },
  { key: "business.cta.sub", value: "Pick a product from the catalogue, follow the guide, and let the system do the arithmetic." },

  // ---- academy (public gate) ----
  { key: "academy.hero.kicker", value: "The Academy" },
  { key: "academy.hero.headline", value: "A training system that grows with your level." },
  { key: "academy.hero.body", value: "CLUB 10 members don't just get onboarded — they get trained. Short phone-first lessons, a practical tool in every lesson, real exams, and a depth of exposure that unlocks level by level. Browse the system here; the full syllabus opens when you register." },
  { key: "academy.levels.kicker", value: "Level-based training exposure" },
  { key: "academy.levels.headline", value: "Your level is your classroom." },
  { key: "academy.levels.body", value: "Every membership level unlocks its own depth of training. The higher you climb, the more of the system is exposed to you." },
  { key: "academy.example.kicker", value: "An example from inside" },
  { key: "academy.example.headline", value: "This is what a course feels like." },
  { key: "academy.example.body", value: "The full catalogue lives inside your member dashboard, matched to your level. Here's one example so you know the standard before you join — every course in the academy is built this same way." },
  { key: "academy.model.kicker", value: "The lesson model" },
  { key: "academy.model.headline", value: "Built for the busy professional." },
  { key: "academy.model.1.title", value: "Short & phone-first" },
  { key: "academy.model.1.body", value: "Lessons fit a lunch break — watch, read or listen from your phone." },
  { key: "academy.model.2.title", value: "A tool in every lesson" },
  { key: "academy.model.2.body", value: "Every lesson leaves you a script, checklist or template you can use the same day." },
  { key: "academy.model.3.title", value: "Exams that mean something" },
  { key: "academy.model.3.body", value: "20 scenario questions per course, learned into exactly what to do." },
  { key: "academy.model.4.title", value: "A daily next step" },
  { key: "academy.model.4.body", value: "The AI guide converts what you learned into exactly what to do next." },

  // ---- join ----
  { key: "join.hero.kicker", value: "Join Club 10" },
  { key: "join.hero.headline", value: "Pick your seat. The engine does the rest." },
  { key: "join.hero.body", value: "Four categories, one system. Start free and earn from your first sale, or step straight into the tiers where teams, points and vouchers multiply everything." },
  { key: "join.note.basic", value: "Free forever · earn from day one" },
  { key: "join.note.pro", value: "For members ready to build a team" },
  { key: "join.note.elite", value: "Points, vouchers and the rewards store" },
  { key: "join.note.executive", value: "The full machine — brand leverage included" },
];

/* ------------------------------------------------------------------ */

type SeedCourse = {
  code: string;
  category: string;
  title: string;
  tagline: string;
  sortOrder: number;
  modules: Array<{
    title: string;
    sortOrder: number;
    lessons: Array<{
      code: string;
      title: string;
      minutes: number;
      outcome: string;
      body: string;
      fieldTool: string;
      deepPoint: string;
      selfCheck: string;
      sortOrder: number;
    }>;
  }>;
  exam: {
    passMark: number;
    questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      sortOrder: number;
    }>;
  };
};

const CATEGORY_ORDER = ["basic", "pro", "elite", "executive"];

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  /* membership plans */
  for (const p of PLANS) {
    await db
      .insert(membershipPlans)
      .values(p)
      .onDuplicateKeyUpdate({
        set: { name: p.name, fee: p.fee, renewalDiscountPct: p.renewalDiscountPct, voucherAmount: p.voucherAmount, features: p.features, sortOrder: p.sortOrder },
      });
  }
  console.log(`plans: ${PLANS.length}`);

  /* product categories */
  const catIds: Record<string, number> = {};
  for (const c of CATEGORIES) {
    await db.insert(productCategories).values(c);
    const [row] = await db.select().from(productCategories).where(eq(productCategories.name, c.name));
    catIds[c.name] = row.id;
  }
  console.log(`categories: ${CATEGORIES.length}`);

  /* products (fresh insert — names are not unique-keyed) */
  const existingProducts = await db.select().from(products);
  if (existingProducts.length === 0) {
    await db.insert(products).values(
      PRODUCTS.map((p) => ({
        name: p.name,
        categoryId: catIds[p.category],
        tag: p.tag,
        description: p.description,
        price: p.price,
        priceLabel: p.priceLabel,
        location: p.location,
        titleStatus: p.titleStatus,
        sellingNotes: p.sellingNotes,
        imageTheme: p.imageTheme,
        status: p.status,
      }))
    );
  }
  console.log(`products: ${PRODUCTS.length}`);

  /* point rules */
  for (const r of POINT_RULES) {
    await db
      .insert(pointRules)
      .values(r)
      .onDuplicateKeyUpdate({ set: { label: r.label, value: r.value, note: r.note ?? null } });
  }
  console.log(`point rules: ${POINT_RULES.length}`);

  /* rewards */
  const existingRewards = await db.select().from(rewards);
  if (existingRewards.length === 0) {
    await db.insert(rewards).values(REWARDS);
  }
  console.log(`rewards: ${REWARDS.length}`);

  /* CMS content */
  for (const c of CONTENT) {
    await db
      .insert(siteContent)
      .values({ key: c.key, value: c.value, type: c.type ?? "text" })
      .onDuplicateKeyUpdate({ set: { value: c.value } });
  }
  console.log(`cms keys: ${CONTENT.length}`);

  /* academy — rebuild the catalogue tables idempotently */
  const seedCourses = (academySeed as { courses: SeedCourse[] }).courses;
  const existingCourses = await db.select().from(courses);
  const seeded = existingCourses.filter((c) => seedCourses.some((s) => s.code === c.code));
  if (seeded.length > 0) {
    const ids = seeded.map((c) => c.id);
    const ex = await db.select().from(exams).where(inArray(exams.courseId, ids));
    if (ex.length > 0) await db.delete(examQuestions).where(inArray(examQuestions.examId, ex.map((e) => e.id)));
    await db.delete(exams).where(inArray(exams.courseId, ids));
    const mods = await db.select().from(modules).where(inArray(modules.courseId, ids));
    if (mods.length > 0) await db.delete(lessons).where(inArray(lessons.moduleId, mods.map((m) => m.id)));
    await db.delete(modules).where(inArray(modules.courseId, ids));
    await db.delete(courses).where(inArray(courses.id, ids));
    console.log(`cleared ${seeded.length} existing courses for reseed`);
  }

  let lessonCount = 0;
  let questionCount = 0;
  for (const sc of seedCourses) {
    const desc = [sc.tagline, "", ...sc.modules.flatMap((m) => m.lessons.slice(0, 0))].join("\n").trim();
    const [courseRow] = await db.insert(courses).values({
      code: sc.code,
      title: sc.title,
      category: sc.category,
      tagline: sc.tagline || null,
      description: desc || null,
      sortOrder: sc.sortOrder,
    }).$returningId();
    const courseId = courseRow.id;
    for (const m of sc.modules) {
      const [modRow] = await db.insert(modules).values({ courseId, title: m.title, sortOrder: m.sortOrder }).$returningId();
      for (const l of m.lessons) {
        await db.insert(lessons).values({
          moduleId: modRow.id,
          code: l.code,
          title: l.title,
          minutes: l.minutes,
          outcome: l.outcome,
          body: l.body,
          fieldTool: l.fieldTool,
          deepPoint: l.deepPoint,
          selfCheck: l.selfCheck,
          sortOrder: l.sortOrder,
        });
        lessonCount++;
      }
    }
    const [examRow] = await db.insert(exams).values({ courseId, passMark: sc.exam.passMark }).$returningId();
    for (const q of sc.exam.questions) {
      await db.insert(examQuestions).values({
        examId: examRow.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        sortOrder: q.sortOrder,
      });
      questionCount++;
    }
  }
  console.log(`academy: ${seedCourses.length} courses, ${lessonCount} lessons, ${questionCount} exam questions`);

  console.log("Done.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
