package dev.markdsouza.godmodecode.profile;

import dev.markdsouza.godmodecode.judge.Verdict;
import dev.markdsouza.godmodecode.typing.Discipline;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One Run in a User's history, whichever kind of Run it was.
 *
 * Deliberately not a Run. {@link dev.markdsouza.godmodecode.typing.TypingRun}
 * and {@link dev.markdsouza.godmodecode.pattern.SolveRun} are separate
 * aggregates with no shared supertype (ADR-0006), and this is not an attempt to
 * give them one — it is the flat row a timeline draws, built from both of them
 * in the service layer and owned by neither. Nothing writes it and nothing
 * dispatches on it.
 *
 * @param discipline which Discipline the Run was in. {@code CODE} means it was a
 *                   Solve Run, because the Code Discipline is Patterns and
 *                   nothing else (ADR-0004) — there is no separate kind field to
 *                   disagree with it.
 * @param verdict    the Solve Run's Verdict, and null for a Typing Run. A Typing
 *                   Run cannot fail, so it has nothing to put here; a history
 *                   that omitted this would show a Failed Run as an achievement.
 */
@Schema(description = "One Run in a User's history, of either kind")
public record HistoryEntry(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID runId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Discipline discipline,
        @Schema(example = "118.4", requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal wpm,
        @Schema(description = "The Verdict, for a Solve Run. Absent for a Typing Run.") Verdict verdict,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant completedAt) {}
