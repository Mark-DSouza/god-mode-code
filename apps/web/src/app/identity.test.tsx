import type { User } from "@gmc/api-client";
import { screen } from "@testing-library/react";
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

    const tile = screen.getByTestId("identity-avatar");
    expect(header).toContainElement(tile);
    expect(tile).toHaveTextContent("SM");
    // Decorative: the Handle beside it already says who this is, and a screen
    // reader announcing "S M" first is noise.
    expect(tile).toHaveAttribute("aria-hidden", "true");
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
