/**
 * Cloudflare Turnstile, guarding Unclaimed User creation (ADR-0007).
 *
 * Configured by environment and treated as absent rather than fatal when
 * unset, the same posture `auth/cognito.ts` takes toward a Cognito user pool:
 * there is no Turnstile site provisioned in local development or CI, and
 * `useCurrentUser` must keep working without one.
 *
 * Rendered invisibly rather than as a checkbox to tick. `UserController`
 * (the backend this guards) asks nothing of an honest visitor by design —
 * Unclaimed User creation is a plain POST with no form to fill in — and a
 * widget that interrupted every arrival with a click would undo that for
 * every honest player to inconvenience the farms it exists to slow down.
 * Cloudflare's managed challenge runs its check unattended in the ordinary
 * case, and only asks something of the visitor when the traffic looks
 * scripted.
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "invisible";
      callback: (token: string) => void;
      "error-callback": () => void;
    },
  ): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoad: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the Turnstile widget"));
    document.head.appendChild(script);
  });
  return scriptLoad;
}

/** Whether a Turnstile site is configured in this environment at all. */
export function turnstileConfigured(): boolean {
  return Boolean(SITE_KEY);
}

/** A token the widget vouches for this browser with, or `undefined` where no Turnstile site is configured. */
export async function turnstileToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;

  await loadScript();
  return new Promise<string>((resolve, reject) => {
    // An element the widget never has to be visible in, since it never
    // renders a checkbox in the ordinary case — `size: "invisible"` still
    // needs somewhere in the DOM to attach to.
    const container = document.createElement("div");
    document.body.appendChild(container);

    window.turnstile?.render(container, {
      sitekey: SITE_KEY,
      size: "invisible",
      callback: (token) => {
        resolve(token);
        container.remove();
      },
      "error-callback": () => {
        reject(new Error("The challenge widget could not vouch for this browser"));
        container.remove();
      },
    });
  });
}
