import type { TypingRun, User } from "@gmc/api-client";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultScreen } from "../run/ResultScreen.tsx";
import { returningUser, server } from "../test/msw-server.ts";
import { renderApp } from "../test/render.tsx";
import { ClaimingScreen } from "./ClaimingScreen.tsx";
import { prepareSignIn } from "./cognito.ts";
import { SignInScreen } from "./SignInScreen.tsx";

/**
 * Signing in and Claiming, driven through the same seams the rest of the
 * suite uses: real HTTP interception for anything hitting this origin or the
 * Hosted UI's, and the real PKCE round trip through {@link prepareSignIn} and
 * {@link pendingCallback} rather than a stand-in for either.
 *
 * The redirect itself — `window.location.assign` — is not exercised here.
 * jsdom does not allow that property to be overridden per-instance, and the
 * one line in {@link beginSignIn} that calls it is not worth a real browser
 * to prove; the URL it is called with is what matters, and `prepareSignIn`
 * builds that URL without navigating anywhere.
 */

const RUN: TypingRun = {
  id: "00000000-0000-4000-8000-0000000000d1",
  passageId: "00000000-0000-4000-8000-0000000000d2",
  discipline: "QUOTES",
  wpm: 130.2,
  accuracy: 99.1,
  elapsedMillis: 18_000,
  keystrokes: 90,
  correctCharacters: 89,
  errors: 1,
  completedAt: "2026-01-01T00:00:21.000Z",
  personalBest: true,
  previousBestWpm: 118,
};

function resultScreen(onSignIn = vi.fn()) {
  return {
    onSignIn,
    ...renderApp(
      <ResultScreen
        run={RUN}
        onRunAgain={() => {}}
        onChangeDiscipline={() => {}}
        onSignIn={onSignIn}
        pending={false}
        failed={false}
      />,
    ),
  };
}

beforeEach(() => {
  vi.stubEnv("VITE_COGNITO_DOMAIN", "auth.test.example.com");
  vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client");
});

afterEach(() => {
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

describe("the sign-in screen", () => {
  it("offers GitHub and Google, and asks for nothing else", async () => {
    renderApp(<SignInScreen onCancel={() => {}} />);

    expect(screen.getByRole("button", { name: /authenticate via github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /authenticate via google/i })).toBeInTheDocument();
    // No credentials form (ADR-0011): nothing on this screen accepts typed input.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("builds a Hosted UI URL with a PKCE challenge for the chosen Provider", async () => {
    const destination = new URL(await prepareSignIn("GitHub"));

    expect(destination.hostname).toBe("auth.test.example.com");
    expect(destination.searchParams.get("identity_provider")).toBe("GitHub");
    expect(destination.searchParams.get("client_id")).toBe("test-client");
    expect(destination.searchParams.get("response_type")).toBe("code");
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    // A verifier this tab minted, not a fixed value — the whole defence of
    // PKCE is that nobody who intercepts the redirect can complete the
    // exchange without it.
    expect(destination.searchParams.get("code_challenge")).toBeTruthy();
    expect(destination.searchParams.get("state")).toBeTruthy();
  });
});

/** Prepares a sign-in and hands back the state it minted, exactly as the return trip will need to match. */
async function beginSignInAndCaptureState(): Promise<string> {
  const destination = new URL(await prepareSignIn("GitHub"));
  return destination.searchParams.get("state") as string;
}

/**
 * Simulates the Hosted UI's redirect landing back on the app with an
 * authorization code, using `pushState` rather than assigning `location` —
 * the same mechanism {@link clearCallbackFromUrl} itself uses, and the one
 * jsdom actually implements.
 */
function returnFromHostedUi(code: string, state: string): void {
  window.history.pushState({}, "", `/?code=${code}&state=${state}`);
}

describe("Claiming, once the browser is back from the Hosted UI", () => {
  it("pre-fills the Handle already held, and Claims with whatever the player kept or changed", async () => {
    const state = await beginSignInAndCaptureState();
    returnFromHostedUi("test-authorization-code", state);

    server.use(
      http.post("https://auth.test.example.com/oauth2/token", () =>
        HttpResponse.json({ id_token: "test-id-token" }),
      ),
      http.post("/api/users/claim", async ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("Bearer test-id-token");
        const body = (await request.json()) as { handle: string };
        return HttpResponse.json<User>({
          id: returningUser.id,
          handle: body.handle,
          claimed: true,
        });
      }),
    );

    const onDone = vi.fn();
    renderApp(<ClaimingScreen onDone={onDone} />);

    // Pre-filled with the generated Handle this browser already had — nothing
    // asked of the player who is happy to keep it.
    const input = await screen.findByDisplayValue(returningUser.handle);

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "chosenhandle");
    await user.click(screen.getByRole("button", { name: /claim/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("refuses a Handle that is already taken, without losing the sign-in", async () => {
    const state = await beginSignInAndCaptureState();
    returnFromHostedUi("test-authorization-code", state);

    server.use(
      http.post("https://auth.test.example.com/oauth2/token", () =>
        HttpResponse.json({ id_token: "test-id-token" }),
      ),
      http.post("/api/users/claim", () => new HttpResponse(null, { status: 409 })),
    );

    const onDone = vi.fn();
    renderApp(<ClaimingScreen onDone={onDone} />);

    await screen.findByDisplayValue(returningUser.handle);
    await userEvent.setup().click(screen.getByRole("button", { name: /claim/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already taken/i);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("the invitation to sign in on the result screen", () => {
  it("appears after a Run for an Unclaimed User", async () => {
    resultScreen();

    expect(await screen.findByRole("complementary", { name: /sign in/i })).toBeInTheDocument();
  });

  it("does not appear for a User who has already Claimed", async () => {
    server.use(
      http.get("/api/users/me", () =>
        HttpResponse.json<User>({
          id: returningUser.id,
          handle: returningUser.handle,
          claimed: true,
        }),
      ),
    );

    resultScreen();

    // Give the current-User query a chance to resolve before asserting an
    // absence — otherwise this would pass trivially before the request lands.
    await screen.findByText(/verified by the server/i);
    expect(screen.queryByRole("complementary", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("is not a persistent header nag: dismissing it removes it for the rest of the visit", async () => {
    resultScreen();
    const banner = await screen.findByRole("complementary", { name: /sign in/i });

    await userEvent.setup().click(screen.getByRole("button", { name: /dismiss/i }));

    expect(banner).not.toBeInTheDocument();
  });

  it("calls back to open the sign-in screen, rather than navigating on its own", async () => {
    const { onSignIn } = resultScreen();
    await screen.findByRole("complementary", { name: /sign in/i });

    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
