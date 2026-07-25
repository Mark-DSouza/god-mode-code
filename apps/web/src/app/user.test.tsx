import type { User } from "@gmc/api-client";
import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw-server.ts";
import { renderApp } from "../test/render.tsx";
import { App } from "./App.tsx";

/**
 * A visitor arrives and becomes someone.
 *
 * Driven through the rendered application with HTTP intercepted at the network
 * layer, so what is under test is the sequence of real requests the app makes —
 * which is where "creates a second User on every reload" actually hides.
 */
describe("becoming someone", () => {
  /**
   * A stand-in for the backend that remembers who it created, the way the real
   * one remembers through the cookie. Each creation returns a different Handle,
   * so a return visit that quietly created a second User would show a different
   * one and fail the assertion rather than passing by coincidence.
   */
  function backendWithNobodyYet() {
    const handles = ["SPIRALING_MANTIS", "DRIFTING_OTTER"];
    let created: User | null = null;
    let creations = 0;

    server.use(
      http.get("/api/users/me", () =>
        created ? HttpResponse.json(created) : new HttpResponse(null, { status: 404 }),
      ),
      http.post("/api/users", () => {
        created = {
          id: `00000000-0000-4000-8000-00000000000${creations}`,
          handle: handles[creations] ?? "UNEXPECTED_EXTRA",
          claimed: false,
        };
        creations += 1;
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    return { creations: () => creations };
  }

  it("shows a generated Handle on a first visit, without asking for anything", async () => {
    backendWithNobodyYet();

    renderApp(<App />);

    // No form, no prompt, no sign-in wall — the Handle simply appears.
    expect(await screen.findByText("SPIRALING_MANTIS")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the Handle and its avatar tile in the header", async () => {
    backendWithNobodyYet();

    renderApp(<App />);
    const handle = await screen.findByText("SPIRALING_MANTIS");

    // In the header, next to the wordmark — not somewhere else on the page that
    // happens to render the same string.
    const header = screen.getByRole("banner");
    expect(header).toContainElement(handle);

    const tile = screen.getByTestId("user-avatar");
    expect(header).toContainElement(tile);
    expect(tile).toHaveTextContent("SM");
    // Decorative: the Handle beside it already says who this is, and a screen
    // reader announcing "S M" first is noise.
    expect(tile).toHaveAttribute("aria-hidden", "true");
  });

  it("stays one User when two tabs of a new browser arrive at the same moment", async () => {
    const backend = backendWithNobodyYet();

    // Two independent query caches, which is what two tabs are: React Query's
    // own deduplication does not reach across them, so nothing but the cross-tab
    // lock stops both from reading 404 and both from creating.
    const firstTab = renderApp(<App />);
    const secondTab = renderApp(<App />);

    await waitFor(() => {
      const shown = screen.getAllByTestId("user-handle").map((el) => el.textContent);
      expect(shown).toEqual(["SPIRALING_MANTIS", "SPIRALING_MANTIS"]);
    });

    // The whole defect in one assertion. Two creations would mean two Users,
    // one of them holding a cookie the browser has already thrown away — and
    // every Run attributed to it lost with it (ADR-0007).
    expect(backend.creations()).toBe(1);

    firstTab.unmount();
    secondTab.unmount();
  });

  it("says so, rather than rendering blank, when it cannot work out which User you are", async () => {
    server.use(http.get("/api/users/me", () => new HttpResponse(null, { status: 500 })));

    renderApp(<App />);

    // A 500 is not the documented "you are nobody yet", so nothing is created —
    // creating a second User because one lookup failed would strand the Runs the
    // first one already has.
    await waitFor(() => expect(screen.getByTestId("user-handle")).toHaveTextContent("—"));
  });

  it("shows the same Handle on a return visit, and does not create a second User", async () => {
    const backend = backendWithNobodyYet();

    const firstVisit = renderApp(<App />);
    expect(await screen.findByText("SPIRALING_MANTIS")).toBeInTheDocument();
    expect(backend.creations()).toBe(1);

    // Unmounted and rendered again with a cold query cache — the closest the
    // component seam gets to closing the tab and coming back.
    firstVisit.unmount();
    renderApp(<App />);

    expect(await screen.findByText("SPIRALING_MANTIS")).toBeInTheDocument();
    // The load-bearing half. Had the app created another User it would be
    // showing DRIFTING_OTTER, and every Run recorded yesterday would belong to
    // someone who no longer exists.
    expect(backend.creations()).toBe(1);

    // What this seam cannot prove is that the *browser* remembers: the stand-in
    // above hands back the same User without ever reading a cookie. That the
    // cookie exists, is HttpOnly and outlives a restart is asserted at the HTTP
    // boundary (UserEndpointTest) and against a real browser profile
    // (e2e/tests/user.spec.ts).
  });

  it("does not create a User when the backend already knows this browser", async () => {
    // No POST handler is registered, and the harness errors on any unhandled
    // request — so a stray creation fails the test rather than passing quietly.
    server.use(
      http.get("/api/users/me", () =>
        HttpResponse.json<User>({
          id: "00000000-0000-4000-8000-0000000000ff",
          handle: "PERCOLATING_FERRET",
          claimed: false,
        }),
      ),
    );

    renderApp(<App />);

    expect(await screen.findByText("PERCOLATING_FERRET")).toBeInTheDocument();
  });
});
