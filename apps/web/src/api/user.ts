import { type User, createApiClient } from "@gmc/api-client";
import { useQuery } from "@tanstack/react-query";
import { turnstileToken } from "./turnstile.ts";

const api = createApiClient();

export const currentUserQueryKey = ["current-user"] as const;

/** One holder of the lock at a time, across every tab of this browser. */
const RECOGNITION_LOCK = "gmc-recognise-or-create-user";

/**
 * Who this browser is, creating a User the first time it turns out to be nobody.
 *
 * The cookie that carries the answer is `HttpOnly`, so nothing here can read it
 * — which is the point. The browser attaches it to every same-origin request on
 * its own (ADR-0002), and this hook only ever sees the User it resolves to.
 *
 * Read-then-create rather than one "get or create" call: a reload, a prefetch or
 * a crawler must not each leave a User behind, and only the request that actually
 * creates one may be the one that is unsafe to repeat.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    // React Query already collapses concurrent callers within one tab; the lock
    // below is what extends that across tabs.
    queryFn: () => acrossTabs(RECOGNITION_LOCK, recogniseOrCreate),
    // A User does not change while the page is open. Refetching would achieve
    // nothing and, on a slow connection, would race the creation above.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

async function recogniseOrCreate(): Promise<User> {
  const existing = await api.GET("/api/users/me");
  if (existing.data) return existing.data;

  // 404 is the documented "this browser is nobody yet" answer and the only one
  // worth acting on. Anything else is a backend problem, and creating a second
  // User because the first lookup happened to 500 would silently orphan every
  // Run the visitor has ever recorded.
  if (existing.response.status !== 404) {
    throw new Error(`Could not read the current User (status ${existing.response.status})`);
  }

  // undefined wherever no Turnstile site is configured — every local and CI
  // run, until one is provisioned — in which case this asks nothing of the
  // request beyond what it already sent.
  const token = await turnstileToken();
  const created = await (token
    ? api.POST("/api/users", { body: { turnstileToken: token } })
    : api.POST("/api/users"));
  if (!created.data) {
    throw new Error(`Could not create a User (status ${created.response.status})`);
  }
  return created.data;
}

/**
 * Runs `work` with no other tab of this browser inside it.
 *
 * Two tabs opened at the same moment are the case this exists for. Both find no
 * cookie, both read 404, both create — and whichever `Set-Cookie` is stored last
 * orphans the other User, taking its Runs with it once Runs are attributed
 * (ADR-0007). The server cannot prevent this: a browser that has never been here
 * presents nothing that distinguishes one of its tabs from another, which is
 * precisely what the Recognition Key is for and precisely what it does not have
 * yet. The coordination has to happen where the tabs are.
 *
 * Web Locks are per origin and shared across tabs of one browser profile, which
 * is exactly the scope of the problem. The loser waits, then re-reads
 * `/api/users/me` — which by then carries the winner's cookie and answers 200.
 *
 * Where the API is missing — jsdom, and browsers older than Safari 15.4 — the
 * work simply runs. That degrades to today's behaviour rather than failing, and
 * the race it reopens is a narrow one that costs an unreferenced row.
 */
async function acrossTabs<T>(name: string, work: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return work();

  // `request` resolves with whatever the callback returns, and releases the lock
  // when that promise settles — including when it rejects.
  return locks.request(name, work) as Promise<T>;
}
