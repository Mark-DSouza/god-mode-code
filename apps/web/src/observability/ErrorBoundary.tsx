import * as Sentry from "@sentry/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Card } from "../design-system/index.ts";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * The last thing between a render failure and a white screen.
 *
 * A blank page is the worst failure mode a single-page application has: nothing
 * is on screen, nothing reaches a server log, and whoever is looking at it
 * cannot tell whether it was them or us. This puts something on screen and, more
 * importantly, tells us it happened.
 *
 * Written as a class because React offers no hook for this — `componentDidCatch`
 * has no function-component equivalent.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // `captureException` on a reporter that was never initialised is a no-op,
    // which is what lets this component stay unaware of whether a DSN was
    // configured for this build.
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[var(--container-app)] flex-col justify-center px-5 py-9">
        {/* `alert`, so a screen reader is told rather than left on a page that
            silently stopped being the page it was. */}
        <Card role="alert" className="flex flex-col items-start gap-5">
          <h1 className="font-display text-xl tracking-wider text-error uppercase [text-shadow:var(--glow-error)]">
            Something broke
          </h1>
          <p className="max-w-[60ch] font-body text-md text-muted">
            The fault has been reported. Reloading usually gets you moving again.
          </p>
          {/* A full reload rather than a state reset: whatever invariant the
              render tore is still torn, and resetting the boundary would drop
              them straight back into it. */}
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Card>
      </div>
    );
  }
}
