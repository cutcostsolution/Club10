import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  courses,
  modules,
  lessons,
  exams,
  examQuestions,
  lessonProgress,
  examAttempts,
  certificates,
  members,
  membershipPlans,
} from "../../db/schema";
import { eq, asc, desc, and, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { creditPoints, getPointRule, notify } from "../queries/engine";
import crypto from "crypto";

const LEGACY_ORDER = ["basic", "pro", "elite", "executive"];

async function myMember(userId: number) {
  const db = getDb();
  const [m] = await db.select().from(members).where(eq(members.userId, userId));
  return m ?? null;
}

/** A member's plan covers a course if the plan's rank (sortOrder) >= the course
 *  category's plan rank. Plan-driven so new plans/categories work automatically. */
type PlanRow = { code: string; sortOrder: number };

function planRank(plans: PlanRow[], code: string): number {
  const p = plans.find((x) => x.code === code);
  if (p) return p.sortOrder;
  return LEGACY_ORDER.indexOf(code);
}

function coversWithPlans(plans: PlanRow[], memberCat: string, courseCat: string): boolean {
  return planRank(plans, memberCat) >= planRank(plans, courseCat);
}

async function categoryCovers(memberCat: string, courseCat: string): Promise<boolean> {
  const db = getDb();
  const plans = await db.select().from(membershipPlans);
  return coversWithPlans(plans, memberCat, courseCat);
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const academyRouter = createRouter({
  /** Public: the learning system overview + one example course */
  publicOverview: publicQuery.query(async () => {
    const db = getDb();
    const allCourses = await db.select().from(courses).orderBy(asc(courses.sortOrder));
    const exampleCode = "B1";
    const example = allCourses.find((c) => c.code === exampleCode) ?? allCourses[0] ?? null;
    let exampleLesson = null;
    if (example) {
      const mods = await db.select().from(modules).where(eq(modules.courseId, example.id)).orderBy(asc(modules.sortOrder));
      if (mods[0]) {
        const [l] = await db
          .select()
          .from(lessons)
          .where(eq(lessons.moduleId, mods[0].id))
          .orderBy(asc(lessons.sortOrder))
          .limit(1);
        exampleLesson = l ?? null;
      }
    }
    const lessonCounts = await db
      .select({ courseId: modules.courseId, n: sql<number>`COUNT(${lessons.id})` })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .groupBy(modules.courseId);
    const countBy = new Map(lessonCounts.map((r) => [r.courseId, Number(r.n)]));
    return {
      courses: allCourses.map((c) => ({
        id: c.id, code: c.code, title: c.title, category: c.category, tagline: c.tagline,
        lessonCount: countBy.get(c.id) ?? 0,
      })),
      counts: { courses: allCourses.length },
      example,
      exampleLesson,
    };
  }),

  /** Member: courses visible for their category, with progress + unlock state.
   *  Batched: 7 queries total (was 3+ per course) — the training dashboard
   *  must open fast even with many courses. */
  myCourses: authedQuery.query(async ({ ctx }) => {
    const m = await myMember(ctx.user.id);
    if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = getDb();
    const [allCourses, allMods, allLessons, allExams, passedAttempts, doneLessons, plans] = await Promise.all([
      db.select().from(courses).orderBy(asc(courses.sortOrder)),
      db.select().from(modules),
      db.select().from(lessons),
      db.select().from(exams),
      db.select().from(examAttempts).where(and(eq(examAttempts.memberId, m.id), eq(examAttempts.passed, true))),
      db.select().from(lessonProgress).where(eq(lessonProgress.memberId, m.id)),
      db.select().from(membershipPlans),
    ]);

    const examCourse = new Map(allExams.map((e) => [e.id, e.courseId]));
    const passedCourses = new Set(
      passedAttempts.map((a) => examCourse.get(a.examId)).filter((x): x is number => x != null)
    );
    const doneSet = new Set(doneLessons.map((d) => d.lessonId));
    const modsByCourse = new Map<number, number[]>();
    for (const mod of allMods) {
      const arr = modsByCourse.get(mod.courseId) ?? [];
      arr.push(mod.id);
      modsByCourse.set(mod.courseId, arr);
    }
    const lessonModule = new Map(allLessons.map((l) => [l.id, l.moduleId]));
    const lessonsByCourse = new Map<number, number[]>();
    for (const [courseId, modIds] of modsByCourse) {
      lessonsByCourse.set(courseId, allLessons.filter((l) => modIds.includes(l.moduleId)).map((l) => l.id));
    }
    void lessonModule;

    const result = [];
    for (const c of allCourses) {
      const accessible = coversWithPlans(plans, m.category, c.category);
      // sequential unlock within category: course unlocked if previous course in same category passed
      const sameCat = allCourses.filter((x) => x.category === c.category);
      const idx = sameCat.findIndex((x) => x.id === c.id);
      const prev = idx > 0 ? sameCat[idx - 1] : null;
      const unlocked = idx === 0 || (prev ? passedCourses.has(prev.id) : true);
      const courseLessonIds = lessonsByCourse.get(c.id) ?? [];
      const doneCount = courseLessonIds.filter((id) => doneSet.has(id)).length;
      result.push({
        ...c,
        accessible,
        unlocked,
        passed: passedCourses.has(c.id),
        lessonCount: courseLessonIds.length,
        doneCount,
      });
    }
    return { member: m, courses: result };
  }),

  courseDetail: authedQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = getDb();
      const [c] = await db.select().from(courses).where(eq(courses.code, input.code));
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (!(await categoryCovers(m.category, c.category)))
        throw new TRPCError({ code: "FORBIDDEN", message: `Requires ${c.category} membership` });
      const mods = await db.select().from(modules).where(eq(modules.courseId, c.id)).orderBy(asc(modules.sortOrder));
      const modIds = mods.map((mm) => mm.id);
      const [allLs, doneRows] = await Promise.all([
        modIds.length ? db.select().from(lessons).where(inArray(lessons.moduleId, modIds)).orderBy(asc(lessons.sortOrder)) : [],
        db.select().from(lessonProgress).where(eq(lessonProgress.memberId, m.id)),
      ]);
      const done = new Set(doneRows.map((d) => d.lessonId));
      const withLessons = mods.map((mod) => ({
        ...mod,
        lessons: allLs
          .filter((l) => l.moduleId === mod.id)
          .map((l) => ({ ...l, body: undefined, completed: done.has(l.id) })),
      }));
      const [exam] = await db.select().from(exams).where(eq(exams.courseId, c.id));
      const attempts = exam
        ? await db.select().from(examAttempts).where(and(eq(examAttempts.examId, exam.id), eq(examAttempts.memberId, m.id))).orderBy(desc(examAttempts.createdAt))
        : [];
      return { course: c, modules: withLessons, exam: exam ?? null, attempts };
    }),

  lesson: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = getDb();
      const [l] = await db.select().from(lessons).where(eq(lessons.id, input.id));
      if (!l) throw new TRPCError({ code: "NOT_FOUND" });
      const [mod] = await db.select().from(modules).where(eq(modules.id, l.moduleId));
      const [c] = await db.select().from(courses).where(eq(courses.id, mod!.courseId));
      if (!(await categoryCovers(m.category, c.category)))
        throw new TRPCError({ code: "FORBIDDEN" });
      const [prog] = await db
        .select()
        .from(lessonProgress)
        .where(and(eq(lessonProgress.memberId, m.id), eq(lessonProgress.lessonId, l.id)));
      // next lesson
      const allInCourse = await db
        .select({ id: lessons.id, sortOrder: lessons.sortOrder, moduleId: lessons.moduleId })
        .from(lessons)
        .innerJoin(modules, eq(lessons.moduleId, modules.id))
        .where(eq(modules.courseId, c.id))
        .orderBy(asc(modules.sortOrder), asc(lessons.sortOrder));
      const idx = allInCourse.findIndex((x) => x.id === l.id);
      return { lesson: l, course: c, module: mod, completed: !!prog, nextId: allInCourse[idx + 1]?.id ?? null, prevId: allInCourse[idx - 1]?.id ?? null };
    }),

  completeLesson: authedQuery
    .input(z.object({ lessonId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = getDb();
      const [l] = await db.select().from(lessons).where(eq(lessons.id, input.lessonId));
      if (!l) throw new TRPCError({ code: "NOT_FOUND" });
      const [existing] = await db
        .select()
        .from(lessonProgress)
        .where(and(eq(lessonProgress.memberId, m.id), eq(lessonProgress.lessonId, l.id)));
      if (!existing) {
        await db.insert(lessonProgress).values({ memberId: m.id, lessonId: l.id });
        const pts = parseInt(await getPointRule("lesson", "25"));
        await creditPoints(m.id, "lesson", pts, l.code);
      }
      return { ok: true };
    }),

  /** Get exam questions (shuffled, answers stripped). Locked until all lessons done. */
  getExam: authedQuery
    .input(z.object({ courseCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = getDb();
      const [c] = await db.select().from(courses).where(eq(courses.code, input.courseCode));
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (!(await categoryCovers(m.category, c.category))) throw new TRPCError({ code: "FORBIDDEN" });
      const [exam] = await db.select().from(exams).where(eq(exams.courseId, c.id));
      if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "No exam for this course" });
      // all lessons must be completed
      const mods = await db.select().from(modules).where(eq(modules.courseId, c.id));
      const ls = mods.length ? await db.select().from(lessons).where(inArray(lessons.moduleId, mods.map((x) => x.id))) : [];
      const done = new Set(
        (await db.select().from(lessonProgress).where(eq(lessonProgress.memberId, m.id))).map((d) => d.lessonId)
      );
      const incomplete = ls.filter((l) => !done.has(l.id));
      if (incomplete.length > 0)
        throw new TRPCError({ code: "FORBIDDEN", message: `${incomplete.length} lesson(s) still to complete` });
      const qs = await db.select().from(examQuestions).where(eq(examQuestions.examId, exam.id)).orderBy(asc(examQuestions.sortOrder));
      const seed = Date.now() % 100000;
      const shuffled = shuffle(qs, seed).map((q) => ({
        id: q.id,
        question: q.question,
        options: shuffle(q.options, seed + q.id),
      }));
      return { exam: { id: exam.id, passMark: exam.passMark, courseTitle: c.title }, questions: shuffled };
    }),

  submitExam: authedQuery
    .input(z.object({ courseCode: z.string(), answers: z.array(z.object({ questionId: z.number(), option: z.string() })) }))
    .mutation(async ({ ctx, input }) => {
      const m = await myMember(ctx.user.id);
      if (!m) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = getDb();
      const [c] = await db.select().from(courses).where(eq(courses.code, input.courseCode));
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      const [exam] = await db.select().from(exams).where(eq(exams.courseId, c.id));
      if (!exam) throw new TRPCError({ code: "NOT_FOUND" });
      const qs = await db.select().from(examQuestions).where(eq(examQuestions.examId, exam.id));
      const qMap = new Map(qs.map((q) => [q.id, q]));
      let correct = 0;
      for (const a of input.answers) {
        const q = qMap.get(a.questionId);
        if (q && q.options[q.correctIndex] === a.option) correct++;
      }
      const score = qs.length ? Math.round((correct / qs.length) * 100) : 0;
      const passed = score >= exam.passMark;
      await db.insert(examAttempts).values({
        examId: exam.id,
        memberId: m.id,
        score,
        passed,
        answers: input.answers.map((a) => a.questionId),
      });
      if (passed) {
        const pts = parseInt(await getPointRule("exam", "300"));
        await creditPoints(m.id, "exam", pts, c.code);
        // course certificate
        await db.insert(certificates).values({
          memberId: m.id,
          scope: c.code,
          title: `${c.code} — ${c.title}`,
          verificationCode: "C10-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
        });
        // category certificate if all courses in this category passed
        const catCourses = await db.select().from(courses).where(eq(courses.category, c.category));
        const allPassed = await Promise.all(
          catCourses.map(async (cc) => {
            const [e] = await db.select().from(exams).where(eq(exams.courseId, cc.id));
            if (!e) return false;
            const [p] = await db
              .select()
              .from(examAttempts)
              .where(and(eq(examAttempts.examId, e.id), eq(examAttempts.memberId, m.id), eq(examAttempts.passed, true)));
            return !!p;
          })
        );
        if (allPassed.every(Boolean)) {
          await db.insert(certificates).values({
            memberId: m.id,
            scope: c.category,
            title: `${c.category.charAt(0).toUpperCase() + c.category.slice(1)} Category Certification`,
            verificationCode: "C10C-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
          });
          await notify(m.userId, "course", "Category certification issued", `You've completed the full ${c.category} track. Certificate issued.`, "/app/training");
        }
        await notify(m.userId, "course", `Exam passed — ${c.code}`, `Score ${score}%. Course certificate issued.`, "/app/training");
      } else {
        await notify(m.userId, "course", `Exam not passed — ${c.code}`, `Score ${score}%. Pass mark is ${exam.passMark}%. Retake anytime.`, "/app/training");
      }
      return { score, passed, passMark: exam.passMark, total: qs.length, correct };
    }),

  myCertificates: authedQuery.query(async ({ ctx }) => {
    const m = await myMember(ctx.user.id);
    if (!m) return [];
    const db = getDb();
    return db.select().from(certificates).where(and(eq(certificates.memberId, m.id), eq(certificates.revoked, false))).orderBy(desc(certificates.issuedAt));
  }),

  /** Public certificate verification */
  verifyCertificate: publicQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [cert] = await db.select().from(certificates).where(eq(certificates.verificationCode, input.code.toUpperCase()));
      if (!cert || cert.revoked) return { valid: false as const };
      const [m] = await db.select().from(members).where(eq(members.id, cert.memberId));
      return {
        valid: true as const,
        title: cert.title,
        member: m ? `${m.firstName} ${m.lastName}` : "Member",
        issuedAt: cert.issuedAt,
      };
    }),
});
