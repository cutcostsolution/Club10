import { useState } from "react";
import { Link, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, Award, CheckCircle2, XCircle, Lock, RotateCcw } from "lucide-react";

type Result = { score: number; passed: boolean; passMark: number; total: number; correct: number };

export default function ExamView() {
  const { courseId = "" } = useParams();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.academy.getExam.useQuery({ courseCode: courseId });
  const submit = trpc.academy.submitExam.useMutation({
    onSuccess: async () => {
      await utils.academy.myCourses.invalidate();
      await utils.academy.courseDetail.invalidate({ code: courseId });
      await utils.academy.myCertificates.invalidate();
      await utils.member.me.invalidate();
    },
  });

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [started, setStarted] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto text-center py-24 space-y-4">
        <Lock className="w-12 h-12 text-neutral-300 mx-auto" />
        <p className="text-neutral-500">The exam unlocks after you complete every lesson in this course.</p>
        <Link to={`/app/training/${courseId}`} className="inline-block text-[#a8842b] font-bold hover:underline">
          ← Back to course
        </Link>
      </div>
    );
  }

  const { exam, questions } = data;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const handleSubmit = () => {
    if (!allAnswered || submit.isPending) return;
    const payload = Object.entries(answers).map(([questionId, option]) => ({ questionId: Number(questionId), option }));
    submit.mutate(
      { courseCode: courseId, answers: payload },
      {
        onSuccess: (r) => {
          setResult(r);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      }
    );
  };

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-6">
        <div className={`rounded-2xl p-8 text-center ${result.passed ? "bg-ink night-glow text-white" : "bg-white border border-neutral-200"}`}>
          {result.passed ? (
            <>
              <Award className="w-14 h-14 text-[#e9dcbb] mx-auto mb-4" />
              <h1 className="text-3xl font-black">Congratulations!</h1>
              <p className="text-white/70 mt-2">
                You passed the {exam.courseTitle} exam with {result.score}% ({result.correct}/{result.total}).
                Your certificate has been issued.
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
              <h1 className="text-3xl font-black text-ink">Not this time</h1>
              <p className="text-neutral-500 mt-2">
                You scored {result.score}% ({result.correct}/{result.total}). The pass mark is {result.passMark}%.
                Review the lessons and try again — retakes are unlimited and questions reshuffle.
              </p>
            </>
          )}
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            {!result.passed && (
              <button
                onClick={() => { setResult(null); setAnswers({}); setStarted(false); }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl gold-bg-grad text-white font-bold text-sm hover:opacity-90"
              >
                <RotateCcw className="w-4 h-4" /> Retake exam
              </button>
            )}
            <Link
              to={result.passed ? "/app/training" : `/app/training/${courseId}`}
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm ${
                result.passed ? "gold-bg-grad text-white hover:opacity-90" : "border border-neutral-200 text-ink hover:bg-neutral-50"
              }`}
            >
              {result.passed ? "Back to training" : "Review lessons"}
            </Link>
          </div>
        </div>
        {result.passed && (
          <p className="text-center text-sm text-neutral-500">
            Find and share your certificate from <Link to="/app/profile" className="text-[#a8842b] font-bold hover:underline">your profile</Link>.
          </p>
        )}
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <Link to={`/app/training/${courseId}`} className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-ink">
          <ArrowLeft className="w-4 h-4" /> Back to course
        </Link>
        <div className="rounded-2xl bg-ink night-glow p-8 text-white">
          <p className="kicker mb-2">Course exam</p>
          <h1 className="text-3xl font-black">{exam.courseTitle}</h1>
          <ul className="mt-6 space-y-3 text-white/75">
            <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-[#e9dcbb]" /> {questions.length} scenario-based questions</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-[#e9dcbb]" /> Pass mark: {exam.passMark}%</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-[#e9dcbb]" /> Unlimited retakes — questions shuffle every attempt</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-[#e9dcbb]" /> Certificate issued on pass</li>
          </ul>
          <button
            onClick={() => setStarted(true)}
            className="mt-8 px-8 py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90"
          >
            Start exam
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-[#f7f3ea]/90 backdrop-blur border-b border-neutral-200 flex items-center justify-between">
        <p className="font-black text-ink text-sm">{exam.courseTitle} — Exam</p>
        <p className="text-sm font-bold text-neutral-500">{answeredCount}/{questions.length} answered</p>
      </div>

      {questions.map((q, idx) => (
        <div key={q.id} className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="font-bold text-ink">
            <span className="text-[#a8842b] mr-2">Q{idx + 1}.</span>
            {q.question}
          </p>
          <div className="mt-4 space-y-2">
            {q.options.map((opt, oi) => {
              const selected = answers[q.id] === opt;
              return (
                <button
                  key={oi}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${
                    selected
                      ? "border-[#a8842b] bg-[#a8842b]/10 text-ink"
                      : "border-neutral-200 text-neutral-600 hover:border-[#a8842b]/50 hover:bg-neutral-50"
                  }`}
                >
                  <span className={`inline-flex w-5 h-5 rounded-full border mr-3 align-middle items-center justify-center text-[10px] font-black ${
                    selected ? "border-[#a8842b] bg-[#a8842b] text-white" : "border-neutral-300"
                  }`}>
                    {String.fromCharCode(65 + oi)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 flex flex-col sm:flex-row items-center gap-4">
        <p className="flex-1 text-sm text-neutral-500">
          {allAnswered ? "All questions answered. Ready to submit." : `Answer all ${questions.length} questions to submit (${questions.length - answeredCount} remaining).`}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submit.isPending}
          className="shrink-0 px-8 py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-40"
        >
          {submit.isPending ? "Submitting…" : "Submit exam"}
        </button>
      </div>
      {submit.error && <p className="text-sm text-red-600 text-center">{submit.error.message}</p>}
    </div>
  );
}
