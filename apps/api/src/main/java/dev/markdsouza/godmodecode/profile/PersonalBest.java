package dev.markdsouza.godmodecode.profile;

import dev.markdsouza.godmodecode.typing.Discipline;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * A User's highest WPM within one Discipline.
 *
 * Derived from their Runs every time it is asked for, and stored nowhere. A
 * materialised copy would be a second answer to a question the Runs already
 * answer, and the two would eventually disagree — most likely during the merge
 * that Claiming performs, which moves Runs between Users and would leave every
 * precomputed figure on both sides wrong.
 *
 * The per-Pattern half of the definition — the fastest Passed Solve Run for one
 * Pattern (CONTEXT.md) — is not this. That belongs to a Pattern's Leaderboard,
 * and this is a Discipline-wide reading of one User.
 *
 * @param wpm the highest WPM recorded in this Discipline. For Code that is the
 *            highest among Passed Solve Runs only: a Failed Run is a recorded
 *            Run but not a ranked one.
 */
@Schema(description = "A User's highest WPM within one Discipline, derived from their Runs")
public record PersonalBest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Discipline discipline,
        @Schema(example = "148.0", requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal wpm) {}
