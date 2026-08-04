import { useState } from "react";
import { useCurrentUser } from "../api/user.ts";
import { Card, IconButton } from "../design-system/index.ts";
import { signInAvailable } from "./cognito.ts";

/**
 * The invitation to sign in, on the result screen after a Run — never a
 * persistent header nag (ADR-0007, ADR-0011).
 *
 * Nothing renders here for a Claimed User, for a guest who already dismissed
 * it this visit, or in an environment with no identity provider configured.
 * Declining costs nothing: an Unclaimed User keeps full Leaderboard placement,
 * so this is an offer, never a wall.
 */
export function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  const user = useCurrentUser();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !signInAvailable() || !user.data || user.data.claimed) {
    return null;
  }

  return (
    <Card
      role="complementary"
      aria-label="Sign in to keep this Run"
      className="flex w-full max-w-[48ch] items-center justify-between gap-3 px-4 py-3"
    >
      <p className="font-body text-sm text-ink-2">
        Sign in to keep this Run — and every one after it, under a Handle you chose.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSignIn}
          className="font-display text-xs tracking-wide text-accent uppercase hover:text-rain-bright"
        >
          Sign in
        </button>
        <IconButton label="Dismiss" size="sm" onClick={() => setDismissed(true)}>
          ×
        </IconButton>
      </div>
    </Card>
  );
}
