import type { Health, Leaderboard, User } from "@gmc/api-client";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

/**
 * Interception happens at the network layer, not by swapping the client.
 *
 * A test that replaces `fetch` or stubs the API module proves the component
 * calls the stub. This intercepts the actual HTTP request, so the URL, the
 * method, the status code and the JSON body are all part of what is under
 * test — which is where the mismatches actually live.
 *
 * `Health` is imported from the generated client, so a backend change that
 * alters the response shape fails to compile here rather than producing a mock
 * that no longer resembles the real thing.
 */

export const healthUp: Health = {
  status: "UP",
  database: "UP",
  judge: "UP",
  version: "0.0.1-test",
};

/**
 * A browser that has been here before, which is the uninteresting case and
 * therefore the right default: tests about anything other than the current User should
 * not have to think about it, and no POST handler is registered, so a test that
 * unexpectedly creates a User fails on an unhandled request.
 */
export const returningUser: User = {
  id: "00000000-0000-4000-8000-000000000001",
  handle: "PERCOLATING_FERRET",
  claimed: false,
};

/**
 * How many distinct Users a Passage needs before its ranking is shown, as the
 * backend reports it.
 *
 * Restated here rather than imported because it is the server's rule and this
 * is the server's answer — the frontend reads the figure off the payload and
 * has no opinion about what it should be.
 */
const MINIMUM_PARTICIPANTS = 5;

/**
 * A Passage too few people have typed for a ranking of it to mean anything.
 *
 * The default for the same reason `returningUser` is: it is the uninteresting
 * case. Every test that reaches the result screen fetches a board, and only the
 * Leaderboard tests care what is on one — so the default is the state that
 * renders a sentence instead of a table and leaves everybody else's assertions
 * about WPM readouts unambiguous.
 */
export function unrankedLeaderboard(passageId: string): Leaderboard {
  return {
    passageId,
    discipline: "QUOTES",
    entries: [],
    participants: 1,
    minimumParticipants: MINIMUM_PARTICIPANTS,
  };
}

export const handlers = [
  http.get("/api/health", () => HttpResponse.json(healthUp)),
  http.get("/api/users/me", () => HttpResponse.json(returningUser)),
  http.get("/api/passages/:passageId/leaderboard", ({ params }) =>
    HttpResponse.json(unrankedLeaderboard(String(params.passageId))),
  ),
];

export const server = setupServer(...handlers);

/** A Passage whose ranking is worth showing, with whatever is on it. */
export function respondWithLeaderboard(board: Leaderboard) {
  server.use(http.get("/api/passages/:passageId/leaderboard", () => HttpResponse.json(board)));
}

/** A board the backend will not produce, which must not take the result screen down with it. */
export function respondLeaderboardUnavailable() {
  server.use(
    http.get("/api/passages/:passageId/leaderboard", () => new HttpResponse(null, { status: 500 })),
  );
}

/** A backend that answers, but reports a dependency down. */
export function respondDegraded() {
  server.use(
    http.get("/api/health", () =>
      HttpResponse.json<Health>(
        { status: "DEGRADED", database: "DEGRADED", judge: "DEGRADED", version: "0.0.1-test" },
        { status: 503 },
      ),
    ),
  );
}

/**
 * A backend whose judge is down and which is otherwise perfectly well.
 *
 * The status code is the assertion: 200, not 503. Only the Code Discipline
 * needs the judge, so a judge on its isolated host failing must not take the
 * site down or page anyone (ADR-0005).
 */
export function respondJudgeDown() {
  server.use(
    http.get("/api/health", () =>
      HttpResponse.json<Health>({
        status: "UP",
        database: "UP",
        judge: "DEGRADED",
        version: "0.0.1-test",
      }),
    ),
  );
}

/** A backend that is not there at all — a different failure from a degraded one. */
export function respondUnreachable() {
  server.use(http.get("/api/health", () => HttpResponse.error()));
}
