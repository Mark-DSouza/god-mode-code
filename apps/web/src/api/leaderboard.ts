import { type Leaderboard, createApiClient } from "@gmc/api-client";
import { useQuery } from "@tanstack/react-query";

const api = createApiClient();

/**
 * Where everyone stands on one Passage.
 *
 * Read on the result screen, so it is asked for the moment a Run is recorded —
 * which is also the moment the board it is asking about changed. The backend
 * allows a cache half a minute (its own `Cache-Control`), and this keeps the
 * client's default staleness rather than overriding it: the asker's own new
 * figure is already on the screen, having come back from the request that
 * recorded it, so a board that is thirty seconds behind on somebody else's Run
 * is showing nobody anything wrong.
 *
 * A board that does not load is not an error worth a screen. The result itself
 * arrived and is what the player came for, so the caller renders a quiet line
 * rather than a fault — see `PassageLeaderboard`.
 */
export function usePassageLeaderboard(passageId: string) {
  return useQuery({
    queryKey: ["leaderboard", "passage", passageId],
    queryFn: async (): Promise<Leaderboard> => {
      const result = await api.GET("/api/passages/{passageId}/leaderboard", {
        params: { path: { passageId } },
      });
      if (result.data) return result.data;

      throw new Error(`Could not read the Leaderboard (status ${result.response.status})`);
    },
  });
}
