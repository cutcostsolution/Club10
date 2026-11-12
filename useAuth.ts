import { trpc } from "@/providers/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();

  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // A 401 from the server always wins over the cached copy — React Query keeps
  // the last successful data on a failed refetch, which used to bounce people
  // back into the dashboard right after signing out.
  const serverRejected =
    (error as { data?: { code?: string } } | null)?.data?.code === "UNAUTHORIZED";

  const logoutMutation = trpc.auth.logout.useMutation();

  // Sign-out must feel instant: clear the cached session NOW and leave the
  // page immediately — the server call that kills the cookie fires in the
  // background. Awaiting query invalidation used to hang the click for ages.
  const logout = useCallback(() => {
    utils.auth.me.setData(undefined, null as never);
    queryClient.clear(); // wipe the whole cache — no refetch storm, nothing stale
    navigate(redirectPath, { replace: true });
    logoutMutation.mutate();
  }, [utils, queryClient, navigate, redirectPath, logoutMutation]);

  const effectiveUser = serverRejected ? null : (user ?? null);

  useEffect(() => {
    if (redirectOnUnauthenticated && !isLoading && !effectiveUser) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, isLoading, effectiveUser, navigate, redirectPath]);

  return useMemo(
    () => ({
      user: effectiveUser,
      isAuthenticated: !!effectiveUser,
      isLoading: isLoading || logoutMutation.isPending,
      error,
      logout,
      refresh: refetch,
    }),
    [effectiveUser, isLoading, logoutMutation.isPending, error, logout, refetch],
  );
}
