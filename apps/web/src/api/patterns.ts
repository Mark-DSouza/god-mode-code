import {
  type Family,
  type Pattern,
  type Rejection,
  type Seniority,
  type SolveChallenge,
  type SolveRun,
  type SolveRunSubmission,
  createApiClient,
} from "@gmc/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RunRefused } from "./typing.ts";

const api = createApiClient();

/**
 * A Solve Run the judge never got to see.
 *
 * Separate from {@link RunRefused} because the two ask for different things
 * from the player. A refusal means this submission will never be recorded and
 * the Challenge is gone; this means nothing is wrong with what they wrote, the
 * Challenge is still theirs, and pressing submit again is a reasonable thing to
 * do.
 */
export class JudgeUnavailable extends Error {
  constructor(explanation: string) {
    super(explanation);
    this.name = "JudgeUnavailable";
  }
}

/**
 * The catalogue, narrowed.
 *
 * A query rather than a mutation, unlike asking for a Passage. Browsing records
 * nothing and costs nothing to repeat — it is the one screen in this
 * application where a refetch on remount is exactly what you want.
 */
export function usePatterns(family: Family | null, seniority: Seniority | null) {
  return useQuery({
    queryKey: ["patterns", family, seniority] as const,
    queryFn: async (): Promise<Pattern[]> => {
      const result = await api.GET("/api/patterns", {
        // Undefined rather than null: openapi-fetch omits an undefined
        // parameter and serialises a null one as the string "null", which the
        // backend would read as a Family nobody has.
        params: { query: { family: family ?? undefined, seniority: seniority ?? undefined } },
      });
      if (!result.data) {
        throw new Error(`Could not read the Patterns (status ${result.response.status})`);
      }
      return result.data;
    },
  });
}

/**
 * Asks to be handed one Pattern.
 *
 * A mutation, and for the same reason asking for a Passage is one: it records an
 * Issue and abandons whatever Challenge the player was holding. A query would
 * refetch on a remount and quietly throw away the Pattern on screen.
 */
export function useRequestSolveChallenge() {
  return useMutation({
    mutationFn: async (slug: string): Promise<SolveChallenge> => {
      const result = await api.POST("/api/patterns/{slug}/challenges", {
        params: { path: { slug } },
      });
      if (!result.data) {
        throw new Error(`Could not get that Pattern (status ${result.response.status})`);
      }
      return result.data;
    },
  });
}

/** Sends the written lines to be judged, and reports back what came of it. */
export function useSubmitSolveRun() {
  return useMutation({
    mutationFn: async (submission: SolveRunSubmission): Promise<SolveRun> => {
      const result = await api.POST("/api/solve-runs", { body: submission });
      if (result.data) return result.data;

      // Three documented answers and three different things to tell the player.
      // 422 is a Run that will never exist; 503 is a judge that is not there,
      // which leaves the Challenge live and is worth retrying.
      if (result.response.status === 422 && isRejection(result.error)) {
        throw new RunRefused(result.error);
      }
      if (result.response.status === 503) {
        throw new JudgeUnavailable(explanationOf(result.error));
      }
      throw new Error(`Could not submit the Solve Run (status ${result.response.status})`);
    },
    // Retrying would send the same lines to a second container while the first
    // is still running, and the loser of that race is told the Issue was
    // already used — a slow judge turned into a refusal.
    retry: false,
  });
}

function isRejection(body: unknown): body is Rejection {
  return typeof body === "object" && body !== null && "reason" in body;
}

function explanationOf(body: unknown): string {
  if (typeof body === "object" && body !== null && "explanation" in body) {
    return String((body as { explanation: unknown }).explanation);
  }
  return "The judge could not be reached. Your Challenge is still yours.";
}
