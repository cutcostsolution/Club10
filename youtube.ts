/**
 * YouTube helpers — accept any common link shape (watch?v=, youtu.be/, shorts/,
 * embed/, or a bare 11-char video id) and produce the canonical embed URL.
 * Returns null for anything that is not a recognisable YouTube link, so bad
 * input never renders a broken iframe.
 */
export function youtubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  let id: string | null = null;
  const patterns = [
    /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m) { id = m[1]; break; }
  }
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
