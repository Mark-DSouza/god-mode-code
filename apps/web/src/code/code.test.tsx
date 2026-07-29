import type { Pattern, SolveChallenge, SolveRun, SolveRunSubmission } from "@gmc/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { App } from "../app/App.tsx";
import { server } from "../test/msw-server.ts";
import { renderApp } from "../test/render.tsx";

/**
 * The Code Discipline, driven through the rendered application with real
 * keyboard events and HTTP intercepted at the network layer.
 *
 * Nothing here reaches into a hook. Every assertion is about what a player does
 * — pick a Family, narrow by Seniority, read the contract, write four lines,
 * submit — and what the screen does back, which is where this feature can
 * actually be broken.
 */

const ISSUE_ID = "00000000-0000-4000-8000-0000000000d1";

const HASH_MAP: Pattern = {
  id: "00000000-0000-4000-8000-0000000000e1",
  slug: "hash-map-seen-lookup",
  name: "Store what you've seen, look up what you need",
  family: "HASH_MAP",
  seniority: "JUNIOR",
  prompt: "Make one pass and remember what you walked past.\n\nReturn the two indices.",
  scaffold: "def pair_sum(numbers, target):",
  exampleTests: [
    {
      name: "the pair is the first two numbers",
      call: "pair_sum([2, 7, 11, 15], 9)",
      expected: "[0, 1]",
    },
    { name: "no pair sums to the target", call: "pair_sum([1, 2, 3], 100)", expected: "[]" },
  ],
};

const SLIDING_WINDOW: Pattern = {
  id: "00000000-0000-4000-8000-0000000000e2",
  slug: "sliding-window-longest-unique",
  name: "Grow the window until it breaks",
  family: "SLIDING_WINDOW",
  seniority: "SENIOR",
  prompt: "Two edges, one moving at a time.",
  scaffold: "def longest_unique(text):",
  exampleTests: [
    { name: "slides past a repeat", call: "longest_unique('abcabcbb')", expected: "3" },
  ],
};

/**
 * A backend serving a two-Pattern catalogue that really applies the filters.
 *
 * Filtering server-side rather than echoing the whole list, because that is what
 * the real one does — a stub that ignored the query would let the browse screen
 * send anything at all and still pass.
 */
function backendServing(verdict: SolveRun["verdict"] = "passed", testsPassed = 6) {
  const submissions: SolveRunSubmission[] = [];

  server.use(
    http.get("/api/patterns", ({ request }) => {
      const query = new URL(request.url).searchParams;
      const family = query.get("family");
      const seniority = query.get("seniority");
      return HttpResponse.json<Pattern[]>(
        [HASH_MAP, SLIDING_WINDOW].filter(
          (pattern) =>
            (family === null || pattern.family === family) &&
            (seniority === null || pattern.seniority === seniority),
        ),
      );
    }),
    http.post("/api/patterns/:slug/challenges", ({ params }) => {
      const pattern = params.slug === HASH_MAP.slug ? HASH_MAP : SLIDING_WINDOW;
      return HttpResponse.json<SolveChallenge>(
        { issueId: ISSUE_ID, pattern, expiresAt: new Date(Date.now() + 1_200_000).toISOString() },
        { status: 201 },
      );
    }),
    http.post("/api/solve-runs", async ({ request }) => {
      const submission = (await request.json()) as SolveRunSubmission;
      submissions.push(submission);

      const elapsedMillis = Date.parse(submission.completedAt) - Date.parse(submission.startedAt);
      return HttpResponse.json<SolveRun>(
        {
          id: "00000000-0000-4000-8000-0000000000f1",
          patternId: HASH_MAP.id,
          patternSlug: HASH_MAP.slug,
          verdict,
          testsPassed,
          testsTotal: 6,
          elapsedMillis: Math.max(elapsedMillis, 1),
          keystrokes: submission.keystrokes,
          wpm: 33.5,
          completedAt: submission.completedAt,
          // The announcement has its own test on the Typing Run's result screen,
          // which is the same component and the same claim. Here it stays off so
          // these tests are about the Verdict.
          personalBest: false,
        },
        { status: 201 },
      );
    }),
  );

  return { submissions };
}

/** Goes from the tiles to the catalogue. */
async function browseThePatterns(user: ReturnType<typeof userEvent.setup>) {
  renderApp(<App />);
  await user.click(await screen.findByRole("button", { name: /code/i }));
  await user.click(screen.getByRole("button", { name: /browse patterns/i }));
  return screen.findByRole("region", { name: /patterns/i });
}

/** Goes all the way to the editor, with the Hash Map Pattern on screen. */
async function startSolving(user: ReturnType<typeof userEvent.setup>) {
  await browseThePatterns(user);
  // Scoped to the Pattern's own row: every entry has a Solve button, and
  // clicking whichever one came first would stop being this Pattern the moment
  // the catalogue grew.
  const row = (await screen.findByRole("heading", { name: HASH_MAP.name })).closest("li");
  if (!row) throw new Error("the Pattern was not listed as an entry");
  await user.click(within(row).getByRole("button", { name: /solve/i }));
  return screen.findByRole("region", { name: /solve run/i });
}

function editor(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: /write your solution/i }) as HTMLTextAreaElement;
}

describe("browsing the Pattern catalogue", () => {
  it("groups the Patterns by Family", async () => {
    backendServing();
    const user = userEvent.setup();

    await browseThePatterns(user);

    // A tab per Family that has something in it, and the first one is what you
    // are looking at.
    expect(await screen.findByRole("tab", { name: "Hash Map" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Sliding Window" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: HASH_MAP.name })).toBeInTheDocument();

    // Family is navigation: it replaces what is listed.
    await user.click(screen.getByRole("tab", { name: "Sliding Window" }));
    expect(await screen.findByRole("heading", { name: SLIDING_WINDOW.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: HASH_MAP.name })).not.toBeInTheDocument();
  });

  it("narrows what is listed by Seniority", async () => {
    backendServing();
    const user = userEvent.setup();

    await browseThePatterns(user);
    await screen.findByRole("heading", { name: HASH_MAP.name });

    // Seniority narrows rather than navigating, so a band this Family has
    // nothing in says so instead of showing an empty page.
    await user.selectOptions(screen.getByRole("combobox", { name: /seniority/i }), "SENIOR");
    expect(await screen.findByText(/nothing at that seniority/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /seniority/i }), "JUNIOR");
    expect(await screen.findByRole("heading", { name: HASH_MAP.name })).toBeInTheDocument();
  });
});

describe("solving a Pattern", () => {
  it("shows the contract before the player starts", async () => {
    backendServing();
    const user = userEvent.setup();

    const solving = await startSolving(user);

    // The prompt and the Example Tests, before a line is written. Being judged
    // against a contract you were not shown is the thing this prevents.
    expect(within(solving).getByText(/make one pass/i)).toBeInTheDocument();
    expect(within(solving).getByText(/pair_sum\(\[2, 7, 11, 15\], 9\)/)).toBeInTheDocument();
    expect(within(solving).getByText(/hidden tests are run too/i)).toBeInTheDocument();
  });

  it("keeps the Scaffold out of reach and takes what is written below it", async () => {
    const backend = backendServing();
    const user = userEvent.setup();

    await startSolving(user);

    // One writable region on the screen. The Scaffold is rendered text, not a
    // disabled field — there is no caret to guard rather than a guard to get
    // right.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByText(HASH_MAP.scaffold)).toBeInTheDocument();

    // Focus goes to the editable region, never through the locked lines.
    await user.click(editor());
    await user.keyboard("    return None");

    expect(editor()).toHaveValue("    return None");
    // The locked lines are exactly as they were: nothing typed could reach
    // them, so the signature the tests call is still the one the Pattern
    // shipped.
    expect(screen.getByText(HASH_MAP.scaffold)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await screen.findByRole("region", { name: /solve run result/i });

    // The Scaffold is not sent back. The server has it, and a client that could
    // send one could rewrite the function signature its own tests call.
    expect(backend.submissions).toHaveLength(1);
    expect(backend.submissions[0]?.source).toBe("    return None");
    expect(Object.keys(backend.submissions[0] ?? {}).sort()).toEqual([
      "completedAt",
      "issueId",
      "keystrokes",
      "source",
      "startedAt",
    ]);
  });

  it("says on a phone that this Discipline wants a keyboard", async () => {
    backendServing();
    const user = userEvent.setup();

    await browseThePatterns(user);

    // Rendered, not hidden behind a width the component measured — the note is
    // in the markup and CSS decides who sees it, which is correct on the first
    // paint rather than after an effect has run.
    expect(await screen.findByText(/suits a desktop/i)).toBeInTheDocument();
  });

  it("reports the keystrokes it counted, without rounding them up to the source", async () => {
    const backend = backendServing();
    const user = userEvent.setup();

    await startSolving(user);
    await user.click(editor());
    // Written, half of it deleted, then written again — the ordinary shape of
    // getting it wrong once.
    await user.keyboard("    return Nope{Backspace}{Backspace}{Backspace}one");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await screen.findByRole("region", { name: /solve run result/i });

    const submitted = backend.submissions[0];
    expect(submitted?.source).toBe("    return None");
    // Every character produced, deletions excluded and corrections counted
    // again: eighteen presses for fifteen characters. A count the client had
    // quietly raised to match the source would be the paste signal ADR-0004
    // wants kept, thrown away before it left the browser.
    expect(submitted?.keystrokes).toBe(18);
  });

  it("indents on Tab, because Python is not writable without it", async () => {
    backendServing();
    const user = userEvent.setup();

    await startSolving(user);
    await user.click(editor());
    await user.keyboard("{Tab}return None");

    // Four spaces, and focus stayed where it was — a Tab that moved on would
    // make the function body unreachable from the keyboard.
    expect(editor()).toHaveValue("    return None");
    expect(editor()).toHaveFocus();
  });
});

describe("the Solve Run result", () => {
  it("makes the Verdict the hero and has no Accuracy at all", async () => {
    backendServing("passed", 6);
    const user = userEvent.setup();

    await startSolving(user);
    await user.click(editor());
    await user.keyboard("    return None");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    const result = await screen.findByRole("region", { name: /solve run result/i });

    expect(within(result).getByRole("heading", { name: /passed/i })).toBeInTheDocument();
    expect(within(result).getByText("6/6")).toBeInTheDocument();
    expect(within(result).getByText("Tests")).toBeInTheDocument();
    expect(within(result).getByText("34")).toBeInTheDocument();

    // A Solve Run has no target text to be accurate against (ADR-0006). Neither
    // figure is here, and neither is an empty cell where one would be.
    expect(within(result).queryByText(/accuracy/i)).not.toBeInTheDocument();
    expect(within(result).queryByText(/errors/i)).not.toBeInTheDocument();
  });

  it("reports a failure as a Verdict and a count, never as which tests", async () => {
    backendServing("failed", 2);
    const user = userEvent.setup();

    await startSolving(user);
    await user.click(editor());
    await user.keyboard("    return None");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    const result = await screen.findByRole("region", { name: /solve run result/i });

    // A Failed Solve Run is a recorded Run, not an error screen: it has a
    // Verdict, a count and somewhere to go next.
    expect(within(result).getByRole("heading", { name: /failed/i })).toBeInTheDocument();
    expect(within(result).getByText("2/6")).toBeInTheDocument();
    expect(
      within(result).getByRole("button", { name: /try this pattern again/i }),
    ).toBeInTheDocument();
  });

  it("keeps the Challenge when the judge cannot be reached", async () => {
    backendServing();
    server.use(
      http.post("/api/solve-runs", () =>
        HttpResponse.json(
          { explanation: "The judge could not be reached. Your Challenge is still yours." },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();

    await startSolving(user);
    await user.click(editor());
    await user.keyboard("    return None");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    // Not an interruption and not a lost Run. The lines are still on screen and
    // the button still works, because nothing about them was wrong.
    await waitFor(() => expect(screen.getByText(/still yours/i)).toBeInTheDocument());
    expect(editor()).toHaveValue("    return None");
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeEnabled();
  });
});
