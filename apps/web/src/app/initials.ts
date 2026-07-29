/**
 * The two letters an avatar tile shows for a Handle: the initial of each word.
 *
 * `PERCOLATING_FERRET` gives PF, and `SPIRALING_MANTIS_2` still gives SM — the
 * collision suffix is bookkeeping, not part of who someone is.
 *
 * Here rather than beside either tile that uses it. The header and the profile
 * draw the same person, and two copies of this would be two rules for what
 * somebody's initials are.
 */
export function initialsFor(handle: string): string {
  return handle
    .split("_")
    .map((word) => word.charAt(0))
    .filter((letter) => /[A-Za-z]/.test(letter))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
