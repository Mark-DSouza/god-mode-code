package dev.markdsouza.godmodecode.judge;

/**
 * One Solve Run's submitted source and the Pattern it answers.
 *
 * The request half of the judge's contract. Deliberately not a domain type: the
 * Solve Run aggregate is the backend's (ADR-0006), and this is only what crosses
 * the wire to a service that knows nothing about Runs.
 *
 * @param patternId which Pattern the source is answering.
 * @param source    the player's submitted source, scaffold excluded.
 */
public record SubmittedSource(String patternId, String source) {}
