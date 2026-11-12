import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  bigint,
  boolean,
  timestamp,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/* ---------------------------------- auth ---------------------------------- */

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** RBAC tier for admins: "central" (full control, can create/remove admins)
   *  or "manager" (day-to-day admin work, cannot manage admin accounts). */
  adminRole: varchar("admin_role", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* -------------------------------- members --------------------------------- */

export const memberCategory = varchar("category", { length: 20 });

export const members = mysqlTable(
  "members",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .unique()
      .references(() => users.id),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    address: varchar("address", { length: 255 }),
    city: varchar("city", { length: 120 }),
    state: varchar("state", { length: 120 }),
    country: varchar("country", { length: 120 }),
    // payout bank account — set once in Profile, reused for every withdrawal
    bankName: varchar("bank_name", { length: 120 }),
    accountNumber: varchar("account_number", { length: 20 }),
    accountName: varchar("account_name", { length: 160 }),
    category: memberCategory.notNull().default("basic"),
    membershipCode: varchar("membership_code", { length: 20 }).notNull().unique(),
    referralCode: varchar("referral_code", { length: 60 }).notNull().unique(),
    referrerId: bigint("referrer_id", { mode: "number", unsigned: true }),
    status: mysqlEnum("status", [
      "pending",
      "active",
      "suspended",
      "expired",
    ])
      .default("pending")
      .notNull(),
    notificationSetupDone: boolean("notification_setup_done")
      .default(false)
      .notNull(),
    onboardedAt: timestamp("onboarded_at"),
    expiresAt: timestamp("expires_at"),
    pointsBalance: int("points_balance").default(0).notNull(),
    voucherBalance: int("voucher_balance").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_members_referrer").on(t.referrerId), index("idx_members_status").on(t.status)]
);

export type Member = typeof members.$inferSelect;

export const membershipPlans = mysqlTable("membership_plans", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // basic|pro|elite|executive|custom
  name: varchar("name", { length: 60 }).notNull(),
  fee: int("fee").notNull(), // NGN, yearly
  renewalDiscountPct: int("renewal_discount_pct").default(50).notNull(),
  voucherAmount: int("voucher_amount").default(0).notNull(),
  chainDepth: int("chain_depth").default(0).notNull(), // how many upline levels this plan earns from
  pointsEligible: boolean("points_eligible").default(false).notNull(),
  pointsMultiplier: varchar("points_multiplier", { length: 10 }).default("1").notNull(),
  features: json("features").$type<string[]>().notNull(),
  sortOrder: int("sort_order").default(0).notNull(), // also the plan rank (higher = more senior)
  isActive: boolean("is_active").default(true).notNull(),
});

/* -------------------------------- products -------------------------------- */

export const productCategories = mysqlTable("product_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description"),
  commissionPct: int("commission_pct").notNull(), // direct rate, e.g. 10 or 3
  icon: varchar("icon", { length: 60 }),
  sortOrder: int("sort_order").default(0).notNull(),
});

/** Admin-managed country → state directory for product locations & filters */
export const productCountries = mysqlTable("product_countries", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  sortOrder: int("sort_order").default(0).notNull(),
});

export const productStates = mysqlTable("product_states", {
  id: serial("id").primaryKey(),
  countryId: bigint("country_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => productCountries.id),
  name: varchar("name", { length: 80 }).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
});

/** AI marketing assistant — saved generations per member */
export const aiMarketingAssets = mysqlTable(
  "ai_marketing_assets",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    tool: varchar("tool", { length: 30 }).notNull(), // listing | script | followup | guide
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    meta: text("meta"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_ai_assets_member").on(t.memberId)]
);

export const aiPlans = mysqlTable(
  "ai_plans",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    productId: bigint("product_id", { mode: "number", unsigned: true }),
    title: varchar("title", { length: 200 }).notNull(),
    goal: varchar("goal", { length: 300 }),
    status: mysqlEnum("status", ["active", "completed"]).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_ai_plans_member").on(t.memberId)]
);

export const aiPlanDays = mysqlTable(
  "ai_plan_days",
  {
    id: serial("id").primaryKey(),
    planId: bigint("plan_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => aiPlans.id),
    day: int("day").notNull(), // 1..30
    title: varchar("title", { length: 200 }).notNull(),
    tasks: json("tasks").$type<string[]>().notNull(),
    guide: text("guide"), // cached AI guide for the day (generated on demand)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_ai_plan_days_plan").on(t.planId)]
);

/** One row per completed task — the member's feedback report on how it went. */
export const aiTaskReports = mysqlTable(
  "ai_task_reports",
  {
    id: serial("id").primaryKey(),
    planId: bigint("plan_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => aiPlans.id),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    day: int("day").notNull(),
    taskIndex: int("task_index").notNull(), // index into ai_plan_days.tasks
    feedback: text("feedback").notNull(), // how it went — required
    contacted: int("contacted"), // people reached out to (optional data)
    responses: int("responses"), // replies received (optional data)
    viewings: int("viewings"), // inspections/viewings booked (optional data)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_ai_reports_plan").on(t.planId), index("idx_ai_reports_member").on(t.memberId)]
);

export const products = mysqlTable(
  "products",
  {
    id: serial("id").primaryKey(),
    categoryId: bigint("category_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => productCategories.id),
    name: varchar("name", { length: 160 }).notNull(),
    tag: varchar("tag", { length: 80 }), // e.g. "LAND · BUY TO OWN"
    description: text("description"),
    price: int("price").notNull(),
    priceLabel: varchar("price_label", { length: 60 }), // e.g. "₦9.5m – ₦10.5m"
    location: varchar("location", { length: 160 }),
    country: varchar("country", { length: 80 }).default("Nigeria").notNull(),
    state: varchar("state", { length: 80 }),
    titleStatus: varchar("title_status", { length: 80 }),
    commissionPct: int("commission_pct"), // override; null = use category
    sellingNotes: text("selling_notes"),
    highlights: text("highlights"), // one per line — key selling points
    features: text("features"), // one per line — infrastructure/features
    paymentPlan: text("payment_plan"), // flexible terms text
    imageTheme: varchar("image_theme", { length: 30 }).default("gold"), // gold|dark|green
    imageUrl: text("image_url"),
    status: mysqlEnum("status", ["live", "draft", "sold", "coming_soon"])
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_products_status").on(t.status)]
);

export type Product = typeof products.$inferSelect;

/* ------------------------------ sales & money ----------------------------- */

export const sales = mysqlTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    productId: bigint("product_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => products.id),
    sellerId: bigint("seller_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    buyerName: varchar("buyer_name", { length: 160 }),
    salePrice: int("sale_price").notNull(),
    receiptNote: text("receipt_note"),
    // v13 - compulsory sale-report evidence for finance confirmation
    paymentDate: varchar("payment_date", { length: 10 }), // YYYY-MM-DD
    senderName: varchar("sender_name", { length: 160 }), // name of the person who sent the payment
    description: text("description"),
    receiptUrl: text("receipt_url"), // uploaded payment receipt image
    status: mysqlEnum("status", ["pending", "approved", "rejected", "revoked"])
      .default("pending")
      .notNull(),
    reviewedBy: bigint("reviewed_by", { mode: "number", unsigned: true }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_sales_seller").on(t.sellerId), index("idx_sales_status").on(t.status)]
);

export type Sale = typeof sales.$inferSelect;

export const commissions = mysqlTable(
  "commissions",
  {
    id: serial("id").primaryKey(),
    saleId: bigint("sale_id", { mode: "number", unsigned: true })
      .references(() => sales.id), // null = registration commission
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    level: int("level").notNull(), // -1 = plan payment (registration/renewal/upgrade), 0 = direct, 1..10 chain
    amount: int("amount").notNull(),
    note: text("note"), // labels plan-payment commissions: registration vs renewal vs upgrade
    status: mysqlEnum("status", ["pending", "approved", "paid", "rejected"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_comm_member").on(t.memberId), index("idx_comm_sale").on(t.saleId)]
);

export type Commission = typeof commissions.$inferSelect;

export const withdrawals = mysqlTable("withdrawals", {
  id: serial("id").primaryKey(),
  memberId: bigint("member_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => members.id),
  commissionId: bigint("commission_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => commissions.id),
  amount: int("amount").notNull(),
  bankDetails: text("bank_details"),
  status: mysqlEnum("status", ["pending", "processing", "paid", "rejected"])
    .default("pending")
    .notNull(),
  reference: varchar("reference", { length: 80 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

/* --------------------------------- points --------------------------------- */

export const pointRules = mysqlTable("point_rules", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 60 }).notNull().unique(), // commission_per_1m | lesson | exam | recruit | link_click | elite_multiplier
  label: varchar("label", { length: 120 }).notNull(),
  value: varchar("value", { length: 40 }).notNull(),
  note: varchar("note", { length: 200 }),
});

export const pointsLedger = mysqlTable(
  "points_ledger",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    action: varchar("action", { length: 60 }).notNull(),
    points: int("points").notNull(),
    meta: varchar("meta", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_points_member").on(t.memberId)]
);

export const rewards = mysqlTable("rewards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"), // full image of the reward — shown in the store and admin editor
  pointCost: int("point_cost").notNull(),
  // v14 — optional naira price so members can pay for this gift with their
  // property voucher instead of points (unlocked after their first sale).
  voucherCost: int("voucher_cost"),
  stock: int("stock").default(-1).notNull(), // -1 = unlimited
  status: mysqlEnum("status", ["live", "paused"]).default("live").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const redemptions = mysqlTable("redemptions", {
  id: serial("id").primaryKey(),
  memberId: bigint("member_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => members.id),
  rewardId: bigint("reward_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => rewards.id),
  pointsSpent: int("points_spent").notNull(),
  voucherSpent: int("voucher_spent").default(0).notNull(), // v14 — naira paid via property voucher
  status: mysqlEnum("status", ["pending", "processing", "fulfilled", "declined"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------- link tracking ----------------------------- */

export const linkVisits = mysqlTable(
  "link_visits",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    visitorKey: varchar("visitor_key", { length: 80 }).notNull(), // hashed ip+ua
    referrerUrl: varchar("referrer_url", { length: 500 }),
    deviceType: varchar("device_type", { length: 20 }),
    isUniqueToday: boolean("is_unique_today").default(false).notNull(),
    converted: boolean("converted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_visits_member").on(t.memberId)]
);

/* ------------------------------- notifications ----------------------------- */

export const notifications = mysqlTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 40 }).notNull(), // commission|withdrawal|team|points|course|system|admin_task
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message"),
    actionUrl: varchar("action_url", { length: 300 }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_notif_user").on(t.userId)]
);

export const notificationPrefs = mysqlTable("notification_prefs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true })
    .notNull()
    .unique()
    .references(() => users.id),
  emailCommissions: boolean("email_commissions").default(true).notNull(),
  emailWithdrawals: boolean("email_withdrawals").default(true).notNull(),
  emailTeam: boolean("email_team").default(true).notNull(),
  emailPoints: boolean("email_points").default(true).notNull(),
  emailCourses: boolean("email_courses").default(true).notNull(),
  emailSystem: boolean("email_system").default(true).notNull(),
  emailLeaderboard: boolean("email_leaderboard").default(true).notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  whatsappEnabled: boolean("whatsapp_enabled").default(false).notNull(),
  agreedToTerms: boolean("agreed_to_terms").default(false).notNull(),
});

/* --------------------------------- academy -------------------------------- */

export const courses = mysqlTable("courses", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(), // B1, P1..P3, E1..E3, X1..X4
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 20 }).notNull(), // basic|pro|elite|executive
  tagline: text("tagline"),
  description: text("description"), // full approved description page
  promise: text("promise"),
  audience: text("audience"),
  prerequisites: text("prerequisites"),
  outcomes: json("outcomes").$type<string[]>(),
  sortOrder: int("sort_order").notNull(),
});

export type Course = typeof courses.$inferSelect;

export const modules = mysqlTable("modules", {
  id: serial("id").primaryKey(),
  courseId: bigint("course_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => courses.id),
  title: varchar("title", { length: 200 }).notNull(),
  sortOrder: int("sort_order").notNull(),
});

export const lessons = mysqlTable(
  "lessons",
  {
    id: serial("id").primaryKey(),
    moduleId: bigint("module_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => modules.id),
    code: varchar("code", { length: 20 }).notNull(), // e.g. B1.1
    title: varchar("title", { length: 250 }).notNull(),
    minutes: int("minutes").default(8).notNull(),
    outcome: text("outcome"),
    body: text("body"), // full teaching text
    videoUrl: text("video_url"), // YouTube training link (watch/share/shorts/youtu.be)
    fieldTool: text("field_tool"),
    deepPoint: text("deep_point"),
    selfCheck: text("self_check"),
    sortOrder: int("sort_order").notNull(),
  },
  (t) => [index("idx_lessons_module").on(t.moduleId)]
);

export type Lesson = typeof lessons.$inferSelect;

export const exams = mysqlTable("exams", {
  id: serial("id").primaryKey(),
  courseId: bigint("course_id", { mode: "number", unsigned: true })
    .notNull()
    .unique()
    .references(() => courses.id),
  passMark: int("pass_mark").default(60).notNull(),
});

export const examQuestions = mysqlTable(
  "exam_questions",
  {
    id: serial("id").primaryKey(),
    examId: bigint("exam_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => exams.id),
    question: text("question").notNull(),
    options: json("options").$type<string[]>().notNull(),
    correctIndex: int("correct_index").notNull(),
    explanation: text("explanation"),
    sortOrder: int("sort_order").notNull(),
  },
  (t) => [index("idx_questions_exam").on(t.examId)]
);

export const lessonProgress = mysqlTable(
  "lesson_progress",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    lessonId: bigint("lesson_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => lessons.id),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_progress").on(t.memberId, t.lessonId)]
);

export const examAttempts = mysqlTable("exam_attempts", {
  id: serial("id").primaryKey(),
  examId: bigint("exam_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => exams.id),
  memberId: bigint("member_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => members.id),
  score: int("score").notNull(),
  passed: boolean("passed").notNull(),
  answers: json("answers").$type<number[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificates = mysqlTable("certificates", {
  id: serial("id").primaryKey(),
  memberId: bigint("member_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => members.id),
  scope: varchar("scope", { length: 20 }).notNull(), // course code or category
  title: varchar("title", { length: 200 }).notNull(),
  verificationCode: varchar("verification_code", { length: 30 }).notNull().unique(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  revoked: boolean("revoked").default(false).notNull(),
});

/* --------------------------------- payments -------------------------------- */

export const payments = mysqlTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    type: mysqlEnum("type", ["membership", "property", "commission_claim"])
      .notNull(),
    planCode: varchar("plan_code", { length: 20 }), // for membership payments
    amount: int("amount").notNull(),
    note: text("note"),
    status: mysqlEnum("status", ["pending", "approved", "rejected", "revoked"])
      .default("pending")
      .notNull(),
    reviewedBy: bigint("reviewed_by", { mode: "number", unsigned: true }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_payments_member").on(t.memberId), index("idx_payments_status").on(t.status)]
);

export type Payment = typeof payments.$inferSelect;

/* ----------------------------------- blog ---------------------------------- */

export const blogPosts = mysqlTable(
  "blog_posts",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    title: varchar("title", { length: 220 }).notNull(),
    excerpt: text("excerpt"),
    body: text("body"),
    coverTheme: varchar("cover_theme", { length: 30 }).default("gold"), // gold|dark|green
    coverImage: text("cover_image"), // uploaded cover photo URL (optional)
    videoUrl: text("video_url"), // supportive YouTube video embedded after the article body (optional)
    status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("idx_blog_status").on(t.status)]
);

export type BlogPost = typeof blogPosts.$inferSelect;

/* ----------------------------------- CMS ----------------------------------- */

export const siteContent = mysqlTable(
  "site_content",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 120 }).notNull().unique(), // e.g. home.hero.headline
    value: text("value"),
    type: varchar("type", { length: 20 }).default("text").notNull(), // text|textarea|image|json
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

export const settings = mysqlTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 80 }).notNull().unique(),
  value: text("value"),
});

export const activityLogs = mysqlTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }),
  action: varchar("action", { length: 120 }).notNull(),
  module: varchar("module", { length: 60 }),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* --------------------------- starter kit resources ------------------------ */

export const starterKitResources = mysqlTable(
  "starter_kit_resources",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    kind: varchar("kind", { length: 20 }).notNull(), // file | link
    url: text("url").notNull(), // /uploads/... path or external https:// link
    sortOrder: int("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    // comma-separated plan codes this resource is restricted to; NULL = every member
    plans: varchar("plans", { length: 200 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

/* ------------------------------ voucher ledger ---------------------------- */

export const voucherTransactions = mysqlTable(
  "voucher_transactions",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("member_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => members.id),
    productId: bigint("product_id", { mode: "number", unsigned: true }),
    amount: int("amount").notNull(), // positive = credit, negative = spend
    balanceAfter: int("balance_after").notNull(),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_voucher_tx_member").on(t.memberId)],
);

/* ------------------------- device push subscriptions ------------------------- */

export const pushSubscriptions = mysqlTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    endpoint: text("endpoint").notNull(),
    // JSON { p256dh, auth } from the browser subscription
    keys: text("keys").notNull(),
    userAgent: varchar("user_agent", { length: 300 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_push_user").on(t.userId)]
);
