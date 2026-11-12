import { Link, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, CheckCircle2, Circle, FileText, Lock, Award, ArrowRight } from "lucide-react";

export default function CourseView() {
  const { courseId = "" } = useParams(); // route param carries the course CODE
  const { data, isLoading, error } = trpc.academy.courseDetail.useQuery({ code: courseId });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-24">
        <p className="text-neutral-500 mb-4">This course is not available to you.</p>
        <Link to="/app/training" className="text-[#a8842b] font-bold hover:underline">← Back to training</Link>
      </div>
    );
  }

  const { course, modules, exam, attempts } = data;
  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const doneLessons = modules.reduce((n, m) => n + m.lessons.filter((l) => l.completed).length, 0);
  const allDone = totalLessons > 0 && doneLessons === totalLessons;
  const passed = attempts.some((a) => a.passed);

  return (
    <div className="space-y-8">
      <Link to="/app/training" className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> All courses
      </Link>

      <div className="rounded-2xl bg-ink night-glow p-8 text-white">
        <p className="kicker mb-2">Course {course.code}</p>
        <h1 className="text-3xl font-black">{course.title}</h1>
        {course.description && <p className="text-white/60 mt-2 max-w-2xl">{course.description}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-6 text-sm">
          <span className="text-white/70">{doneLessons}/{totalLessons} lessons complete</span>
          <div className="flex-1 min-w-[160px] max-w-xs h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full gold-bg-grad rounded-full" style={{ width: `${totalLessons ? (doneLessons / totalLessons) * 100 : 0}%` }} />
          </div>
          {passed && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e9dcbb] bg-[#a8842b]/30 rounded-full px-3 py-1">
              <Award className="w-3.5 h-3.5" /> Certificate earned
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {modules.map((mod) => (
          <div key={mod.id} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/60">
              <p className="font-black text-ink">{mod.title}</p>
            </div>
            <ul className="divide-y divide-neutral-100">
              {mod.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    to={`/app/training/${course.code}/lesson/${lesson.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition group"
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-neutral-300 shrink-0" />
                    )}
                    <span className="flex-1">
                      <span className="block font-bold text-ink group-hover:text-[#a8842b] transition">
                        {lesson.code} — {lesson.title}
                      </span>
                      {lesson.outcome && <span className="block text-sm text-neutral-500 mt-0.5 line-clamp-1">{lesson.outcome}</span>}
                    </span>
                    <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#a8842b] transition" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Exam card */}
      {exam && (
        <div className={`rounded-2xl border p-6 ${allDone ? "border-[#a8842b]/40 bg-[#a8842b]/5" : "border-neutral-200 bg-white"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${allDone ? "gold-bg-grad" : "bg-neutral-100"}`}>
              {allDone ? <FileText className="w-6 h-6 text-white" /> : <Lock className="w-6 h-6 text-neutral-400" />}
            </div>
            <div className="flex-1">
              <h3 className="font-black text-ink">Course exam</h3>
              <p className="text-sm text-neutral-500">
                20 scenario questions · pass mark {exam.passMark}% · unlimited retakes (questions shuffle every attempt)
              </p>
              {attempts.length > 0 && (
                <p className="text-xs text-neutral-400 mt-1">
                  Attempts: {attempts.length} · Best score: {Math.max(...attempts.map((a) => a.score))}%
                </p>
              )}
            </div>
            {allDone ? (
              <Link
                to={`/app/training/${course.code}/exam`}
                className="shrink-0 px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
              >
                {passed ? "Retake exam" : "Take exam"}
              </Link>
            ) : (
              <span className="shrink-0 text-sm font-bold text-neutral-400">
                Complete all {totalLessons} lessons to unlock
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
