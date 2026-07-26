import type { Challenge, TypingRun, TypingRunSubmission } from "@gmc/api-client";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App.tsx";
import { server } from "../test/msw-server.ts";
import { renderApp } from "../test/render.tsx";
import { useFakeClock, useRealClock } from "../test/setup.ts";

/**
 * A Typing Run, end to end, driven through the rendered application with real
 * keyboard events and HTTP intercepted at the network layer.
 *
 * Nothing here reaches into the engine. Every assertion is about what a player
 * does — pick a Discipline, watch a countdown, type, get it wrong, fix it — and
 * what the screen does back, which is where this feature can actually be broken.
 */

/** Short enough to type in a test, and with a space in it so a mistyped one can be seen. */
const PASSAGE = "green rain";

const ISSUE_ID = "00000000-0000-4000-8000-0000000000a1";
const PASSAGE_ID = "00000000-0000-4000-8000-0000000000b2";

/**
 * The countdown is three real seconds, and the elapsed clock is read from
 * `Date.now()`. Faking both is what makes "the clock starts on the first
 * keystroke" an assertion rather than a hope — the test can sit through the
 * countdown, wait five more seconds, and demand that the timer still reads zero.
 */
beforeEach(useFakeClock);
afterEach(useRealClock);

function typist() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

/**
 * A backend that issues a Challenge and verifies what comes back.
 *
 * It recomputes WPM and Accuracy from the submission the same way the real one
 * does, rather than echoing a fixture. A stub that answered with a constant
 * would let the result screen show any number at all and still pass.
 */
function backendServing(text = PASSAGE) {
  const submissions: TypingRunSubmission[] = [];

  server.use(
    http.post("/api/challenges", async ({ request }) => {
      const { discipline } = (await request.json()) as { discipline: "QUOTES" | "PROSE" };
      return HttpResponse.json<Challenge>(
        {
          issueId: ISSUE_ID,
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
    http.post("/api/typing-runs", async ({ request }) => {
      const submission = (await request.json()) as TypingRunSubmission;
      submissions.push(submission);

      const correct = [...submission.typedText].filter((char, i) => char === text[i]).length;
      const elapsedMillis = Date.parse(submission.completedAt) - Date.parse(submission.startedAt);

      return HttpResponse.json<TypingRun>(
        {
          id: "00000000-0000-4000-8000-0000000000c3",
          passageId: PASSAGE_ID,
          discipline: "QUOTES",
          wpm: Number((correct / 5 / (elapsedMillis / 60_000)).toFixed(1)),
          accuracy: Number(((correct / submission.keystrokes) * 100).toFixed(1)),
          elapsedMillis,
          keystrokes: submission.keystrokes,
          correctCharacters: correct,
          errors: submission.keystrokes - correct,
          completedAt: submission.completedAt,
        },
        { status: 201 },
      );
    }),
  );

  return { submissions };
}

/** Picks a Discipline and starts, leaving the screen mid-countdown. */
async function startARun(user: ReturnType<typeof typist>, discipline = "Quotes") {
  renderApp(<App />);

  await user.click(await screen.findByRole("button", { name: new RegExp(discipline, "i") }));
  await user.click(screen.getByRole("button", { name: /start run/i }));

  await screen.findByTestId("countdown");
}

/**
 * Sits through the countdown and waits for the typing surface to be live.
 *
 * A second at a time, not one jump of three. Each tick schedules the next one
 * only after React has processed the state change it caused, so a single leap
 * past the whole countdown fires the first timer and finds nothing waiting
 * behind it.
 */
async function countdownEnds() {
  for (let second = 0; second < 3; second++) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
  // The surface, not the input: the input is mounted from the first render so
  // that a phone's keyboard rises with the tap that started the Run, which
  // means its presence says nothing about whether the countdown is over.
  await waitFor(() => expect(screen.getByTestId("typing-field")).toBeInTheDocument());
}

function glyphs() {
  return within(screen.getByTestId("typing-field")).getAllByText(/[\s\S]/, {
    selector: "span[data-state]",
  });
}

function stateOfEachGlyph() {
  return glyphs().map((glyph) => glyph.getAttribute("data-state"));
}

/** The glyph at a position, insisting there is one rather than asserting against undefined. */
function glyphAt(index: number): HTMLElement {
  const glyph = glyphs()[index];
  if (!glyph) throw new Error(`The Passage has no glyph at position ${index}`);
  return glyph;
}

describe("a Typing Run", () => {
  it("goes from choosing a Discipline to a result the server computed", async () => {
    const backend = backendServing();
    const user = typist();

    await startARun(user, "Prose");

    // The countdown runs before the Run. The surface is not typeable yet.
    expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    await countdownEnds();

    // A mistake, noticed and backspaced away, is the ordinary case — not the
    // exceptional one — so it is in the ordinary path.
    await user.keyboard("green r");
    await user.keyboard("x");
    await user.keyboard("{Backspace}");
    await user.keyboard("ain");

    // No submit button was pressed: the Run ends on the final character.
    const result = await screen.findByRole("region", { name: /run result/i });

    // Eleven keystrokes produced ten correct characters, and the server said so.
    expect(within(result).getByText("90.9")).toBeInTheDocument();
    expect(within(result).getByText("1")).toBeInTheDocument();

    expect(backend.submissions).toHaveLength(1);
    expect(backend.submissions[0]?.keystrokes).toBe(11);
    expect(backend.submissions[0]?.typedText).toBe(PASSAGE);
  });

  it("sends raw data and nothing it worked out itself", async () => {
    const backend = backendServing();
    const user = typist();

    await startARun(user);
    await countdownEnds();
    await user.keyboard(PASSAGE);

    await screen.findByRole("region", { name: /run result/i });

    // The whole of ADR-0003 in one assertion. There is no WPM here and no
    // accuracy, because the server would discard them — so the client is not
    // given anywhere to put one.
    expect(Object.keys(backend.submissions[0] ?? {}).sort()).toEqual([
      "completedAt",
      "issueId",
      "keystrokes",
      "startedAt",
      "typedText",
    ]);
  });

  it("starts the clock on the first keystroke, not when the countdown ends", async () => {
    backendServing();
    const user = typist();

    await startARun(user);
    await countdownEnds();

    // Five seconds of reading the Passage, deciding where the semicolon is, or
    // simply not being ready. None of it is a Run.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("Time").previousSibling).toHaveTextContent("0");

    await user.keyboard("g");
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => expect(screen.getByText("Time").previousSibling).toHaveTextContent("2"));
  });

  it("renders each glyph as untyped, correct, wrong or carrying the caret", async () => {
    backendServing("ab");
    const user = typist();

    await startARun(user);
    await countdownEnds();

    // Nothing typed: both untyped, and the caret is on the first.
    expect(stateOfEachGlyph()).toEqual(["untyped", "untyped"]);
    expect(glyphAt(0)).toHaveAttribute("data-caret");

    await user.keyboard("a");
    expect(stateOfEachGlyph()).toEqual(["correct", "untyped"]);
    // The caret moves with the player rather than staying where it started.
    expect(glyphAt(0)).not.toHaveAttribute("data-caret");
    expect(glyphAt(1)).toHaveAttribute("data-caret");
  });

  it("returns a glyph to untyped when it is backspaced away", async () => {
    backendServing("ab");
    const user = typist();

    await startARun(user);
    await countdownEnds();

    await user.keyboard("x");
    expect(stateOfEachGlyph()).toEqual(["wrong", "untyped"]);

    await user.keyboard("{Backspace}");

    // Back to how it was, with the caret returned to it — not left marked wrong
    // for a mistake that is no longer on the screen.
    expect(stateOfEachGlyph()).toEqual(["untyped", "untyped"]);
    expect(glyphAt(0)).toHaveAttribute("data-caret");
  });

  it("marks a wrong glyph by more than its colour, and shows a mistyped space", async () => {
    backendServing();
    const user = typist();

    await startARun(user);
    await countdownEnds();
    await user.keyboard("greenx");

    const wrong = glyphAt(5);
    expect(wrong).toHaveAttribute("data-state", "wrong");

    // ADR-0010, deviation 4. Red against green is the most common form of
    // colour blindness, so hue cannot be the only carrier. No stylesheet is
    // applied under jsdom, so what is observable is the rule the surface binds
    // to the wrong state — and an underline is not a colour.
    expect(wrong.className).toContain("data-[state=wrong]:underline");

    // The other half, and the one that is visible here: a red space is still a
    // space, so a mistyped one is drawn.
    expect(wrong).toHaveTextContent("␣");
  });

  it("changes the progress indicator once there are errors", async () => {
    backendServing();
    const user = typist();

    await startARun(user);
    await countdownEnds();

    const filled = () => screen.getByRole("progressbar").firstElementChild as HTMLElement | null;

    await user.keyboard("g");
    expect(filled()).toHaveClass("bg-accent");

    await user.keyboard("x");
    expect(filled()).toHaveClass("bg-warning");
  });

  it("takes its keystrokes through a genuinely focused form control", async () => {
    backendServing();
    const user = typist();

    await startARun(user);
    await countdownEnds();

    // ADR-0010, deviation 2. Not a focusable div: an on-screen keyboard does not
    // appear for one, so the mobile Run screen the mockups design for would be
    // unplayable, and there would be no paste event to see.
    const input = screen.getByTestId("typing-input");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleName(/type the passage/i);

    // Hidden by opacity rather than by `display` or `visibility`, both of which
    // would make it unfocusable and take the keyboard with them.
    expect(input).toHaveClass("opacity-0");
    expect(input).not.toHaveAttribute("hidden");

    await user.keyboard("gr");
    expect(input).toHaveValue("gr");
  });

  it("offers the Passage to a screen reader as text rather than as a glyph soup", async () => {
    backendServing();
    const user = typist();

    await startARun(user);
    await countdownEnds();

    // Several hundred one-character elements are noise to read aloud, so the
    // surface is hidden and the input points at the Passage instead.
    expect(screen.getByTestId("typing-field")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("typing-input")).toHaveAccessibleDescription(PASSAGE);
  });

  it("says why, rather than crashing, when the server refuses the Run", async () => {
    backendServing();
    const user = typist();
    server.use(
      http.post("/api/typing-runs", () =>
        HttpResponse.json(
          {
            reason: "ISSUE_EXPIRED",
            explanation: "That Challenge was handed out too long ago. Ask for another.",
          },
          { status: 422 },
        ),
      ),
    );

    await startARun(user);
    await countdownEnds();
    await user.keyboard(PASSAGE);

    // A refusal is a documented answer with a reason in it, not a transport
    // failure, and the player is given the way out the reason implies.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/handed out too long ago/i);
    expect(within(alert).getByRole("button", { name: /choose a discipline/i })).toBeInTheDocument();
  });

  it("offers another Run and a change of Discipline once the result is in", async () => {
    backendServing();
    const user = typist();

    await startARun(user);
    await countdownEnds();
    await user.keyboard(PASSAGE);

    const result = await screen.findByRole("region", { name: /run result/i });
    await user.click(within(result).getByRole("button", { name: /run again/i }));

    // A second Challenge, a fresh countdown, and nothing carried over from the
    // Run that just finished.
    await screen.findByTestId("countdown");
    await countdownEnds();
    expect(screen.getByTestId("typing-input")).toHaveValue("");
  });
});
