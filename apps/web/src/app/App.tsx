import { useHealth } from "../api/health.ts";
import { Badge, Card, Kbd, Stat, Wordmark } from "../design-system/index.ts";
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
        <header className="border-b border-line px-5 py-4 backdrop-blur-[2px]">
          <Wordmark size={20} />
        </header>

        <main className="mx-auto flex w-full max-w-[var(--container-app)] flex-1 flex-col justify-center gap-6 px-5 py-9">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-2xl tracking-wider text-heading uppercase [text-shadow:var(--glow-md)]">
              System online
            </h1>
            <p className="max-w-[60ch] font-body text-md text-muted">
              The rain is falling and the backend is answering. Nothing else is built yet.
            </p>
          </div>

          <Card glow scanlines className="flex flex-col gap-5" aria-labelledby="status-heading">
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

            {/* A plain grid, not a <dl>. Stat renders its own value and label
                as sibling spans, so wrapping it in a description list would
                produce a <dl> with no <dt>/<dd> children at all — invalid, and
                announced as an empty list by a screen reader. */}
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Stat
                align="left"
                size="sm"
                accent={health.data?.database === "UP" ? "green" : "error"}
                value={health.isPending ? "—" : (health.data?.database ?? "?")}
                label="Database"
              />
              <Stat
                align="left"
                size="sm"
                accent="white"
                value={health.isPending ? "—" : (health.data?.version ?? "?")}
                label="Version"
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
