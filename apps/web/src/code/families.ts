import type { Family, Seniority } from "@gmc/api-client";

/**
 * How each Family and Seniority is written for a person.
 *
 * The wording lives here rather than on the server. The backend's vocabulary is
 * `SLIDING_WINDOW`, which is what a Pattern belongs to; "Sliding Window" is how
 * a tab is labelled, and shortening a label or translating one should not need
 * a deploy of the API.
 *
 * Every value is present, including Families nothing has been written for yet,
 * so no screen has to guard a lookup: a Pattern's Family comes back from the
 * server and can simply be asked for its name.
 */
export const FAMILIES: Record<Family, string> = {
  HASH_MAP: "Hash Map",
  TWO_POINTERS: "Two Pointers",
  SLIDING_WINDOW: "Sliding Window",
  STACK: "Stack",
  HEAP: "Heap",
  BINARY_SEARCH: "Binary Search",
  GRAPH: "Graph",
  DYNAMIC_PROGRAMMING: "Dynamic Programming",
};

export const SENIORITIES: Record<Seniority, string> = {
  JUNIOR: "Junior",
  SENIOR: "Senior",
  PRINCIPAL: "Principal",
};

/** The order the bands are offered in, which is the order they get harder. */
export const SENIORITY_ORDER = [
  "JUNIOR",
  "SENIOR",
  "PRINCIPAL",
] as const satisfies readonly Seniority[];

/** Junior green, Senior amber, Principal red — the ramp the design system uses everywhere. */
export const SENIORITY_TONE = {
  JUNIOR: "green",
  SENIOR: "warning",
  PRINCIPAL: "error",
} as const satisfies Record<Seniority, "green" | "warning" | "error">;
