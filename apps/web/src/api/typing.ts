import {
  type Challenge,
  type Discipline,
  type Rejection,
  type TypingRun,
  type TypingRunSubmission,
  createApiClient,
} from "@gmc/api-client";
import { useMutation } from "@tanstack/react-query";

const api = createApiClient();

/**
 * A Run the server declined to record, carrying the reason it gave.
 *
 * A refusal is not a transport failure and must not be shown as one. The reason
 * decides what the player is offered next — an expired Challenge wants a new
 * one, a replay means the result already exists — so it is carried on the error
 * rather than flattened into a message.
 */
export class RunRefused extends Error {
  readonly rejection: Rejection;

  constructor(rejection: Rejection) {
    super(rejection.explanation);
    this.name = "RunRefused";
    this.rejection = rejection;
  }
}

/**
 * Asks for something to type.
 *
 * A mutation rather than a query, because it is one: the request records an
 * Issue against the User and abandons whatever Challenge they were holding. A
 * query would be refetched on a remount and would silently throw away the
 * Passage on screen.
 */
export function useRequestChallenge() {
  return useMutation({
    mutationFn: async (discipline: Discipline): Promise<Challenge> => {
      const result = await api.POST("/api/challenges", { body: { discipline } });
      if (!result.data) {
        throw new Error(`Could not get a Challenge (status ${result.response.status})`);
      }
      return result.data;
    },
  });
}

/** Submits a finished Run for Verification, and reports back what the server made of it. */
export function useSubmitTypingRun() {
  return useMutation({
    mutationFn: async (submission: TypingRunSubmission): Promise<TypingRun> => {
      const result = await api.POST("/api/typing-runs", { body: submission });
      if (result.data) return result.data;

      // 422 is the documented refusal, and its body says why. Anything else is
      // the backend or the network failing, which is a different thing to tell
      // the player and a different thing to do about it.
      if (result.response.status === 422 && isRejection(result.error)) {
        throw new RunRefused(result.error);
      }
      throw new Error(`Could not submit the Run (status ${result.response.status})`);
    },
    // A Run is typed once. Retrying would spend a single-use Issue twice and
    // come back as ISSUE_ALREADY_USED, turning a slow network into a refusal.
    retry: false,
  });
}

function isRejection(body: unknown): body is Rejection {
  return typeof body === "object" && body !== null && "reason" in body;
}
