import { useCurrentUser } from "../api/user.ts";
import { initialsFor } from "./initials.ts";
import { Avatar, Wordmark } from "../design-system/index.ts";

/** Shown where a Handle would be when the backend never answered. */
const UNKNOWN = "—";

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
 * inside the padding, which leaves nothing for a Handle beside it. Below 480px
 * the brand therefore keeps its ▚ mark and gives up its text.
 *
 * 480 rather than the ~420 the arithmetic suggests, because the arithmetic was
 * wrong: measured in Chromium, the longest Handle the generator can produce
 * (`PERCOLATING_FERRET_100`, 22 characters) needs 153px and a 420px viewport
 * leaves it 116. The threshold is the measurement, not the estimate.
 *
 * The Handle itself stays at every width — it is the answer to "who am I", and
 * the mockup's mobile header drops it only because the mockup had no Handle to
 * show.
 */
export function Header({ onOpenProfile }: { onOpenProfile: () => void }) {
  const user = useCurrentUser();
  const handle = user.data?.handle;
  // An empty header is indistinguishable from a rendering fault. A dash says
  // "we could not work out which User you are", which is the truth and is recoverable
  // by reloading — there is nothing else to offer until there is a screen to
  // send anyone to.
  const shown = handle ?? (user.isError ? UNKNOWN : "");

  return (
    <header className="border-b border-line px-5 py-4 backdrop-blur-[2px]">
      <div className="mx-auto flex w-full max-w-[var(--container-app)] items-center justify-between gap-3">
        <Wordmark size={20} text={false} className="min-[480px]:hidden" />
        <Wordmark size={20} className="hidden min-[480px]:inline-flex" />

        {/* The tile keeps its space while the request is in flight, so nothing
            jumps sideways when the Handle lands.

            A real button, and its accessible name starts with the Handle it
            renders. WCAG 2.5.3 asks that a visible label be part of the name
            somebody says out loud — a bare "Your profile" would leave a voice
            user reading "PERCOLATING_FERRET" with nothing to say to reach it. */}
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={handle ? `${handle} — your profile` : "Your profile"}
          className="flex min-w-0 cursor-pointer items-center gap-2 rounded-sm hover:opacity-80"
        >
          <Avatar
            data-testid="user-avatar"
            // Decorative. The Handle is in the button's name already, and
            // announcing the initials first only says it twice.
            aria-hidden="true"
            size={28}
            glow={Boolean(handle)}
            initials={handle ? initialsFor(handle) : ""}
          />
          <span
            data-testid="user-handle"
            className="truncate font-display text-2xs tracking-wide text-heading uppercase [text-shadow:var(--glow-sm)] min-[480px]:text-xs"
          >
            {shown}
          </span>
        </button>
      </div>
    </header>
  );
}
