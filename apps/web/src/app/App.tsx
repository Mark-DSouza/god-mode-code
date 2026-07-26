import { useHealth } from "../api/health.ts";
import { Badge, Card, Kbd } from "../design-system/index.ts";
import { Header } from "./Header.tsx";
import { RainBackdrop } from "./RainBackdrop.tsx";

/**
 * The walking skeleton.
 *
 * Deliberately not the home screen — no Disciplines, no Challenges, nothing
 * that pretends the product exists. What it proves is the whole path: a browser
 * loads the built bundle, the bundle calls the backend on the same origin, the
 * backend answers from a migrated database, and the design foundation renders
 * underneath all of it.
 */
export function App() {
  const health = useHealth();

  return (
    <>
      <RainBackdrop />

      <div className="relative flex min-h-dvh flex-col" style={{ zIndex: "var(--z-content)" }}>
        <Header />

        <main className="mx-auto flex w-full max-w-[var(--container-app)] flex-1 flex-col justify-center gap-6 px-5 py-9">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-2xl tracking-wider text-heading uppercase [text-shadow:var(--glow-md)]">
              System online
            </h1>
            <p className="max-w-[60ch] font-body text-md text-muted">
              The rain is falling and the backend is answering. Nothing else is built yet.
            </p>
          </div>

          {/* No `glow`. In the mockups the bright green ring is the selected
              state — it is what marks the chosen discipline tile apart from the
              two beside it. A resting panel carries the hairline border only,
              and glowing this one would mean "selected" with nothing to select. */}
          <Card scanlines className="flex flex-col gap-5" aria-labelledby="status-heading">
            <div className="flex items-center justify-between gap-4">
              <h2
                id="status-heading"
                className="font-display text-sm tracking-wider text-muted uppercase"
              >
                Backend status
              </h2>
              <StatusBadge
                isPending={health.isPending}
                isError={health.isError}
                status={health.data?.status}
              />
            </div>

            {/* Not `Stat`. That component is the oversized CRT numeral readout —
                every use of it in the design is a number (78 wpm, 99.1%, 12s),
                and VT323 is a numeral face. Setting a status word and a version
                string in it reads as a rendering fault rather than a style.
                These are labelled values, so they are set as labelled values. */}
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Readout
                label="Database"
                value={health.isPending ? "—" : (health.data?.database ?? "?")}
                tone={health.data?.database === "UP" ? "accent" : "error"}
              />
              {/* The judge is a dependency of exactly one Discipline, so it gets
                  its own readout rather than being folded into the badge above.
                  A degraded judge means Patterns are unavailable and everything
                  else is fine — which is a sentence the overall status cannot
                  say, and the reason the badge stays green (ADR-0005). */}
              <Readout
                label="Judge"
                value={health.isPending ? "—" : (health.data?.judge ?? "?")}
                tone={health.data?.judge === "UP" ? "accent" : "error"}
              />
              <Readout
                label="Version"
                value={health.isPending ? "—" : (health.data?.version ?? "?")}
                tone="heading"
              />
            </div>
          </Card>

          <p className="font-body text-sm text-disabled">
            Press <Kbd>Enter</Kbd> to start a run — once there is something to run.
          </p>
        </main>
      </div>
    </>
  );
}

/**
 * A labelled value, using the design's label treatment: a small uppercased
 * wide-tracked caption under the value, the same pairing the run screen puts
 * beneath SPEED and ACCURACY.
 */
function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "error" | "heading";
}) {
  const toneClass = {
    accent: "text-accent [text-shadow:var(--glow-sm)]",
    error: "text-error [text-shadow:var(--glow-error)]",
    heading: "text-heading",
  }[tone];

  return (
    <div className="flex flex-col gap-1">
      <span className={`font-display text-lg tracking-wide ${toneClass}`}>{value}</span>
      <span className="font-display text-2xs tracking-wider text-muted uppercase">{label}</span>
    </div>
  );
}

function StatusBadge({
  isPending,
  isError,
  status,
}: {
  isPending: boolean;
  isError: boolean;
  status: "UP" | "DEGRADED" | undefined;
}) {
  // `role="status"` so the result is announced when it arrives, rather than
  // changing silently for anyone not watching this corner of the screen.
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
