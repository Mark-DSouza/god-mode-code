import { type Profile, createApiClient } from "@gmc/api-client";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./user.ts";

const api = createApiClient();

/**
 * How this browser is doing: Personal Bests, best Accuracy, recent average, and
 * the Runs behind them.
 *
 * Fetched when the screen asks for it and not before. Nothing else on the site
 * needs it, and prefetching it on load would spend a query on the majority of
 * visits that go straight into a Run.
 *
 * Two departures from the client's defaults, and both are about the same thing.
 * `staleTime` is zero rather than the shared thirty seconds, because a profile
 * changes every time its owner finishes a Run and the moment anybody opens this
 * screen is the moment after they did — a cached copy would be missing the Run
 * they came to look at. And it waits for the current User: a browser that has
 * never been here is nobody until the header's own request creates one, and
 * asking first would answer 404 and show a fault to somebody whose only problem
 * is that they have just arrived.
 */
export function useProfile() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: ["profile"],
    // Not `isSuccess`: a User lookup that failed outright must still let this
    // ask and fail visibly, rather than leaving the screen reading "Reading
    // your Runs" for as long as anybody cares to wait.
    enabled: !user.isPending,
    staleTime: 0,
    queryFn: async (): Promise<Profile> => {
      const result = await api.GET("/api/profile");
      if (result.data) return result.data;

      // Including 404, which means this browser is nobody yet — a state the
      // header's own request resolves by creating a User on load, so by the time
      // anybody can open this screen it is a backend fault like any other.
      throw new Error(`Could not read the profile (status ${result.response.status})`);
    },
  });
}
