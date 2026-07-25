import { type User, createApiClient } from "@gmc/api-client";
import { useQuery } from "@tanstack/react-query";

const api = createApiClient();

const currentUserQueryKey = ["current-user"] as const;

/**
 * Who this browser is, creating a User the first time it turns out to be nobody.
 *
 * The cookie that carries the answer is `HttpOnly`, so nothing here can read it
 * — which is the point. The browser attaches it to every same-origin request on
 * its own (ADR-0002), and this hook only ever sees the User it resolves to.
 *
 * Read-then-create rather than one "get or create" call: a reload, a prefetch or
 * a crawler must not each leave a User behind, and only the request that
 * actually creates one may be the one that is unsafe to repeat.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: async (): Promise<User> => {
      const existing = await api.GET("/api/users/me");
      if (existing.data) return existing.data;

      // 404 is the documented "this browser is nobody yet" answer and the only
      // one worth acting on. Anything else is a backend problem, and creating a
      // second User because the first lookup happened to 500 would silently
      // orphan every Run the visitor has ever recorded.
      if (existing.response.status !== 404) {
        throw new Error(`Could not read the current User (status ${existing.response.status})`);
      }

      const created = await api.POST("/api/users");
      if (!created.data) {
        throw new Error(`Could not create a User (status ${created.response.status})`);
      }
      return created.data;
    },
    // Identity does not change while the page is open. Refetching it would
    // achieve nothing and, on a slow connection, would race the creation above.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * The two letters an avatar tile shows for a Handle: the initial of each word.
 *
 * `PERCOLATING_FERRET` gives PF, and `SPIRALING_MANTIS_2` still gives SM — the
 * collision suffix is bookkeeping, not part of who someone is.
 */
export function initialsFor(handle: string): string {
  const letters = handle
    .split("_")
    .map((word) => word.charAt(0))
    .filter((letter) => /[A-Za-z]/.test(letter));

  return letters.slice(0, 2).join("").toUpperCase();
}
