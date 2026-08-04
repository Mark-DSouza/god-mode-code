import type { Discipline, LeaderboardEntry } from "@gmc/api-client";
import { type ReactNode, useState } from "react";
import { usePassageLeaderboard } from "../api/leaderboard.ts";
import { initialsFor } from "../app/initials.ts";
import { Avatar, Button, Table, type TableColumn } from "../design-system/index.ts";
import { DISCIPLINES } from "../run/disciplines.ts";

/**
 * How much of the board is shown before anybody asks for more.
 *
 * The result screen's job is the Run that just finished, and a ranking that
 * pushed the numerals off the top of the screen would be answering a question
 * nobody had yet. Five is enough to see whether you are near the top and enough
 * to make the full ranking worth opening.
 */
const SHOWN_AT_FIRST = 5;

/** One row of the ranking, flattened to what the table prints. */
interface Row {
  entry: LeaderboardEntry;
  /** Whether this row is the asker's. Decided by the server's own answer, not by comparing handles. */
  mine: boolean;
}

const COLUMNS: TableColumn<Row>[] = [
  {
    key: "position",
    label: "#",
    width: "56px",
    align: "center",
    render: (_value, row) => row.entry.position,
  },
  {
    key: "user",
    label: "User",
    render: (_value, row) => (
      <span className="flex min-w-0 items-center gap-3">
        {/* No glow. Ten of these down a dense list is a wall of bloom — which
            is the case `Avatar` documents the switch for. */}
        <Avatar initials={initialsFor(row.entry.user.handle)} size={26} glow={false} />
        <span className="truncate">{row.entry.user.handle}</span>
        {/* The green tint says "this row is yours" to everybody who can see it.
            This says it to everybody else, and to anybody who cannot pick a 12%
            wash out of a dark table — the same reason a wrong glyph carries an
            underline as well as a colour (ADR-0010). */}
        {row.mine && (
          <span className="shrink-0 font-display text-2xs tracking-wider text-rain-bright uppercase">
            you
          </span>
        )}
      </span>
    ),
  },
  {
    key: "wpm",
    label: "WPM",
    width: "84px",
    align: "right",
    // Whole words per minute, as everywhere else a WPM is shown to a player. A
    // tenth of a word per minute is below the resolution of the thing being
    // measured.
    render: (_value, row) => Math.round(row.entry.wpm),
  },
  {
    key: "accuracy",
    label: "Acc",
    width: "84px",
    align: "right",
    muted: true,
    // Fixed to one decimal rather than printed as it arrives. The server
    // sends numeric(4,1), and JSON drops a trailing zero — so an Accuracy of
    // exactly 98.0 prints "98" and sits in a column of "99.2"s, ragged against
    // every neighbour.
    render: (_value, row) => `${row.entry.accuracy.toFixed(1)}%`,
  },
];

/**
 * Where the player stands on the exact Passage they just typed.
 *
 * Here rather than on a Leaderboard screen of its own, because a per-Challenge
 * ranking is only ever wanted when you have that Challenge in hand. Nobody
 * picks a Passage out of a list of hundreds to see who is fastest at it — the
 * context is the result screen, and this is what that context is for.
 *
 * A board that will not load renders one quiet line. The result itself arrived
 * and is what the player came for; taking the screen down to a fault over the
 * ranking beside it would lose them the thing that worked.
 */
export function PassageLeaderboard({
  passageId,
  discipline,
}: {
  passageId: string;
  /** The Passage's Discipline, for the fallback when there is no ranking to show. */
  discipline: Discipline;
}) {
  const board = usePassageLeaderboard(passageId);
  const [showingAll, setShowingAll] = useState(false);

  if (board.isPending) {
    return null;
  }

  if (board.isError || !board.data) {
    return (
      <p className="font-code text-xs text-disabled">
        The Leaderboard for this Passage could not be read.
      </p>
    );
  }

  const { entries, you, participants, minimumParticipants } = board.data;

  // Withheld rather than thin. Being told you are second of two says nothing
  // about how you type, and the Discipline's own ranking is the reading that
  // does not depend on how many people happen to have found this Passage.
  if (entries.length === 0) {
    return (
      <Section discipline={discipline}>
        <p className="font-body text-sm text-muted">
          {`This Passage is ranked once ${minimumParticipants} people have tried it — ${participants} ${
            participants === 1 ? "has" : "have"
          } so far. Until then, the ${DISCIPLINES[discipline].title} ranking is the one that means something.`}
        </p>
      </Section>
    );
  }

  const shown = showingAll ? entries : entries.slice(0, SHOWN_AT_FIRST);
  const rows: Row[] = shown.map((entry) => ({ entry, mine: entry.user.id === you?.user.id }));

  // Pinned in from below. The server sends the asker's row whatever it ranks,
  // precisely so a board showing five of ten does not have to work out whether
  // the sixth was theirs — and so somebody in 43rd place still sees where they
  // are without scrolling to find out.
  if (you && !rows.some((row) => row.mine)) {
    rows.push({ entry: you, mine: true });
  }

  return (
    <Section discipline={discipline}>
      <Table
        columns={COLUMNS}
        rows={rows}
        // The User rather than the position: two tied Users share a position,
        // and a key that repeats is a row React may reuse for the wrong person.
        getRowKey={(row) => row.entry.user.id}
        getHighlight={(row) => row.mine}
        label={`Leaderboard for this ${DISCIPLINES[discipline].title} Passage`}
      />

      {!showingAll && entries.length > SHOWN_AT_FIRST && (
        <Button variant="ghost" size="sm" onClick={() => setShowingAll(true)}>
          See the full ranking
        </Button>
      )}

      <p className="font-code text-xs text-disabled">
        {`${participants} ${participants === 1 ? "person has" : "people have"} typed this Passage`}
      </p>
    </Section>
  );
}

/** The heading and frame every state of the board shares. */
function Section({ discipline, children }: { discipline: Discipline; children: ReactNode }) {
  return (
    <section
      className="flex w-full flex-col items-center gap-3"
      // Named for what it ranks rather than "Leaderboard", because the screen
      // will eventually carry a Discipline ranking too and two regions called
      // the same thing help nobody navigating by landmark.
      aria-label="Leaderboard for this Passage"
    >
      <h2 className="font-display text-2xs tracking-wider text-muted uppercase">
        This {DISCIPLINES[discipline].title} Passage
      </h2>
      {children}
    </section>
  );
}
