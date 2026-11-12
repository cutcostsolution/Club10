import { useState } from "react";
import { ImagePlus, Loader2, Pencil, PlayCircle, Plus, Trash2 } from "lucide-react";
import { youtubeEmbedUrl } from "@/lib/youtube";
import { trpc } from "@/providers/trpc";
import { uploadFile } from "@/lib/upload";

type PostForm = {
  id?: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverTheme: string;
  coverImage: string;
  videoUrl: string;
  status: "draft" | "published";
};

const EMPTY: PostForm = { title: "", slug: "", excerpt: "", body: "", coverTheme: "gold", coverImage: "", videoUrl: "", status: "draft" };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

export default function AdminBlog() {
  const utils = trpc.useUtils();
  const { data: posts, isLoading } = trpc.admin.blogList.useQuery();
  const [editing, setEditing] = useState<PostForm | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const save = trpc.admin.savePost.useMutation({
    onSuccess: async () => {
      await utils.admin.blogList.invalidate();
      setEditing(null);
    },
  });
  const del = trpc.admin.deletePost.useMutation({
    onSuccess: () => utils.admin.blogList.invalidate(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-ink">Blog</h1>
          <p className="mt-1 text-sm text-neutral-500">Articles appear on the public /blog page the moment they're published.</p>
        </div>
        <button
          onClick={() => setEditing(EMPTY)}
          className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-ink"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#a8842b]" /></div>
      ) : (posts ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center text-sm text-neutral-400">
          No posts yet — write the first one.
        </p>
      ) : (
        <div className="space-y-3">
          {(posts ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{p.title}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  /blog/{p.slug} ·{" "}
                  <span className={p.status === "published" ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>{p.status}</span>
                  {p.publishedAt ? ` · ${new Date(p.publishedAt).toLocaleDateString("en-NG")}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setEditing({
                      id: p.id,
                      title: p.title,
                      slug: p.slug,
                      excerpt: p.excerpt ?? "",
                      body: p.body ?? "",
                      coverTheme: p.coverTheme ?? "gold",
                      coverImage: (p as { coverImage?: string | null }).coverImage ?? "",
                      videoUrl: (p as { videoUrl?: string | null }).videoUrl ?? "",
                      status: p.status,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600 hover:text-ink"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => confirm(`Delete “${p.title}”?`) && del.mutate({ id: p.id })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-7">
            <h2 className="text-lg font-black text-ink">{editing.id ? "Edit post" : "New post"}</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Title</span>
                <input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value, slug: editing.id ? editing.slug : slugify(e.target.value) })
                  }
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Slug</span>
                  <input
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Cover theme</span>
                  <select
                    value={editing.coverTheme}
                    onChange={(e) => setEditing({ ...editing, coverTheme: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                  >
                    <option value="gold">Gold</option>
                    <option value="dark">Dark</option>
                    <option value="green">Green</option>
                  </select>
                </label>
              </div>
              <div className="rounded-xl border border-neutral-200 p-4">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Cover image</span>
                <p className="mb-3 text-xs text-neutral-400">Upload a cover photo (up to 25 MB) or paste an image link. Shown on the blog cards and the article header.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl gold-bg-grad px-4 py-2.5 text-xs font-bold text-ink ${uploadingCover ? "pointer-events-none opacity-60" : ""}`}>
                    {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {uploadingCover ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 25 * 1024 * 1024) { alert("Images up to 25 MB are fine — this one is bigger."); return; }
                        setUploadingCover(true);
                        try {
                          const url = await uploadFile(file, "cms");
                          setEditing((cur) => (cur ? { ...cur, coverImage: url } : cur));
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Upload failed");
                        } finally {
                          setUploadingCover(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  <span className="text-xs text-neutral-400">or</span>
                  <input
                    value={editing.coverImage}
                    onChange={(e) => setEditing({ ...editing, coverImage: e.target.value })}
                    placeholder="Paste image URL (https://…)"
                    className="min-w-[220px] flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                  />
                  {editing.coverImage && (
                    <button type="button" onClick={() => setEditing({ ...editing, coverImage: "" })} className="text-xs font-bold text-red-500 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
                {editing.coverImage && (
                  <img src={editing.coverImage} alt="Cover" className="mt-3 h-32 w-full rounded-xl object-cover" />
                )}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Excerpt</span>
                <textarea
                  rows={2}
                  value={editing.excerpt}
                  onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Body — blank line between paragraphs
                </span>
                <textarea
                  rows={12}
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Supportive YouTube video (optional)
                </span>
                <input
                  value={editing.videoUrl}
                  onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                />
                {editing.videoUrl.trim() && !youtubeEmbedUrl(editing.videoUrl) && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">That doesn't look like a YouTube link — it won't be shown.</p>
                )}
                {youtubeEmbedUrl(editing.videoUrl) && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <PlayCircle className="h-3.5 w-3.5" /> Valid — the video plays at the end of the article.
                  </p>
                )}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Status</span>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as "draft" | "published" })}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#a8842b]/40"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
            </div>
            {save.error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">{save.error.message}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs font-bold text-neutral-600">
                Cancel
              </button>
              <button
                onClick={() => save.mutate({ ...editing, coverImage: editing.coverImage.trim() ? editing.coverImage.trim() : null, videoUrl: editing.videoUrl.trim() ? editing.videoUrl.trim() : null })}
                disabled={save.isPending || !editing.title || !editing.slug}
                className="gold-bg-grad inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-ink disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
