import { type Profile, createApiClient } from "@gmc/api-client";
import { useQuery } from "@tanstack/react-query";

const api = createApiClient();

/**
 * How this browser is doing: Personal Bests, best Accuracy, recent average, and
 * the Runs behind them.
 *
 * Fetched when the screen asks for it and not before. Nothing else on the site
 * needs it, and prefetching it on load would spend a query on the majority of
 * visits that go straight into a Run.
 *
 * `staleTime` is zero — the default. A profile changes every time its owner
 * finishes a Run, and the one moment anybody opens this screen is the moment
 * after they did.
 */
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
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
