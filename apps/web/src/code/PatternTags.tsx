import type { Pattern } from "@gmc/api-client";
import { Badge } from "../design-system/index.ts";
import { FAMILIES, SENIORITIES, SENIORITY_TONE } from "./families.ts";

/**
 * What a Pattern is and how hard it is, as two chips.
 *
 * One component rather than the same pair of Badges written on both screens, so
 * a Pattern is labelled identically wherever it appears — the browse list is
 * where you choose one by its Family and Seniority, and the solve screen is
 * where you check you got the one you meant.
 */
export function PatternTags({ pattern }: { pattern: Pattern }) {
  return (
    <>
      <Badge tone="neutral">{FAMILIES[pattern.family]}</Badge>
      <Badge tone={SENIORITY_TONE[pattern.seniority]}>{SENIORITIES[pattern.seniority]}</Badge>
    </>
  );
}
