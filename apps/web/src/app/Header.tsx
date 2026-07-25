import { initialsFor, useCurrentUser } from "../api/identity.ts";
import { Avatar, Wordmark } from "../design-system/index.ts";

/**
 * The chrome bar: the wordmark on the left, who you are on the right.
 *
 * The mockups put nav between them. Nothing is built to navigate to yet, so it
 * is left out rather than stubbed — a row of buttons that do nothing reads as a
 * broken site rather than an unfinished one.
 *
 * <h2>Why the wordmark folds</h2>
 *
 * At the narrowest supported width — 320px, the width the Handle's length budget
 * is derived for — the spelled-out wordmark costs about 216 of the 280 pixels
 * inside the padding, which leaves nothing for a Handle beside it. Both fit from
 * roughly 420px up, so below that the brand keeps its ▚ mark and gives up its
 * text. The Handle stays at every width: it is the answer to "who am I", and the
 * mockup's mobile header drops it only because the mockup had no Handle to show.
 */
export function Header() {
  const user = useCurrentUser();
  const handle = user.data?.handle;

  return (
    <header className="border-b border-line px-5 py-4 backdrop-blur-[2px]">
      <div className="mx-auto flex w-full max-w-[var(--container-app)] items-center justify-between gap-3">
        <Wordmark size={20} text={false} className="min-[420px]:hidden" />
        <Wordmark size={20} className="hidden min-[420px]:inline-flex" />

        {/* The tile keeps its space while the request is in flight, so nothing
            jumps sideways when the Handle lands. */}
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            data-testid="identity-avatar"
            // Decorative. The Handle beside it is the accessible answer to "who
            // am I", and announcing the initials first only says it twice.
            aria-hidden="true"
            size={28}
            glow={Boolean(handle)}
            initials={handle ? initialsFor(handle) : ""}
          />
          <span
            data-testid="identity-handle"
            className="truncate font-display text-2xs tracking-wide text-heading uppercase [text-shadow:var(--glow-sm)] min-[420px]:text-xs"
          >
            {handle}
          </span>
        </div>
      </div>
    </header>
  );
}
