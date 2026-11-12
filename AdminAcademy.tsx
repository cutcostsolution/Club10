import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  GraduationCap, Pencil, X, ChevronDown, ChevronRight, FileText, Plus, Trash2, ListChecks, PlayCircle,
} from "lucide-react";
import { youtubeEmbedUrl } from "@/lib/youtube";

const label = "block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1.5";
const input =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40";

type LessonEdit = {
  id: number | null;
  moduleId: number;
  code: string;
  title: string;
  minutes: number;
  outcome: string;
  body: string;
  videoUrl: string;
  fieldTool: string;
  deepPoint: string;
  selfCheck: string;
  sortOrder: number;
};

type CourseEdit = {
  id: number | null;
  code: string;
  title: string;
  category: string;
  tagline: string;
  description: string;
  promise: string;
  audience: string;
  prerequisites: string;
  outcomes: string;
  sortOrder: number;
};

type QuestionEdit = {
  id: number | null;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sortOrder: number;
};

/* ------------------------------ exam manager ------------------------------ */

function ExamManager({ courseId, courseTitle, onClose }: { courseId: number; courseTitle: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data } = trpc.admin.examDetail.useQuery({ courseId });
  const [editing, setEditing] = useState<QuestionEdit | null>(null);
  const [passMark, setPassMark] = useState<string | null>(null);

  const saveQ = trpc.admin.saveExamQuestion.useMutation({
    onSuccess: () => { utils.admin.examDetail.invalidate({ courseId }); utils.admin.academyTree.invalidate(); setEditing(null); },
  });
  const delQ = trpc.admin.deleteExamQuestion.useMutation({
    onSuccess: () => { utils.admin.examDetail.invalidate({ courseId }); utils.admin.academyTree.invalidate(); },
  });
  const setMark = trpc.admin.setExamPassMark.useMutation({
    onSuccess: () => utils.admin.examDetail.invalidate({ courseId }),
  });

  const questions = data?.questions ?? [];
  const mark = passMark ?? String(data?.exam?.passMark ?? 60);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-ink">Exam questions — {courseTitle}</h3>
            <p className="text-xs text-neutral-400">{questions.length} question(s)</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-neutral-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-neutral-50 p-4">
          <div>
            <label className={label}>Pass mark (%)</label>
            <input className={`${input} w-28`} inputMode="numeric" value={mark} onChange={(e) => setPassMark(e.target.value)} />
          </div>
          <button
            onClick={() => setMark.mutate({ courseId, passMark: Math.min(100, Math.max(1, Number(mark) || 60)) })}
            disabled={setMark.isPending}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-bold text-ink hover:bg-white disabled:opacity-60"
          >
            Save pass mark
          </button>
          <button
            onClick={() => setEditing({ id: null, question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", sortOrder: questions.length })}
            className="gold-bg-grad ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-ink"
          >
            <Plus className="w-4 h-4" /> Add question
          </button>
        </div>

        <ul className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-black text-gold">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-ink">{q.question}</p>
                  <ul className="mt-2 space-y-1">
                    {q.options.map((o, oi) => (
                      <li key={oi} className={`text-xs ${oi === q.correctIndex ? "font-bold text-emerald-700" : "text-neutral-500"}`}>
                        {oi === q.correctIndex ? "✓ " : "– "}{o}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => setEditing({ id: q.id, question: q.question, options: [...q.options], correctIndex: q.correctIndex, explanation: q.explanation ?? "", sortOrder: q.sortOrder })}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (confirm("Delete this question?")) delQ.mutate({ id: q.id }); }}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
          {questions.length === 0 && <p className="py-6 text-center text-sm text-neutral-400">No questions yet — add the first one.</p>}
        </ul>

        {/* question editor */}
        {editing && (
          <div className="mt-5 rounded-2xl border-2 border-[#a8842b]/40 bg-champagne/30 p-5">
            <h4 className="font-black text-ink">{editing.id ? "Edit question" : "New question"}</h4>
            <div className="mt-3 space-y-3">
              <div>
                <label className={label}>Question</label>
                <textarea rows={2} className={input} value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <label className={label}>Options — select the correct one</label>
                {editing.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={editing.correctIndex === i}
                      onChange={() => setEditing({ ...editing, correctIndex: i })}
                      className="h-4 w-4 accent-[#a8842b]"
                    />
                    <input
                      className={input}
                      value={o}
                      placeholder={`Option ${i + 1}`}
                      onChange={(e) => setEditing({ ...editing, options: editing.options.map((x, xi) => (xi === i ? e.target.value : x)) })}
                    />
                    {editing.options.length > 2 && (
                      <button
                        onClick={() => setEditing({ ...editing, options: editing.options.filter((_, xi) => xi !== i), correctIndex: editing.correctIndex > i ? editing.correctIndex - 1 : Math.min(editing.correctIndex, editing.options.length - 2) })}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {editing.options.length < 6 && (
                  <button onClick={() => setEditing({ ...editing, options: [...editing.options, ""] })} className="w-fit text-xs font-bold text-[#a8842b] hover:underline">
                    + Add option
                  </button>
                )}
              </div>
              <div>
                <label className={label}>Explanation (optional)</label>
                <textarea rows={2} className={input} value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} />
              </div>
              {saveQ.error && <p className="text-sm text-red-600">{saveQ.error.message}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const opts = editing.options.map((s) => s.trim()).filter(Boolean);
                    saveQ.mutate({
                      id: editing.id ?? undefined,
                      courseId,
                      question: editing.question.trim(),
                      options: opts,
                      correctIndex: Math.min(editing.correctIndex, opts.length - 1),
                      explanation: editing.explanation || undefined,
                      sortOrder: editing.sortOrder,
                    });
                  }}
                  disabled={saveQ.isPending || !editing.question.trim() || editing.options.filter((s) => s.trim()).length < 2}
                  className="gold-bg-grad rounded-full px-6 py-2.5 text-sm font-bold text-ink disabled:opacity-60"
                >
                  {saveQ.isPending ? "Saving…" : "Save question"}
                </button>
                <button onClick={() => setEditing(null)} className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-bold text-neutral-600">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- page ----------------------------------- */

export default function AdminAcademy() {
  const utils = trpc.useUtils();
  const { data: tree, isLoading } = trpc.admin.academyTree.useQuery();
  const { data: plans } = trpc.admin.plansList.useQuery();
  const [openCourses, setOpenCourses] = useState<Record<number, boolean>>({});
  const [catFilter, setCatFilter] = useState("");
  const [lessonEditing, setLessonEditing] = useState<LessonEdit | null>(null);
  const [courseEditing, setCourseEditing] = useState<CourseEdit | null>(null);
  const [examFor, setExamFor] = useState<{ id: number; title: string } | null>(null);
  const [moduleFor, setModuleFor] = useState<number | null>(null); // courseId
  const [moduleTitle, setModuleTitle] = useState("");

  const refresh = () => utils.admin.academyTree.invalidate();
  const saveLesson = trpc.admin.saveLesson.useMutation({ onSuccess: () => { refresh(); setLessonEditing(null); } });
  const deleteLesson = trpc.admin.deleteLesson.useMutation({ onSuccess: refresh });
  const saveCourse = trpc.admin.saveCourse.useMutation({ onSuccess: () => { refresh(); setCourseEditing(null); } });
  const deleteCourse = trpc.admin.deleteCourse.useMutation({ onSuccess: refresh });
  const saveModule = trpc.admin.saveModule.useMutation({ onSuccess: () => { refresh(); setModuleFor(null); setModuleTitle(""); } });
  const deleteModule = trpc.admin.deleteModule.useMutation({ onSuccess: refresh });

  const planName = (code: string) => plans?.find((p) => p.code === code)?.name ?? code;
  const categories = [...new Set((tree ?? []).map((c) => c.category))];
  const filtered = (tree ?? []).filter((c) => !catFilter || c.category === catFilter);

  if (isLoading || !tree) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Admin</p>
          <h1 className="text-3xl font-black text-ink">Academy Manager</h1>
          <p className="text-neutral-500 mt-1">Add, edit and delete courses, modules, lessons and exam questions.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8842b]/40"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{planName(c)}</option>)}
          </select>
          <button
            onClick={() =>
              setCourseEditing({
                id: null, code: "", title: "", category: plans?.[0]?.code ?? "basic",
                tagline: "", description: "", promise: "", audience: "", prerequisites: "",
                outcomes: "", sortOrder: (tree.at(-1)?.sortOrder ?? 0) + 1,
              })
            }
            className="gold-bg-grad inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-ink"
          >
            <Plus className="w-4 h-4" /> Add new course
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((course) => {
          const open = openCourses[course.id] ?? false;
          const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);
          return (
            <div key={course.id} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <div className="px-6 py-4 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setOpenCourses({ ...openCourses, [course.id]: !open })}
                  className="p-1.5 rounded-lg hover:bg-neutral-100"
                >
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="w-10 h-10 rounded-xl gold-bg-grad flex items-center justify-center font-black text-white text-sm shrink-0">
                  {course.code}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="font-black text-ink">{course.title}</p>
                  <p className="text-xs text-neutral-400">
                    {planName(course.category)} track · {course.modules.length} modules · {lessonCount} lessons · {course.questionCount} exam questions
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setExamFor({ id: course.id, title: course.title })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 text-ink text-xs font-bold hover:bg-neutral-50"
                  >
                    <ListChecks className="w-3.5 h-3.5" /> Exam questions
                  </button>
                  <button
                    onClick={() =>
                      setCourseEditing({
                        id: course.id, code: course.code, title: course.title, category: course.category,
                        tagline: course.tagline ?? "", description: course.description ?? "", promise: course.promise ?? "",
                        audience: course.audience ?? "", prerequisites: course.prerequisites ?? "",
                        outcomes: (course.outcomes ?? []).join("\n"), sortOrder: course.sortOrder,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 text-ink text-xs font-bold hover:bg-neutral-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${course.title}" with all its modules, lessons and exam questions?`))
                        deleteCourse.mutate({ id: course.id });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>

              {open && (
                <div className="border-t border-neutral-100">
                  {course.modules.map((mod) => (
                    <div key={mod.id}>
                      <div className="flex items-center gap-2 bg-neutral-50 px-6 py-2.5">
                        <p className="flex-1 text-xs font-black uppercase tracking-wider text-neutral-500">{mod.title}</p>
                        <button
                          onClick={() =>
                            setLessonEditing({
                              id: null, moduleId: mod.id, code: `${course.code}.`, title: "", minutes: 8,
                              outcome: "", body: "", videoUrl: "", fieldTool: "", deepPoint: "", selfCheck: "",
                              sortOrder: mod.lessons.length,
                            })
                          }
                          className="text-xs font-bold text-[#a8842b] hover:underline"
                        >
                          + Add lesson
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete module "${mod.title}" and its lessons?`)) deleteModule.mutate({ id: mod.id }); }}
                          className="rounded p-1 text-red-400 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <ul className="divide-y divide-neutral-100">
                        {mod.lessons.map((lesson) => (
                          <li key={lesson.id} className="px-6 py-3 flex items-center gap-4 hover:bg-neutral-50/60">
                            <FileText className="w-4 h-4 text-neutral-300 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-ink text-sm truncate">{lesson.code} — {lesson.title}</p>
                              <p className="text-xs text-neutral-400">
                                {lesson.minutes} min
                                {(lesson as { videoUrl?: string | null }).videoUrl && (
                                  <span className="ml-2 inline-flex items-center gap-0.5 font-bold text-[#a8842b]">
                                    <PlayCircle className="inline h-3 w-3" /> video
                                  </span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setLessonEditing({
                                  id: lesson.id, moduleId: mod.id, code: lesson.code, title: lesson.title,
                                  minutes: lesson.minutes, outcome: lesson.outcome ?? "", body: lesson.body ?? "",
                                  videoUrl: (lesson as { videoUrl?: string | null }).videoUrl ?? "",
                                  fieldTool: lesson.fieldTool ?? "", deepPoint: lesson.deepPoint ?? "",
                                  selfCheck: lesson.selfCheck ?? "", sortOrder: lesson.sortOrder,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-ink text-xs font-bold hover:bg-neutral-50"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => { if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id: lesson.id }); }}
                              className="rounded-lg p-2 text-red-400 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                        {mod.lessons.length === 0 && <li className="px-6 py-3 text-xs text-neutral-400">No lessons in this module yet.</li>}
                      </ul>
                    </div>
                  ))}

                  {/* add module */}
                  <div className="border-t border-neutral-100 px-6 py-3">
                    {moduleFor === course.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={moduleTitle}
                          onChange={(e) => setModuleTitle(e.target.value)}
                          placeholder="Module title…"
                          className={`${input} max-w-sm`}
                        />
                        <button
                          onClick={() => saveModule.mutate({ courseId: course.id, title: moduleTitle.trim(), sortOrder: course.modules.length })}
                          disabled={saveModule.isPending || !moduleTitle.trim()}
                          className="gold-bg-grad rounded-xl px-4 py-2.5 text-xs font-bold text-ink disabled:opacity-60"
                        >
                          Add
                        </button>
                        <button onClick={() => { setModuleFor(null); setModuleTitle(""); }} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-bold text-neutral-600">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setModuleFor(course.id)} className="text-xs font-bold text-[#a8842b] hover:underline">
                        + Add module
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
          <GraduationCap className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">No courses match this filter.</p>
        </div>
      )}

      {/* Lesson modal */}
      {lessonEditing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setLessonEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg">{lessonEditing.id ? "Edit lesson" : "Add lesson"}</h3>
              <button onClick={() => setLessonEditing(null)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveLesson.mutate({
                  id: lessonEditing.id ?? undefined,
                  moduleId: lessonEditing.moduleId,
                  code: lessonEditing.code.trim(),
                  title: lessonEditing.title,
                  minutes: lessonEditing.minutes,
                  outcome: lessonEditing.outcome || undefined,
                  body: lessonEditing.body,
                  videoUrl: lessonEditing.videoUrl.trim() ? lessonEditing.videoUrl.trim() : null,
                  fieldTool: lessonEditing.fieldTool || undefined,
                  deepPoint: lessonEditing.deepPoint || undefined,
                  selfCheck: lessonEditing.selfCheck || undefined,
                  sortOrder: lessonEditing.sortOrder,
                });
              }}
            >
              <div className="grid sm:grid-cols-[120px_1fr_120px] gap-4">
                <div>
                  <label className={label}>Code</label>
                  <input required value={lessonEditing.code} onChange={(e) => setLessonEditing({ ...lessonEditing, code: e.target.value })} className={input} placeholder="B1.1" />
                </div>
                <div>
                  <label className={label}>Title</label>
                  <input required value={lessonEditing.title} onChange={(e) => setLessonEditing({ ...lessonEditing, title: e.target.value })} className={input} />
                </div>
                <div>
                  <label className={label}>Minutes</label>
                  <input required type="number" min={1} value={lessonEditing.minutes} onChange={(e) => setLessonEditing({ ...lessonEditing, minutes: Number(e.target.value) || 1 })} className={input} />
                </div>
              </div>
              <div>
                <label className={label}>YouTube training link (optional)</label>
                <input
                  value={lessonEditing.videoUrl}
                  onChange={(e) => setLessonEditing({ ...lessonEditing, videoUrl: e.target.value })}
                  className={input}
                  placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
                />
                {lessonEditing.videoUrl.trim() && !youtubeEmbedUrl(lessonEditing.videoUrl) && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">That doesn't look like a YouTube link — it won't be shown to members.</p>
                )}
                {youtubeEmbedUrl(lessonEditing.videoUrl) && (
                  <p className="mt-1.5 text-xs font-semibold text-emerald-700">Valid YouTube link — members will see the video at the top of this lesson.</p>
                )}
              </div>
              <div>
                <label className={label}>Outcome</label>
                <input value={lessonEditing.outcome} onChange={(e) => setLessonEditing({ ...lessonEditing, outcome: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Body</label>
                <textarea required rows={12} value={lessonEditing.body} onChange={(e) => setLessonEditing({ ...lessonEditing, body: e.target.value })} className={`${input} font-mono`} />
              </div>
              <div>
                <label className={label}>Field tool</label>
                <textarea rows={3} value={lessonEditing.fieldTool} onChange={(e) => setLessonEditing({ ...lessonEditing, fieldTool: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Deep point</label>
                <textarea rows={2} value={lessonEditing.deepPoint} onChange={(e) => setLessonEditing({ ...lessonEditing, deepPoint: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Self-check</label>
                <textarea rows={2} value={lessonEditing.selfCheck} onChange={(e) => setLessonEditing({ ...lessonEditing, selfCheck: e.target.value })} className={input} />
              </div>
              {saveLesson.error && <p className="text-sm text-red-600">{saveLesson.error.message}</p>}
              <button type="submit" disabled={saveLesson.isPending} className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60">
                {saveLesson.isPending ? "Saving…" : lessonEditing.id ? "Save lesson" : "Add lesson"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Course modal */}
      {courseEditing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setCourseEditing(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-ink text-lg">{courseEditing.id ? "Edit course" : "Add new course"}</h3>
              <button onClick={() => setCourseEditing(null)} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveCourse.mutate({
                  id: courseEditing.id ?? undefined,
                  code: courseEditing.code.trim().toUpperCase(),
                  title: courseEditing.title,
                  category: courseEditing.category,
                  tagline: courseEditing.tagline || undefined,
                  description: courseEditing.description || undefined,
                  promise: courseEditing.promise || undefined,
                  audience: courseEditing.audience || undefined,
                  prerequisites: courseEditing.prerequisites || undefined,
                  outcomes: courseEditing.outcomes ? courseEditing.outcomes.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
                  sortOrder: courseEditing.sortOrder,
                });
              }}
            >
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <div>
                  <label className={label}>Code {courseEditing.id ? "(locked)" : ""}</label>
                  <input required value={courseEditing.code} disabled={!!courseEditing.id} onChange={(e) => setCourseEditing({ ...courseEditing, code: e.target.value })} className={`${input} font-mono ${courseEditing.id ? "bg-neutral-100 text-neutral-400" : ""}`} placeholder="B1" />
                </div>
                <div>
                  <label className={label}>Category (which plan unlocks it)</label>
                  <select value={courseEditing.category} onChange={(e) => setCourseEditing({ ...courseEditing, category: e.target.value })} className={input}>
                    {(plans ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                    {plans && !plans.some((p) => p.code === courseEditing.category) && <option value={courseEditing.category}>{courseEditing.category}</option>}
                  </select>
                </div>
              </div>
              <div>
                <label className={label}>Title</label>
                <input required value={courseEditing.title} onChange={(e) => setCourseEditing({ ...courseEditing, title: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Tagline</label>
                <input value={courseEditing.tagline} onChange={(e) => setCourseEditing({ ...courseEditing, tagline: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Description</label>
                <textarea rows={3} value={courseEditing.description} onChange={(e) => setCourseEditing({ ...courseEditing, description: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Promise</label>
                <textarea rows={2} value={courseEditing.promise} onChange={(e) => setCourseEditing({ ...courseEditing, promise: e.target.value })} className={input} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Audience</label>
                  <input value={courseEditing.audience} onChange={(e) => setCourseEditing({ ...courseEditing, audience: e.target.value })} className={input} />
                </div>
                <div>
                  <label className={label}>Sort order</label>
                  <input type="number" value={courseEditing.sortOrder} onChange={(e) => setCourseEditing({ ...courseEditing, sortOrder: Number(e.target.value) || 0 })} className={input} />
                </div>
              </div>
              <div>
                <label className={label}>Prerequisites</label>
                <input value={courseEditing.prerequisites} onChange={(e) => setCourseEditing({ ...courseEditing, prerequisites: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Learning outcomes (one per line)</label>
                <textarea rows={4} value={courseEditing.outcomes} onChange={(e) => setCourseEditing({ ...courseEditing, outcomes: e.target.value })} className={input} />
              </div>
              {saveCourse.error && <p className="text-sm text-red-600">{saveCourse.error.message}</p>}
              <button type="submit" disabled={saveCourse.isPending || !courseEditing.code.trim() || !courseEditing.title.trim()} className="w-full py-3.5 rounded-xl gold-bg-grad text-white font-black hover:opacity-90 disabled:opacity-60">
                {saveCourse.isPending ? "Saving…" : courseEditing.id ? "Save course" : "Create course"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Exam manager */}
      {examFor && <ExamManager courseId={examFor.id} courseTitle={examFor.title} onClose={() => setExamFor(null)} />}
    </div>
  );
}
