import type { HistoryEntry, PersonalBest, Profile } from "@gmc/api-client";
import { useProfile } from "../api/profile.ts";
import { initialsFor } from "../app/initials.ts";
import { Avatar, Button, Card, EmptyState, RunChart, Stat } from "../design-system/index.ts";
import { DISCIPLINES } from "../run/disciplines.ts";

/**
 * How the player is doing: their best, where they are lately, and the shape of
 * their recent Runs.
 *
 * Every figure comes from the server, which derives all of it from the Runs
 * themselves on each request — nothing here is a stored total, and nothing here
 * is arithmetic the browser did on its own.
 */
export function ProfileScreen({
  onStart,
  onLeave,
  pending,
  failed,
}: {
  /** The one action the empty state offers: begin a first Run. */
  onStart: () => void;
  onLeave: () => void;
  /** Whether that first Challenge is on its way, so the button is not a dead one. */
  pending: boolean;
  failed: boolean;
}) {
  const profile = useProfile();

  return (
    <section className="flex w-full flex-col gap-6" aria-label="Profile">
      {profile.isPending && (
        <p
          role="status"
          className="text-center font-display text-sm tracking-wide text-muted uppercase"
        >
          Reading your Runs
        </p>
      )}

      {profile.isError && (
        <Card role="alert" className="mx-auto max-w-[48ch] text-center">
          <p className="font-body text-sm text-error">
            Could not read your profile. The backend did not answer — try again.
          </p>
        </Card>
      )}

      {profile.data && <Identity profile={profile.data} />}

      {profile.data &&
        (profile.data.history.length === 0 ? (
          <FirstRun onStart={onStart} pending={pending} failed={failed} />
        ) : (
          <Progress profile={profile.data} />
        ))}

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onLeave}>
          Back
        </Button>
      </div>
    </section>
  );
}

/** Who this is: the tile and the Handle, the two things a player recognises. */
function Identity({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar
        data-testid="profile-avatar"
        // Decorative. The Handle is right beside it and is the accessible answer
        // to "whose profile is this".
        aria-hidden="true"
        size={56}
        initials={initialsFor(profile.user.handle)}
      />
      <h1 className="min-w-0 truncate font-display text-2xl tracking-wide text-heading uppercase [text-shadow:var(--glow-sm)]">
        {profile.user.handle}
      </h1>
    </div>
  );
}

/**
 * A beginning rather than a fault.
 *
 * No zeroes, no empty chart, no "0 runs" — those read as a broken screen, and
 * this player has done nothing wrong. One action, and it starts a Run rather
 * than sending anybody back to a menu to choose again.
 */
function FirstRun({
  onStart,
  pending,
  failed,
}: {
  onStart: () => void;
  pending: boolean;
  failed: boolean;
}) {
  return (
    <>
      <EmptyState
        glyph="▚"
        title="Nothing logged yet"
        description="Type one Passage and the rain starts keeping score — your best, your average, and every Run after it."
      >
        <Button size="lg" disabled={pending} onClick={onStart}>
          {pending ? "Dealing you a Passage" : "Start your first Run"}
        </Button>
      </EmptyState>

      {failed && (
        <Card role="alert" className="mx-auto max-w-[48ch] text-center">
          <p className="font-body text-sm text-error">
            Could not get a Passage. The backend did not answer — try again.
          </p>
        </Card>
      )}
    </>
  );
}

/** The three readouts and the chart under them. */
function Progress({ profile }: { profile: Profile }) {
  const best = bestOf(profile.personalBests);
  // Oldest first, because a chart reads left to right and so does time. The
  // server sends the history newest first, which is the order a list wants.
  const chronological = [...profile.history].reverse();
  const peak = Math.max(...chronological.map((entry) => entry.wpm));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat
            align="left"
            size="lg"
            value={best ? Math.round(best.wpm) : "—"}
            unit={best ? "wpm" : undefined}
            label={best ? `All-time best · ${DISCIPLINES[best.discipline].title}` : "All-time best"}
          />
        </Card>
        <Card>
          <Stat
            align="left"
            size="lg"
            value={profile.recentAverageWpm == null ? "—" : Math.round(profile.recentAverageWpm)}
            unit={profile.recentAverageWpm == null ? undefined : "wpm"}
            label={`Recent average · last ${profile.history.length}`}
          />
        </Card>
        <Card>
          <Stat
            align="left"
            size="lg"
            accent="warning"
            value={profile.bestAccuracy == null ? "—" : profile.bestAccuracy}
            unit={profile.bestAccuracy == null ? undefined : "%"}
            // Typing Runs only, and saying so is cheaper than letting somebody
            // who solves Patterns wonder why their Accuracy never moves: a
            // Solve Run has no target text to be accurate against (ADR-0006).
            label="Best accuracy · typed"
          />
        </Card>
      </div>

      <RunChart
        values={chronological.map((entry) => entry.wpm)}
        label={`Last ${chronological.length} Runs · WPM`}
        peakLabel={`peak ${Math.round(peak)}`}
        aria-label={summarise(chronological, peak)}
      />
    </>
  );
}

/** The chart, in a sentence, for anybody who is not looking at it. */
function summarise(history: HistoryEntry[], peak: number): string {
  return `The last ${history.length} Runs by WPM, oldest first, from ${Math.round(
    Math.min(...history.map((entry) => entry.wpm)),
  )} to ${Math.round(peak)}. The strongest Run is emphasised.`;
}

/**
 * The highest of the Personal Bests, whichever Discipline holds it.
 *
 * The server derives one per Discipline and never ranks across them — a Quotes
 * best and a Code best are not comparable achievements (CONTEXT.md). This is
 * only "the largest number you have ever produced", which is what an all-time
 * readout is, and it says which Discipline it came from for exactly that reason.
 */
function bestOf(bests: PersonalBest[]): PersonalBest | null {
  return bests.reduce<PersonalBest | null>(
    (highest, best) => (highest === null || best.wpm > highest.wpm ? best : highest),
    null,
  );
}
