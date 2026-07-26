import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render.tsx";
import { respondDegraded, respondJudgeDown, respondUnreachable } from "../test/msw-server.ts";
import { setPrefersReducedMotion } from "../test/setup.ts";
import { App } from "./App.tsx";

/**
 * The frontend test seam: the rendered application, with HTTP intercepted at
 * the network layer.
 */
describe("the walking skeleton", () => {
  it("reports the backend online once it answers", async () => {
    renderApp(<App />);

    // Pending first — proving the screen renders before the response lands,
    // rather than blocking on it.
    expect(screen.getByRole("status")).toHaveTextContent(/checking/i);

    // Scoped to the status badge on purpose: the heading also says "System
    // online", and a loose text match would pass without the backend ever
    // having answered.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^online$/i));
    expect(screen.getByText("0.0.1-test")).toBeInTheDocument();
  });

  it("distinguishes a degraded backend from an unreachable one", async () => {
    respondDegraded();
    const { unmount } = renderApp(<App />);

    // A 503 is the backend answering. The version still renders, because the
    // backend told us what it is.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/degraded/i));
    expect(screen.getByText("0.0.1-test")).toBeInTheDocument();
    unmount();

    respondUnreachable();
    renderApp(<App />);

    // No answer at all is a different fault, and pointing an operator at the
    // database when the API is down wastes the first ten minutes of an outage.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/unreachable/i));
  });

  it("stays online when only the judge is down", async () => {
    respondJudgeDown();
    renderApp(<App />);

    // The Code Discipline is unavailable and nothing else is. A badge that read
    // "Degraded" here would be telling players the site is broken because a
    // container host on a routeless subnet is unwell (ADR-0005).
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^online$/i));

    const judge = screen.getByText("Judge").parentElement;
    expect(judge).toHaveTextContent(/degraded/i);
  });

  it("calls the backend on the same origin, under /api", async () => {
    // Nothing may introduce a cross-origin request: there is one origin by
    // design, and a hostname appearing here is the first step back to CORS
    // (ADR-0002). MSW is set to error on any unhandled request, and the only
    // handler registered is the same-origin /api/health one — so reaching the
    // online state is itself the assertion that no other request went out.
    renderApp(<App />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^online$/i));
  });
});

describe("the digital rain", () => {
  it("renders behind the screen by default", async () => {
    setPrefersReducedMotion(false);
    renderApp(<App />);

    const rain = await screen.findByTestId("digital-rain");
    expect(rain).toBeInTheDocument();
    // Decorative: it must never reach the accessibility tree.
    expect(rain).toHaveAttribute("aria-hidden", "true");
  });

  it("is off by default when the operating system asks for reduced motion", async () => {
    setPrefersReducedMotion(true);
    renderApp(<App />);

    await screen.findByText(/online/i);
    // ADR-0010: the effect animates continuously behind every screen and
    // intensifies with WPM, which is a genuine problem for anyone with
    // vestibular sensitivity.
    expect(screen.queryByTestId("digital-rain")).not.toBeInTheDocument();
  });

  it("still honours an explicit choice to turn it back on", async () => {
    setPrefersReducedMotion(true);
    const { RainBackdrop } = await import("./RainBackdrop.tsx");
    renderApp(<RainBackdrop enabled />);

    // The system preference sets the default; it does not overrule someone who
    // went to Settings and asked for rain.
    await waitFor(() => expect(screen.getByTestId("digital-rain")).toBeInTheDocument());
  });
});
