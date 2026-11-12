/** Upload a file to the media library. Returns the public URL. */
export async function uploadFile(file: File, kind: "product" | "avatar" | "starter" | "cms" | "receipt"): Promise<string> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || `Upload failed (${res.status})`);
  return data.url;
}
