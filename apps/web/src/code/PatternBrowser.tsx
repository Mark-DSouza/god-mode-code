import type { Family, Pattern, Seniority } from "@gmc/api-client";
import { useMemo, useState } from "react";
import { usePatterns } from "../api/patterns.ts";
import { Button, Card, Select, Tabs } from "../design-system/index.ts";
import { DesktopSuitsThisBetter } from "./DesktopSuitsThisBetter.tsx";
import { FAMILIES, SENIORITIES, SENIORITY_ORDER } from "./families.ts";
import { PatternTags } from "./PatternTags.tsx";

const EVERY_SENIORITY = "ALL";

/**
 * Choosing a Pattern.
 *
 * Browsing is by Family and filtering is by Seniority, and the two are
 * different controls on purpose. A Family is what you came to practise — it is
 * navigation, so it gets tabs you can see all of at once. A Seniority is how
 * hard you want it today, which narrows whatever you are looking at rather than
 * replacing it.
 *
 * The Families offered are the ones that have Patterns in them. A tab leading to
 * an empty list is a tab that wastes a click, and the catalogue grows by
 * migration rather than by anything a player does.
 */
export function PatternBrowser({
  onStart,
  onLeave,
  pending,
}: {
  onStart: (slug: string) => void;
  onLeave: () => void;
  /** Whether a Pattern is on its way, so the buttons are not dead. */
  pending: boolean;
}) {
  const [seniority, setSeniority] = useState<Seniority | typeof EVERY_SENIORITY>(EVERY_SENIORITY);
  const [family, setFamily] = useState<Family | null>(null);

  // Unfiltered, so the tab bar is the shape of the catalogue rather than the
  // shape of the current filter — a Family that vanishes when you pick
  // "Principal" takes the way back with it.
  const catalogue = usePatterns(null, null);
  const narrowed = usePatterns(family, seniority === EVERY_SENIORITY ? null : seniority);

  const families = useMemo(() => distinctFamilies(catalogue.data ?? []), [catalogue.data]);
  // Before the first response there is nothing to select; after it, the first
  // Family is what you are looking at.
  const selectedFamily = family ?? families[0] ?? null;
  // Narrowed by the server, then again here — not belt and braces. Until a tab
  // has actually been clicked there is no Family in the request, so the second
  // filter is what makes the first tab show its own Patterns rather than the
  // whole catalogue.
  const patterns = (narrowed.data ?? []).filter(
    (pattern) => selectedFamily === null || pattern.family === selectedFamily,
  );

  return (
    <section className="flex flex-col gap-6" aria-label="Patterns">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-2xl tracking-wide text-heading uppercase [text-shadow:var(--glow-md)]">
          Pick a Pattern
        </h1>
        <p className="max-w-[56ch] font-body text-md leading-snug text-ink-2">
          A technique, not a problem. Read the prompt and the Example Tests, write four to eight
          lines, and the judge runs them.
        </p>
      </div>

      <DesktopSuitsThisBetter />

      {catalogue.isPending && (
        <p className="text-center font-code text-xs text-ink-3" role="status">
          reading the catalogue
        </p>
      )}

      {catalogue.isError && (
        <Card role="alert" className="text-center">
          <p className="font-body text-sm text-error">
            Could not read the Patterns. The backend did not answer — try again.
          </p>
        </Card>
      )}

      {selectedFamily && (
        <div className="flex flex-col gap-4">
          <Tabs
            label="Family"
            items={families.map((each) => ({ id: each, label: FAMILIES[each] }))}
            value={selectedFamily}
            onChange={(id) => setFamily(id as Family)}
          />

          <div className="flex items-center gap-3">
            <span className="font-display text-2xs tracking-wider text-muted uppercase">
              Seniority
            </span>
            <Select
              label="Seniority"
              value={seniority}
              onChange={(value) => setSeniority(value as Seniority | typeof EVERY_SENIORITY)}
              options={[
                { value: EVERY_SENIORITY, label: "Any" },
                ...SENIORITY_ORDER.map((each) => ({ value: each, label: SENIORITIES[each] })),
              ]}
            />
          </div>
        </div>
      )}

      {catalogue.isSuccess && families.length === 0 && (
        <Card className="text-center">
          <p className="font-body text-sm text-muted">
            No Patterns are playable yet. A Pattern becomes playable once its reference solution has
            been run against its own tests.
          </p>
        </Card>
      )}

      <ul className="flex flex-col gap-4">
        {patterns.map((pattern) => (
          <li key={pattern.slug}>
            <PatternSummary
              pattern={pattern}
              pending={pending}
              onStart={() => onStart(pattern.slug)}
            />
          </li>
        ))}
      </ul>

      {selectedFamily && patterns.length === 0 && (
        <p className="text-center font-body text-sm text-muted">
          Nothing at that Seniority in this Family yet.
        </p>
      )}

      <div className="flex justify-center">
        <Button variant="secondary" onClick={onLeave}>
          Change Discipline
        </Button>
      </div>
    </section>
  );
}

/** One Pattern as it reads before you commit to it: what it teaches, and how hard. */
function PatternSummary({
  pattern,
  onStart,
  pending,
}: {
  pattern: Pattern;
  onStart: () => void;
  pending: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-md tracking-wide text-heading">{pattern.name}</h2>
          <div className="flex flex-wrap gap-2">
            <PatternTags pattern={pattern} />
          </div>
        </div>
        <Button disabled={pending} onClick={onStart}>
          {pending ? "Dealing you a Pattern" : "Solve"}
        </Button>
      </div>

      {/* The first paragraph only. The whole prompt is on the solve screen, and
          a browse list where every entry is six lines long is a list nobody
          scans. */}
      <p className="font-body text-sm leading-snug text-ink-2">{firstParagraph(pattern.prompt)}</p>
    </Card>
  );
}

function firstParagraph(prompt: string): string {
  return prompt.split("\n\n")[0] ?? prompt;
}

/** The Families that actually have something in them, in the order the server sent them. */
function distinctFamilies(patterns: Pattern[]): Family[] {
  return [...new Set(patterns.map((pattern) => pattern.family))];
}
