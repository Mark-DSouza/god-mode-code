import type { Discipline } from "@gmc/api-client";
import { type ReactNode, useState } from "react";
import { Button, Card, ChallengeCard } from "../design-system/index.ts";
import { DISCIPLINES, PLAYABLE_DISCIPLINES } from "./disciplines.ts";

/**
 * Choosing what to type.
 *
 * Two steps rather than one — pick a tile, then start — because asking for a
 * Challenge is not a free action: it records an Issue and abandons whichever
 * Passage the player was already holding. A tile that started a Run on the
 * first click would make an accidental tap cost somebody their Challenge.
 */
export function HomeScreen({
  status,
  onStart,
  pending,
  failed,
}: {
  /** The backend status pill. Passed in rather than read here, so this screen stays about choosing. */
  status?: ReactNode;
  onStart: (discipline: Discipline) => void;
  pending: boolean;
  failed: boolean;
}) {
  const [chosen, setChosen] = useState<Discipline>("QUOTES");

  return (
    <section className="flex flex-col items-center gap-9">
      <div className="flex flex-col items-center gap-4 text-center">
        {status}
        <h1 className="font-display text-2xl tracking-wide text-heading uppercase [text-shadow:var(--glow-md)] sm:text-3xl">
          How fast can you type?
        </h1>
        <p className="max-w-[56ch] font-body text-md leading-snug text-ink-2">
          Pick a Discipline. The rain falls while you type. Beat your best WPM.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLAYABLE_DISCIPLINES.map((discipline) => (
          <ChallengeCard
            key={discipline}
            glyph={DISCIPLINES[discipline].glyph}
            title={DISCIPLINES[discipline].title}
            description={DISCIPLINES[discipline].description}
            selected={discipline === chosen}
            onClick={() => setChosen(discipline)}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Code does not deal you anything: it takes you to the catalogue, and
            you pick. Saying "Start Run" there would promise a Run that the next
            screen does not begin. */}
        <Button size="lg" disabled={pending} onClick={() => onStart(chosen)}>
          {chosen === "CODE" ? "Browse Patterns" : pending ? "Dealing you a Passage" : "Start Run"}
        </Button>

        {failed && (
          <Card role="alert" className="max-w-[48ch] text-center">
            <p className="font-body text-sm text-error">
              Could not get a Passage. The backend did not answer — try again.
            </p>
          </Card>
        )}
      </div>
    </section>
  );
}
