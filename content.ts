import { trpc } from "@/providers/trpc";

/** Load a CMS prefix (e.g. "home.") and return a key getter with optional fallback. */
export function useContent(prefix: string) {
  const { data } = trpc.cms.page.useQuery({ prefix });
  const map = (data ?? {}) as Record<string, string>;
  return (key: string, fallback = "") => map[key] ?? fallback;
}
