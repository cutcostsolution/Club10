import { Link, useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, ArrowRight, CheckCircle2, Target, Lightbulb, ClipboardCheck, Wrench, PlayCircle } from "lucide-react";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-neutral-700 leading-relaxed">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">{p}</p>
      ))}
    </div>
  );
}

export default function LessonView() {
  const { courseId = "", lessonId = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.academy.lesson.useQuery({ id: Number(lessonId) }, { enabled: !!lessonId });
  const complete = trpc.academy.completeLesson.useMutation({
    onSuccess: async () => {
      await utils.academy.lesson.invalidate({ id: Number(lessonId) });
      await utils.academy.courseDetail.invalidate({ code: courseId });
      await utils.academy.myCourses.invalidate();
      await utils.member.me.invalidate();
    },
  });

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
        <p className="text-neutral-500 mb-4">Lesson not found.</p>
        <Link to="/app/training" className="text-[#a8842b] font-bold hover:underline">← Back to training</Link>
      </div>
    );
  }

  const { lesson, course, module, completed, nextId, prevId } = data;

  const handleComplete = () => {
    complete.mutate(
      { lessonId: lesson.id },
      {
        onSuccess: () => {
          if (nextId) navigate(`/app/training/${course.code}/lesson/${nextId}`);
          else navigate(`/app/training/${course.code}`);
        },
      }
    );
  };

  return (
    <div className="max-w-3xl space-y-8">
      <Link to={`/app/training/${course.code}`} className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> {course.code} — {course.title}
      </Link>

      <div>
        <p className="kicker mb-2">
          {module.title} · Lesson {lesson.code}
        </p>
        <h1 className="text-3xl font-black text-ink leading-tight">{lesson.title}</h1>
        {completed && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        )}
      </div>

      {lesson.videoUrl && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <PlayCircle className="h-3.5 w-3.5 text-[#a8842b]" /> Watch the training
          </p>
          <YouTubeEmbed url={lesson.videoUrl} title={`${lesson.code} — ${lesson.title}`} />
        </div>
      )}

      {lesson.outcome && (
        <div className="rounded-2xl border border-[#a8842b]/30 bg-[#a8842b]/5 p-5 flex gap-4">
          <Target className="w-6 h-6 text-[#a8842b] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#7c6117] mb-1">Outcome</p>
            <p className="font-bold text-ink">{lesson.outcome}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
        <Paragraphs text={lesson.body ?? ""} />
      </div>

      {lesson.fieldTool && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 flex gap-4">
          <div className="w-10 h-10 rounded-xl gold-bg-grad flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-1">Field tool</p>
            <p className="text-neutral-700 whitespace-pre-line leading-relaxed">{lesson.fieldTool}</p>
          </div>
        </div>
      )}

      {lesson.deepPoint && (
        <div className="rounded-2xl bg-ink night-glow p-6 text-white flex gap-4">
          <Lightbulb className="w-6 h-6 text-[#e9dcbb] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#a8842b] mb-1">Deep point</p>
            <p className="text-white/85 italic" style={{ fontFamily: "Caladea, serif" }}>{lesson.deepPoint}</p>
          </div>
        </div>
      )}

      {lesson.selfCheck && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-brand flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-1">Self-check</p>
            <p className="text-neutral-700 whitespace-pre-line leading-relaxed">{lesson.selfCheck}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {prevId ? (
          <Link
            to={`/app/training/${course.code}/lesson/${prevId}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-neutral-200 font-bold text-sm text-ink hover:bg-neutral-50"
          >
            <ArrowLeft className="w-4 h-4" /> Previous lesson
          </Link>
        ) : <span />}

        {completed ? (
          nextId ? (
            <Link
              to={`/app/training/${course.code}/lesson/${nextId}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
            >
              Next lesson <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to={`/app/training/${course.code}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
            >
              Back to course <ArrowRight className="w-4 h-4" />
            </Link>
          )
        ) : (
          <button
            onClick={handleComplete}
            disabled={complete.isPending}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            {complete.isPending ? "Saving…" : nextId ? "Complete & continue" : "Complete lesson"}
          </button>
        )}
      </div>
    </div>
  );
}
