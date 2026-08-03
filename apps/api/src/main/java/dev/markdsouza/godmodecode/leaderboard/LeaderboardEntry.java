package dev.markdsouza.godmodecode.leaderboard;

import dev.markdsouza.godmodecode.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * One User's standing on one Leaderboard: their best Run, and where it puts
 * them.
 *
 * The whole {@link User} rather than a Handle, because a row has to be able to
 * say who it is about. The record already carries exactly what a public ranking
 * may show — a public id, a Handle, and whether credentials are attached — and
 * carries nothing it may not: the Recognition Key is a separate secret and was
 * deliberately never the id (V2).
 *
 * {@code claimed} rides along and changes nothing about the ranking. An
 * Unclaimed User is a User (ADR-0007), so they are ranked identically and
 * appear in the same list; the flag is here because a screen may eventually
 * want to mark its own state, not because the ordering consults it.
 *
 * @param position where this User stands, counting ties as equal — two Users on
 *                 the same WPM both read 2, and the next reads 4. Standard
 *                 competition ranking, because the alternative would tell the
 *                 slower of two tied players they came third when nobody beat
 *                 them.
 * @param wpm      the WPM of this User's best Run on this Challenge, not of
 *                 their most recent one. Only the best counts, so one fast
 *                 typist replaying a Passage all afternoon occupies one row
 *                 rather than the whole top ten.
 * @param accuracy the Accuracy of that same Run — the Run's own figure, not the
 *                 User's best Accuracy, which would be a number from a different
 *                 attempt sitting on this one's row.
 */
@Schema(description = "One User's best Run on one Challenge, and where it ranks")
public record LeaderboardEntry(
        @Schema(description = "Standing, with ties sharing a position", example = "2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int position,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) User user,
        @Schema(description = "WPM of this User's best Run on this Challenge", example = "141.0",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                BigDecimal wpm,
        @Schema(description = "Accuracy of that same Run", example = "98.7",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                BigDecimal accuracy) {}
