/**
 * The Cognito Hosted UI's Authorization Code + PKCE flow, hand-rolled.
 *
 * No auth library: this is two redirects and one token exchange, entirely
 * standard OAuth2, and the Web Crypto API already has everything a PKCE
 * challenge needs. A dependency here would be trading a screenful of code
 * that never has to change against a supply chain that might.
 *
 * Configured by environment rather than hardcoded, and treated as absent
 * rather than fatal when unset — there is no Cognito user pool provisioned
 * yet in any environment this runs in (ADR-0011's infrastructure is a
 * follow-up), and a build that refused to run without one would block every
 * other feature on this repository on it.
 */

export type Provider = "GitHub" | "Google";

interface Config {
  domain: string;
  clientId: string;
}

function config(): Config | null {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  return domain && clientId ? { domain, clientId } : null;
}

/** Whether a Cognito user pool is configured in this environment at all. */
export function signInAvailable(): boolean {
  return config() !== null;
}

// sessionStorage, not localStorage: the verifier is only ever needed to
// finish the redirect it was minted for, in this tab, and must not outlive
// that round trip.
const VERIFIER_KEY = "gmc-oauth-verifier";
const STATE_KEY = "gmc-oauth-state";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function redirectUri(): string {
  // The same page, always — the SPA has one route (ADR-0002), so the Hosted
  // UI sends the browser straight back to where it left, no callback path to
  // register or fail to match.
  return `${window.location.origin}/`;
}

/**
 * Mints a PKCE pair, remembers it for the return trip, and builds the Hosted
 * UI's authorize URL for the given Provider.
 *
 * Separate from {@link beginSignIn} so the URL this actually produces —
 * including the challenge and the state it generated — is something a test
 * can inspect without also being a test of `window.location`, which jsdom
 * does not allow overriding per-property.
 */
export async function prepareSignIn(provider: Provider): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("Sign-in is not configured in this environment");

  const verifier = randomToken(32);
  const state = randomToken(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const url = new URL(`https://${cfg.domain}/oauth2/authorize`);
  url.searchParams.set("identity_provider", provider);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", "openid");
  url.searchParams.set("code_challenge", await codeChallengeFor(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  return url.toString();
}

/** Sends the browser to the Hosted UI to authenticate with the given Provider. */
export async function beginSignIn(provider: Provider): Promise<void> {
  window.location.assign(await prepareSignIn(provider));
}

/**
 * The authorization code waiting in the URL, if the browser just landed back
 * from the Hosted UI with one this tab actually requested.
 *
 * The state check is what makes the second half true — without it, anybody
 * who can make a browser load a URL with a `code` in it could hand this tab a
 * code from an authorization they ran, not one this tab asked for.
 */
export function pendingCallback(): { code: string } | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code) return null;

  const expected = sessionStorage.getItem(STATE_KEY);
  if (!expected || state !== expected) return null;
  return { code };
}

/** Drops `code` and `state` from the address bar so a reload cannot replay them. */
export function clearCallbackFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url.toString());
}

/** Trades the authorization code for tokens, and returns the ID token alone — the only one Claiming needs. */
export async function exchangeCodeForIdToken(code: string): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("Sign-in is not configured in this environment");

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!verifier) throw new Error("No sign-in is waiting to be completed");

  const response = await fetch(`https://${cfg.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.clientId,
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not complete sign-in (status ${response.status})`);
  }

  const tokens = (await response.json()) as { id_token: string };
  return tokens.id_token;
}
