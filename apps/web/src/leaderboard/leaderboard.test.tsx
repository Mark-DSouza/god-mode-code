import type { Challenge, Leaderboard, LeaderboardEntry, TypingRun } from "@gmc/api-client";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App.tsx";
import { ResultScreen } from "../run/ResultScreen.tsx";
import {
  respondLeaderboardUnavailable,
  respondWithLeaderboard,
  returningUser,
  server,
} from "../test/msw-server.ts";
import { renderApp } from "../test/render.tsx";
import { useFakeClock, useRealClock } from "../test/setup.ts";

/**
 * A Passage's Leaderboard, on the screen a player actually meets it on.
 *
 * The first test plays a whole Run through the application, because the claim
 * that this snippet is on the result screen is only true if finishing a Run
 * puts it there. The rest render the result screen with a board behind it: they
 * are about what a ranking looks like — the top of it, the row that is yours,
 * the fallback when there is not enough of one — and driving three seconds of
 * countdown and ten keystrokes to reach each of them would be testing the
 * typing surface over and over on the way to somewhere else.
 *
 * Nothing here stubs the query hook or the client. Requests are intercepted at
 * the network layer, so the URL, the status and the JSON shape are all part of
 * what is under test.
 */

const PASSAGE = "green rain";
const PASSAGE_ID = "00000000-0000-4000-8000-0000000000b2";

/** The Handle the default backend recognises this browser as. */
const MINE = returningUser.handle;

const RUN: TypingRun = {
  id: "00000000-0000-4000-8000-0000000000c3",
  passageId: PASSAGE_ID,
  discipline: "QUOTES",
  wpm: 112.4,
  accuracy: 98.4,
  elapsedMillis: 21_000,
  keystrokes: 86,
  correctCharacters: 83,
  errors: 3,
  completedAt: "2026-01-01T00:00:21.000Z",
  personalBest: false,
};

/**
 * One row of a board.
 *
 * The Users are made here rather than reused from the default browser, except
 * for whichever one the test wants to be its own — a board where every row is
 * the asker's would highlight all of them and prove nothing.
 */
function entry(position: number, handle: string, wpm: number, mine = false): LeaderboardEntry {
  return {
    position,
    user: {
      // Deliberately nowhere near `returningUser.id`. An id that collided
      // with this browser's would quietly make a stranger's row "yours", and
      // every assertion about the highlight would be testing nothing.
      id: mine
        ? returningUser.id
        : `9999${String(position).padStart(4, "0")}-0000-4000-8000-000000000000`,
      handle,
      claimed: false,
    },
    wpm,
    accuracy: 99.1,
  };
}

/** A board with `entries` on it, and optionally a row belonging to this browser. */
function board(entries: LeaderboardEntry[], you: LeaderboardEntry | null = null): Leaderboard {
  return {
    passageId: PASSAGE_ID,
    discipline: "QUOTES",
    entries,
    participants: Math.max(entries.length, you ? you.position : 0),
    minimumParticipants: 5,
    ...(you ? { you } : {}),
  };
}

/** Ten Users, fastest first, none of them this browser. */
function tenOthers(): LeaderboardEntry[] {
  return Array.from({ length: 10 }, (_, index) =>
    entry(index + 1, `TYPING_STRANGER_${index + 1}`, 200 - index * 5),
  );
}

function resultScreen() {
  renderApp(
    <ResultScreen
      run={RUN}
      onRunAgain={() => {}}
      onChangeDiscipline={() => {}}
      onSignIn={() => {}}
      pending={false}
      failed={false}
    />,
  );
  return screen.findByRole("region", { name: /leaderboard for this passage/i });
}

/** The row a Handle is on, insisting there is one. */
function rowFor(handle: string): HTMLElement {
  const cell = screen.getByText(handle);
  const row = cell.closest("tr");
  if (!row) throw new Error(`${handle} is not in a table row`);
  return row;
}

describe("a Passage's Leaderboard", () => {
  it("appears on the result screen once a Run is recorded", async () => {
    useFakeClock();
    try {
      respondWithLeaderboard(board([...tenOthers().slice(0, 4), entry(5, MINE, 112, true)]));
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      servingARunOf(PASSAGE);

      renderApp(<App />);
      await user.click(await screen.findByRole("button", { name: /quotes/i }));
      await user.click(screen.getByRole("button", { name: /start run/i }));
      await screen.findByTestId("countdown");
      for (let second = 0; second < 3; second++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      await waitFor(() => expect(screen.getByTestId("typing-field")).toBeInTheDocument());
      await user.keyboard(PASSAGE);

      // The Run ends on the final character, and the ranking for the Passage
      // just typed is on the screen it lands on — not behind a menu, and not on
      // a Leaderboard screen the player would have to go and find.
      const ranking = await screen.findByRole("region", { name: /leaderboard for this passage/i });
      expect(within(ranking).getByRole("table")).toBeInTheDocument();
      expect(within(ranking).getByText(MINE)).toBeInTheDocument();
    } finally {
      useRealClock();
    }
  });

  it("shows the top of the ranking, in order, with each User's best", async () => {
    respondWithLeaderboard(board(tenOthers()));

    const ranking = await resultScreen();
    const rows = within(ranking).getAllByRole("row");

    // A header and five: the result screen shows the top of the board, not all
    // of it. The rest is one click away.
    expect(rows).toHaveLength(6);
    expect(
      within(ranking)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["#", "User", "WPM", "Acc"]);
    expect(rows.slice(1).map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    // Whole words per minute, as every other WPM a player is shown.
    expect(within(rows[1] as HTMLElement).getByText("200")).toBeInTheDocument();
  });

  it("marks the row that is yours, in something other than a colour", async () => {
    respondWithLeaderboard(
      board([...tenOthers().slice(0, 2), entry(3, MINE, 150, true)], entry(3, MINE, 150, true)),
    );

    const ranking = await resultScreen();

    // The green wash is the visual treatment and the visual suite photographs
    // it. What has to be true here is that the row says whose it is to somebody
    // who cannot see a 12% tint at all.
    expect(within(rowFor(MINE)).getByText(/^you$/i)).toBeInTheDocument();
    expect(within(ranking).getAllByText(/^you$/i)).toHaveLength(1);
  });

  it("pins your row into view when you are nowhere near the top", async () => {
    const mine = entry(43, MINE, 61, true);
    respondWithLeaderboard(board(tenOthers(), mine));

    const ranking = await resultScreen();
    const rows = within(ranking).getAllByRole("row");

    // Header, the visible top five, and yours — which the top five does not
    // contain and never would.
    expect(rows).toHaveLength(7);
    const pinned = rows[rows.length - 1] as HTMLElement;
    expect(within(pinned).getByText(MINE)).toBeInTheDocument();
    expect(within(pinned).getAllByRole("cell")[0]).toHaveTextContent("43");
  });

  it("opens the full ranking on request", async () => {
    const user = userEvent.setup();
    respondWithLeaderboard(board(tenOthers()));

    const ranking = await resultScreen();
    expect(within(ranking).getAllByRole("row")).toHaveLength(6);

    await user.click(within(ranking).getByRole("button", { name: /full ranking/i }));

    // All ten, and nothing left to open.
    expect(within(ranking).getAllByRole("row")).toHaveLength(11);
    expect(
      within(ranking).queryByRole("button", { name: /full ranking/i }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the Discipline when too few people have typed the Passage", async () => {
    respondWithLeaderboard({
      passageId: PASSAGE_ID,
      discipline: "QUOTES",
      entries: [],
      participants: 2,
      minimumParticipants: 5,
    });

    const ranking = await resultScreen();

    // No ranking of two. Being second of two says nothing about how anybody
    // types, and the screen says what it is waiting for and where the reading
    // that does mean something lives.
    expect(within(ranking).queryByRole("table")).not.toBeInTheDocument();
    expect(within(ranking).getByText(/5 people have tried it/i)).toBeInTheDocument();
    expect(within(ranking).getByText(/quotes ranking/i)).toBeInTheDocument();
  });

  it("does not take the result screen down when the board will not load", async () => {
    respondLeaderboardUnavailable();
    renderApp(
      <ResultScreen
        run={RUN}
        onRunAgain={() => {}}
        onChangeDiscipline={() => {}}
        onSignIn={() => {}}
        pending={false}
        failed={false}
      />,
    );

    const result = await screen.findByRole("region", { name: /run result/i });

    // The Run is what the player came for and it arrived. A ranking that did
    // not is a line, not a fault screen.
    expect(
      await screen.findByText(/leaderboard for this passage could not be read/i),
    ).toBeVisible();
    // Whole words per minute, which is what the panel prints.
    expect(within(result).getByText("112")).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: /run again/i })).toBeEnabled();
  });
});

/** A backend that deals this Passage and verifies whatever comes back against it. */
function servingARunOf(text: string) {
  server.use(
    http.post("/api/challenges", async ({ request }) => {
      const { discipline } = (await request.json()) as { discipline: "QUOTES" | "PROSE" };
      return HttpResponse.json<Challenge>(
        {
          issueId: "00000000-0000-4000-8000-0000000000a1",
          passage: {
            id: PASSAGE_ID,
            discipline,
            text,
            attribution: "Somebody, Something, 1900",
            characterCount: text.length,
          },
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
        { status: 201 },
      );
    }),
    http.post("/api/typing-runs", () => HttpResponse.json<TypingRun>(RUN, { status: 201 })),
  );
}

beforeEach(() => {
  // The board is fetched the moment the result screen mounts, so a stale cache
  // between tests would answer with the previous test's ranking.
  vi.clearAllMocks();
});

afterEach(useRealClock);
