import type {
  Challenge,
  Discipline,
  Health,
  SolveChallenge,
  SolveRun,
  TypingRun,
} from "@gmc/api-client";
import { useState } from "react";
import { useRequestSolveChallenge } from "../api/patterns.ts";
import { useHealth } from "../api/health.ts";
import { useRequestChallenge } from "../api/typing.ts";
import { ClaimingScreen } from "../auth/ClaimingScreen.tsx";
import { pendingCallback } from "../auth/cognito.ts";
import { SignInScreen } from "../auth/SignInScreen.tsx";
import { PatternBrowser } from "../code/PatternBrowser.tsx";
import { SolveResultScreen } from "../code/SolveResultScreen.tsx";
import { SolveScreen } from "../code/SolveScreen.tsx";
import { Badge } from "../design-system/index.ts";
import { ProfileScreen } from "../profile/ProfileScreen.tsx";
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
  | { name: "result"; run: TypingRun }
  // The Code Discipline has one screen more than the other two, because it is
  // the only one where the player chooses their Challenge rather than being
  // dealt it (ADR-0004).
  | { name: "browsing" }
  | { name: "solving"; challenge: SolveChallenge }
  | { name: "solved"; run: SolveRun }
  // The one screen that is about the player rather than about a Challenge, and
  // the one that would be worth a URL if any of them were.
  | { name: "profile" }
  // Two buttons and nothing else (ADR-0011). Reached only from the
  // contextual prompt after a Run, never from a persistent header nag.
  | { name: "signing-in" }
  // Where the browser lands back from the Hosted UI redirect, carrying an
  // authorization code this app never had a Screen open for — the previous
  // Screen did not survive leaving the page, so there is nothing to return
  // to but here.
  | { name: "claiming" };

/**
 * Choose a Discipline, transcribe the Passage or solve the Pattern, and see what
 * the server made of it.
 */
export function App() {
  // A pending OAuth callback wins over whatever Screen a fresh load would
  // otherwise start on: the browser just came back from the Hosted UI
  // specifically to finish Claiming, and showing the tiles first would strand
  // the authorization code this render is the only chance to consume.
  const [screen, setScreen] = useState<Screen>(() =>
    pendingCallback() ? { name: "claiming" } : { name: "choosing" },
  );
  // Remembered so "Run again" means "another one of these" rather than sending
  // the player back to the tiles to say the same thing twice.
  const [lastPlayed, setLastPlayed] = useState<Discipline>("QUOTES");
  const request = useRequestChallenge();
  const requestPattern = useRequestSolveChallenge();
  // Remembered for the same reason `lastPlayed` is: "Try this Pattern again"
  // should not send the player back through the catalogue to say the same thing.
  const [lastSolved, setLastSolved] = useState<string | null>(null);

  function start(discipline: Discipline) {
    // Code is not dealt out. Picking it opens the catalogue, and asking for a
    // Passage in it would answer "there is nothing here" (ADR-0004).
    if (discipline === "CODE") {
      setScreen({ name: "browsing" });
      return;
    }
    setLastPlayed(discipline);
    request.mutate(discipline, {
      onSuccess: (challenge) => setScreen({ name: "running", challenge }),
    });
  }

  function solve(slug: string) {
    setLastSolved(slug);
    requestPattern.mutate(slug, {
      onSuccess: (challenge) => setScreen({ name: "solving", challenge }),
    });
  }

  return (
    <>
      <RainBackdrop />

      <div className="relative flex min-h-dvh flex-col" style={{ zIndex: "var(--z-content)" }}>
        <Header onOpenProfile={() => setScreen({ name: "profile" })} />

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
              onSignIn={() => setScreen({ name: "signing-in" })}
              pending={request.isPending}
              failed={request.isError}
            />
          )}

          {screen.name === "browsing" && (
            <PatternBrowser
              onStart={solve}
              onLeave={() => setScreen({ name: "choosing" })}
              pending={requestPattern.isPending}
            />
          )}

          {screen.name === "solving" && (
            <SolveScreen
              // Keyed by the Issue, so asking for the same Pattern again is a
              // genuinely new Solve Run: an empty editor and a clock that starts
              // now, rather than the finished Run's state carried forward.
              key={screen.challenge.issueId}
              challenge={screen.challenge}
              onJudged={(run) => setScreen({ name: "solved", run })}
              onLeave={() => setScreen({ name: "browsing" })}
            />
          )}

          {screen.name === "profile" && (
            <ProfileScreen
              // The empty state's single action deals a Passage rather than
              // sending anybody back to the tiles to say what they came here
              // having already decided.
              onStart={() => start(lastPlayed)}
              onLeave={() => setScreen({ name: "choosing" })}
              pending={request.isPending}
              failed={request.isError}
            />
          )}

          {screen.name === "solved" && (
            <SolveResultScreen
              run={screen.run}
              onSolveAgain={() => lastSolved && solve(lastSolved)}
              onPickAnother={() => setScreen({ name: "browsing" })}
              onSignIn={() => setScreen({ name: "signing-in" })}
              pending={requestPattern.isPending}
              failed={requestPattern.isError}
            />
          )}

          {screen.name === "signing-in" && (
            <SignInScreen onCancel={() => setScreen({ name: "choosing" })} />
          )}

          {screen.name === "claiming" && (
            <ClaimingScreen onDone={() => setScreen({ name: "choosing" })} />
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
      <StatusBadge
        isPending={health.isPending}
        isError={health.isError}
        status={health.data?.status}
      />

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

/**
 * The one badge that speaks for the site as a whole.
 *
 * Three primitives rather than the query object, so this says what it needs and
 * nothing about where the caller got it — and stays a component, which a
 * function returning JSX is not: only a component has an identity in the tree,
 * a name in the devtools, and somewhere to put a hook if it ever needs one.
 */
function StatusBadge({
  isPending,
  isError,
  status,
}: {
  isPending: boolean;
  isError: boolean;
  status: Health["status"] | undefined;
}) {
  // `role="status"` so the result is announced when it arrives rather than
  // changing silently in the corner of the screen.
  if (isPending) {
    return (
      <Badge tone="neutral" dot role="status">
        Checking
      </Badge>
    );
  }
  // A request that never arrived is a different failure from a backend
  // reporting itself degraded, and conflating them sends you debugging the
  // wrong service.
  if (isError) {
    return (
      <Badge tone="error" dot role="status">
        Unreachable
      </Badge>
    );
  }
  return (
    <Badge tone={status === "UP" ? "green" : "warning"} dot role="status">
      {status === "UP" ? "Online" : "Degraded"}
    </Badge>
  );
}
