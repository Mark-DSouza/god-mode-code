import { useEffect, useState } from "react";
import { useCurrentUser } from "../api/user.ts";
import { Button, Card, Input } from "../design-system/index.ts";
import { clearCallbackFromUrl, exchangeCodeForIdToken, pendingCallback } from "./cognito.ts";
import { HandleTakenError, useClaim } from "./use-claim.ts";

/**
 * Where the browser lands after the Hosted UI redirects back.
 *
 * The Handle field is what "the player chooses a Handle on Claiming" means:
 * pre-filled with the generated one they already have, editable, submitted
 * with every Claim request. Whether it ends up used is a backend decision —
 * signing in to an account that already has a Handle keeps that one and
 * ignores whatever is submitted here (ADR-0007) — so this screen does not try
 * to know in advance whether it is claiming or merging.
 */
export function ClaimingScreen({ onDone }: { onDone: () => void }) {
  const user = useCurrentUser();
  const claim = useClaim();
  const [idToken, setIdToken] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const callback = pendingCallback();
    clearCallbackFromUrl();
    if (!callback) {
      setError("There is no sign-in to complete.");
      return;
    }
    exchangeCodeForIdToken(callback.code)
      .then(setIdToken)
      .catch(() => setError("Could not complete sign-in — try again."));
    // Runs once: the authorization code in the URL is single-use, and
    // exchanging it a second time — on a re-render rather than a fresh
    // callback — would only fail against Cognito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-filled with the generated Handle once it is known, and only until the
  // player types — an update from an unrelated refetch must not overwrite
  // what they are mid-way through choosing.
  useEffect(() => {
    if (user.data && !handleEdited) setHandle(user.data.handle);
  }, [user.data, handleEdited]);

  function submit() {
    if (!idToken) return;
    setError(null);
    claim.mutate(
      { idToken, handle },
      {
        onSuccess: () => onDone(),
        onError: (submitError) => {
          setError(
            submitError instanceof HandleTakenError
              ? "That Handle is already taken — choose another."
              : "Could not Claim — try again.",
          );
        },
      },
    );
  }

  const ready = Boolean(idToken) && handle.trim().length >= 3;

  return (
    <section className="flex flex-col items-center gap-6" aria-label="Choose your Handle">
      <h1 className="font-display text-xl tracking-wide text-heading uppercase [text-shadow:var(--glow-md)]">
        Choose your Handle
      </h1>

      <Card className="flex w-full max-w-[420px] flex-col gap-4 p-5">
        <Input
          prefix=">"
          aria-label="Handle"
          value={handle}
          onChange={(event) => {
            setHandleEdited(true);
            setHandle(event.target.value.toUpperCase());
          }}
          disabled={!idToken || claim.isPending}
          invalid={Boolean(error)}
          minLength={3}
          maxLength={22}
        />
        {error && (
          <p role="alert" className="font-body text-xs text-error">
            {error}
          </p>
        )}
        <Button onClick={submit} disabled={!ready || claim.isPending}>
          {claim.isPending ? "Claiming" : "Claim"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="font-body text-xs text-muted underline underline-offset-2 hover:text-ink-2"
        >
          Cancel
        </button>
      </Card>
    </section>
  );
}
