import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Lock, CheckCircle2, ArrowRight, BookOpen, Award } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/format";

export default function Training() {
  const { data, isLoading } = trpc.academy.myCourses.useQuery();
  const { data: plans } = trpc.member.plans.useQuery();

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { member, courses } = data;
  const myPlan = plans?.find((p) => p.code === member.category);
  const eligible = myPlan?.pointsEligible ?? false;
  const planName = (code: string) => plans?.find((p) => p.code === code)?.name ?? CATEGORY_LABEL[code] ?? code;

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-2">Club 10 Academy</p>
        <h1 className="text-3xl font-black text-ink">My Training</h1>
        <p className="text-neutral-500 mt-1">
          You are on the {planName(member.category)} track. Complete courses sequentially — exams unlock after every lesson.
        </p>
      </div>

      {/* overall compliance progress — the same tracker the admin sees */}
      {(() => {
        const accessibleCourses = courses.filter((c) => c.accessible);
        const totalLessons = accessibleCourses.reduce((s, c) => s + c.lessonCount, 0);
        const doneLessons = accessibleCourses.reduce((s, c) => s + c.doneCount, 0);
        const passedCount = accessibleCourses.filter((c) => (c as any).passed).length;
        const pct = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;
        return (
          <div className="rounded-2xl bg-ink night-glow p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a8842b]">Your training compliance</p>
                <p className="mt-1 text-sm text-white/70">
                  {doneLessons} of {totalLessons} lessons done · {passedCount} of {accessibleCourses.length} exams passed
                </p>
              </div>
              <p className="text-3xl font-black text-[#e9dcbb]">{pct}%</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="gold-bg-grad h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-white/40">The club reviews this tracker to confirm you're following through with the training.</p>
          </div>
        );
      })()}

      {!eligible && (
        <div className="rounded-2xl border border-[#a8842b]/30 bg-[#a8842b]/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <Award className="w-8 h-8 text-[#a8842b] shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-ink">Points are not part of your plan</p>
            <p className="text-sm text-neutral-600">
              Upgrade your membership to earn points from lessons, exams and recruiting — redeemable for rewards.
            </p>
          </div>
          <Link to="/app" className="shrink-0 px-5 py-2.5 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90">
            Upgrade
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {courses.map((course) => {
          const pct = course.lessonCount ? Math.round((course.doneCount / course.lessonCount) * 100) : 0;
          return (
            <div key={course.id} className="relative rounded-2xl border border-neutral-200 bg-white p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm ${
                    course.accessible ? "gold-bg-grad text-white" : "bg-neutral-100 text-neutral-400"
                  }`}>
                    {course.accessible ? course.code : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      {planName(course.category)} track
                    </p>
                    <h3 className="font-black text-ink leading-tight">{course.title}</h3>
                  </div>
                </div>
                {course.passed && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                  </span>
                )}
              </div>
              {course.description && <p className="text-sm text-neutral-500 mt-3 flex-1">{course.description}</p>}

              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-neutral-500 mb-1.5">
                  <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {course.doneCount}/{course.lessonCount} lessons</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full gold-bg-grad rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="mt-5">
                {course.accessible ? (
                  <Link
                    to={`/app/training/${course.code}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ink text-white font-bold text-sm hover:bg-[#1d1d24]"
                  >
                    {course.unlocked ? "Open course" : "Continue"} <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <p className="text-sm text-neutral-400 font-medium">Upgrade your membership to unlock this course.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
