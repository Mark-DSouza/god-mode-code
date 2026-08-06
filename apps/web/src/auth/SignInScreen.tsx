import { Button } from "../design-system/index.ts";
import { type Provider, beginSignIn } from "./cognito.ts";

/**
 * Two buttons, not a credentials form (ADR-0011).
 *
 * There is nothing else here on purpose: no email field, no password, nothing
 * this screen could get wrong. Clicking either button leaves the page —
 * Cognito's Hosted UI does the actual authenticating, and this app finds out
 * the result when the browser lands back with an authorization code.
 */
export function SignInScreen({ onCancel }: { onCancel: () => void }) {
  return (
    <section className="flex flex-col items-center gap-8" aria-label="Sign in">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-2xl tracking-wide text-heading uppercase [text-shadow:var(--glow-md)]">
          Sign in
        </h1>
        <p className="max-w-[48ch] font-body text-md text-ink-2">
          One click, no password — your Runs are already here and waiting for a Handle you chose.
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-4">
        <SignInButton provider="GitHub" />
        <SignInButton provider="Google" />
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="font-body text-xs text-muted underline underline-offset-2 hover:text-ink-2"
      >
        Not now
      </button>
    </section>
  );
}

function SignInButton({ provider }: { provider: Provider }) {
  return (
    <Button size="lg" block onClick={() => void beginSignIn(provider)}>
      {"> "}Authenticate via {provider}
    </Button>
  );
}
