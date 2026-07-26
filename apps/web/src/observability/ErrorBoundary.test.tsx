import * as Sentry from "@sentry/react";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../test/render.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

vi.mock("@sentry/react", () => ({ init: vi.fn(), captureException: vi.fn() }));

const captureException = vi.mocked(Sentry.captureException);

function Exploding(): never {
  throw new Error("the deliberately triggered failure");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    captureException.mockClear();
    // React logs the caught error itself. Silenced so a passing test does not
    // print a stack trace that reads like a failure.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows something rather than a blank page when a render fails", () => {
    renderApp(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    // A white screen is the worst failure mode a single-page application has:
    // nothing is on screen, nothing is in a server log, and whoever hit it has
    // no idea whether it was them or us.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("reports the failure rather than only displaying it", () => {
    renderApp(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((captureException.mock.calls[0]?.[0] as Error).message).toBe(
      "the deliberately triggered failure",
    );
  });

  it("keeps its children on screen when nothing throws", () => {
    renderApp(
      <ErrorBoundary>
        <p>everything is fine</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("everything is fine")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(captureException).not.toHaveBeenCalled();
  });
});
