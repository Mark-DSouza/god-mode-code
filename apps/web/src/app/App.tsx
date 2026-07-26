import type { Challenge, Discipline, TypingRun } from "@gmc/api-client";
import { useState } from "react";
import { useHealth } from "../api/health.ts";
import { useRequestChallenge } from "../api/typing.ts";
import { Badge } from "../design-system/index.ts";
import { HomeScreen } from "../run/HomeScreen.tsx";
import { ResultScreen } from "../run/ResultScreen.tsx";
import { RunScreen } from "../run/RunScreen.tsx";
import { Header } from "./Header.tsx";
import { RainBackdrop } from "./RainBackdrop.tsx";

/**
 * Where the player is.
 *
 * Component state rather than a router, because none of these are places you
 * can link to. A Challenge is issued to one User for one sitting and expires;
 * a URL that reissued it on load would spend a fresh Issue on every refresh,
 * and a URL that did not would be a link to somebody else's Passage.
 */
type Screen =
  | { name: "choosing" }
  | { name: "running"; challenge: Challenge }
  | { name: "result"; run: TypingRun };

/**
 * Choose a Discipline, type the Passage, see what the server made of it.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "choosing" });
  // Remembered so "Run again" means "another one of these" rather than sending
  // the player back to the tiles to say the same thing twice.
  const [lastPlayed, setLastPlayed] = useState<Discipline>("QUOTES");
  const request = useRequestChallenge();

  function start(discipline: Discipline) {
    setLastPlayed(discipline);
    request.mutate(discipline, {
      onSuccess: (challenge) => setScreen({ name: "running", challenge }),
    });
  }

  return (
    <>
      <RainBackdrop />

      <div className="relative flex min-h-dvh flex-col" style={{ zIndex: "var(--z-content)" }}>
        <Header />

        <main className="mx-auto flex w-full max-w-[var(--container-app)] flex-1 flex-col justify-center gap-6 px-5 py-9">
          {screen.name === "choosing" && (
            <HomeScreen
              status={<BackendStatus />}
              onStart={start}
              pending={request.isPending}
              failed={request.isError}
            />
          )}

          {screen.name === "running" && (
            <RunScreen
              // Keyed by the Issue so that asking for another Passage starts a
              // genuinely new Run: same component, but a fresh countdown, an
              // empty surface and a clock that has not started. Without this,
              // "Run again" would inherit the finished Run's state.
              key={screen.challenge.issueId}
              challenge={screen.challenge}
              onRecorded={(run) => setScreen({ name: "result", run })}
              onLeave={() => setScreen({ name: "choosing" })}
            />
          )}

          {screen.name === "result" && (
            <ResultScreen
              run={screen.run}
              onRunAgain={() => start(lastPlayed)}
              onChangeDiscipline={() => setScreen({ name: "choosing" })}
              pending={request.isPending}
              failed={request.isError}
            />
          )}
        </main>
      </div>
    </>
  );
}

/**
 * Whether the backend is answering, in the pill the mockups put above the
 * headline.
 *
 * The design draws this as decoration reading "System online". It is wired to
 * the real health endpoint instead, because a status light that is always green
 * is worse than no status light: the one moment it matters is the one moment it
 * would be lying.
 */
function BackendStatus() {
  const health = useHealth();
  const judge = health.data?.judge;

  return (
    <div className="flex flex-col items-center gap-3">
      {overallBadge(health)}

      {/* The judge is a dependency of exactly one Discipline, so it is reported
          apart from the badge above rather than folded into it. A degraded judge
          means Patterns are unavailable and everything else is fine — a sentence
          the overall status cannot say, and the reason the badge stays green
          (ADR-0005).

          Shown only when it is not well. The walking skeleton carried this in a
          permanent readout beside Database and Version, which was a diagnostic
          panel; this screen is the product, and a line that reads "JUDGE: UP"
          forever tells a player nothing they can act on. The moment it has
          something to say, it says it. */}
      {judge && judge !== "UP" && (
        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-lg tracking-wide text-error [text-shadow:var(--glow-error)]">
            {judge}
          </span>
          <span className="font-display text-2xs tracking-wider text-muted uppercase">Judge</span>
        </div>
      )}
    </div>
  );
}

/** The one badge that speaks for the site as a whole. */
function overallBadge(health: ReturnType<typeof useHealth>) {
  // `role="status"` so the result is announced when it arrives rather than
  // changing silently in the corner of the screen.
  if (health.isPending) {
    return (
      <Badge tone="neutral" dot role="status">
        Checking
      </Badge>
    );
  }
  // A request that never arrived is a different failure from a backend
  // reporting itself degraded, and conflating them sends you debugging the
  // wrong service.
  if (health.isError) {
    return (
      <Badge tone="error" dot role="status">
        Unreachable
      </Badge>
    );
  }
  return (
    <Badge tone={health.data?.status === "UP" ? "green" : "warning"} dot role="status">
      {health.data?.status === "UP" ? "Online" : "Degraded"}
    </Badge>
  );
}
