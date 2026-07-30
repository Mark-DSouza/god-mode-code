import type { Challenge, Profile } from "@gmc/api-client";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { App } from "../app/App.tsx";
import { returningUser, server } from "../test/msw-server.ts";
import { renderApp } from "../test/render.tsx";

/**
 * The profile, driven through the rendered application with HTTP intercepted at
 * the network layer.
 *
 * Every figure on this screen is the server's. Nothing here asserts that the
 * browser can average a list — it asserts that what the backend derived is what
 * the player is shown, which is the part that breaks.
 */

/** Newest first, the way the endpoint sends it: the middle Run was the strongest. */
const HISTORY: Profile["history"] = [
  {
    runId: "00000000-0000-4000-8000-0000000000d1",
    discipline: "PROSE",
    wpm: 120,
    completedAt: "2026-07-03T10:00:00Z",
  },
  {
    runId: "00000000-0000-4000-8000-0000000000d2",
    discipline: "QUOTES",
    wpm: 148,
    completedAt: "2026-07-02T10:00:00Z",
  },
  {
    runId: "00000000-0000-4000-8000-0000000000d3",
    discipline: "CODE",
    wpm: 96,
    verdict: "passed",
    completedAt: "2026-07-01T10:00:00Z",
  },
];

const PLAYED: Profile = {
  user: returningUser,
  personalBests: [
    { discipline: "QUOTES", wpm: 148 },
    { discipline: "PROSE", wpm: 120 },
    { discipline: "CODE", wpm: 96 },
  ],
  bestAccuracy: 99.2,
  recentAverageWpm: 121.3,
  history: HISTORY,
};

/**
 * A User who exists and has never played.
 *
 * Empty lists and absent figures, not zeroes — which is what the endpoint
 * actually answers, and the distinction the empty state depends on.
 */
const NEVER_PLAYED: Profile = {
  user: returningUser,
  personalBests: [],
  history: [],
};

function backendServing(profile: Profile) {
  server.use(http.get("/api/profile", () => HttpResponse.json(profile)));
}

/** Opens the profile the way a player does: the identity in the header. */
async function openProfile(user: ReturnType<typeof userEvent.setup>) {
  renderApp(<App />);
  await user.click(await screen.findByRole("button", { name: /your profile/i }));
  return screen.findByRole("region", { name: /profile/i });
}

describe("the profile", () => {
  it("shows who you are, your best, where you are lately, and the shape of your Runs", async () => {
    backendServing(PLAYED);
    const user = userEvent.setup();

    const profile = await openProfile(user);

    // Whose profile this is. The Handle is the answer, and the tile beside it
    // is decorative — it says the same thing in two letters.
    expect(
      await within(profile).findByRole("heading", { name: returningUser.handle }),
    ).toBeInTheDocument();
    expect(within(profile).getByTestId("profile-avatar")).toHaveTextContent("PF");

    // The three readouts. The all-time best names the Discipline it came from,
    // because a best is held within one and never across them.
    expect(within(profile).getByText("148")).toBeInTheDocument();
    expect(within(profile).getByText(/all-time best · quotes/i)).toBeInTheDocument();
    expect(within(profile).getByText("121")).toBeInTheDocument();
    expect(within(profile).getByText("99.2")).toBeInTheDocument();
  });

  it("draws the recent Runs oldest first, with the strongest one emphasised", async () => {
    backendServing(PLAYED);
    const user = userEvent.setup();

    await openProfile(user);

    // A chart is an image with something to say, not a decorative box: the
    // summary is what somebody who cannot see it gets instead.
    const chart = await screen.findByRole("img", { name: /last 3 runs by wpm, oldest first/i });

    // Time reads left to right, so the newest-first payload is reversed.
    const bars = [...chart.querySelectorAll("[title]")];
    expect(bars.map((bar) => bar.getAttribute("title"))).toEqual(["96", "148", "120"]);

    // The peak is drawn differently from every other bar. Which classes do it is
    // the design system's business; that it is not drawn the same is this
    // screen's whole point.
    const peak = bars.find((bar) => bar.getAttribute("title") === "148");
    expect(peak).toBeDefined();
    expect(
      bars.filter((bar) => bar !== peak).every((bar) => bar.className !== peak?.className),
    ).toBe(true);
  });

  it("does not emphasise a Run that does not count, however fast it was typed", async () => {
    backendServing({
      ...PLAYED,
      // The tallest bar in this window is a Solve Run that failed. It happened
      // and belongs in the shape, but only Passed Solve Runs are ranked — and
      // calling it the peak would put a bigger number on the chart than the
      // all-time best printed above it.
      history: [
        {
          runId: "00000000-0000-4000-8000-0000000000d4",
          discipline: "CODE",
          wpm: 200,
          verdict: "failed",
          completedAt: "2026-07-04T10:00:00Z",
        },
        ...HISTORY,
      ],
    });
    const user = userEvent.setup();

    await openProfile(user);

    const chart = await screen.findByRole("img", { name: /last 4 runs by wpm/i });
    const bars = [...chart.querySelectorAll("[title]")];
    const failed = bars.find((bar) => bar.getAttribute("title") === "200");
    const ranked = bars.find((bar) => bar.getAttribute("title") === "148");

    expect(chart).toHaveAccessibleName(/strongest ranked run, at 148/i);
    expect(failed?.className).not.toBe(ranked?.className);
    // Every other bar is drawn the way the failed one is: dim. The emphasis is
    // on 148, and there is exactly one of it.
    expect(bars.filter((bar) => bar.className === ranked?.className)).toHaveLength(1);
  });

  it("greets a User with no Runs as a beginning, with one thing to do about it", async () => {
    backendServing(NEVER_PLAYED);
    let challenges = 0;
    server.use(
      http.post("/api/challenges", () => {
        challenges += 1;
        return HttpResponse.json<Challenge>(
          {
            issueId: "00000000-0000-4000-8000-0000000000e1",
            passage: {
              id: "00000000-0000-4000-8000-0000000000e2",
              discipline: "QUOTES",
              text: "green rain",
              attribution: "Somebody, Something, 1900",
              characterCount: 10,
            },
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();

    const profile = await openProfile(user);

    // No chart, no zeroes, no empty axes. A profile that read "0 wpm · 0%"
    // would be reporting a failure the player has not had.
    expect(
      await within(profile).findByRole("heading", { name: /nothing logged yet/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /runs by wpm/i })).not.toBeInTheDocument();
    expect(within(profile).queryByText(/all-time best/i)).not.toBeInTheDocument();

    // One action, and it starts a Run rather than sending anybody back to a
    // menu to choose what they already came here to do.
    await user.click(within(profile).getByRole("button", { name: /start your first run/i }));

    expect(challenges).toBe(1);
    expect(await screen.findByTestId("countdown")).toBeInTheDocument();
  });

  it("says the backend did not answer rather than showing a profile of nothing", async () => {
    server.use(http.get("/api/profile", () => HttpResponse.error()));
    const user = userEvent.setup();

    await openProfile(user);

    // An unreadable profile is a fault, and an empty one is a beginning. Showing
    // the second when it is the first tells a returning player their Runs are
    // gone.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not read your profile/i);
    expect(screen.queryByRole("heading", { name: /nothing logged yet/i })).not.toBeInTheDocument();
  });
});
