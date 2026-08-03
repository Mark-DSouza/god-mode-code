package dev.markdsouza.godmodecode.leaderboard;

import dev.markdsouza.godmodecode.typing.Discipline;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

/**
 * A ranking of Users by their best result on one Challenge.
 *
 * Per Challenge, never per Discipline and never across Disciplines
 * (CONTEXT.md). A Discipline's ranking is a different question with a different
 * rule — the average of a User's best Run on each of at least five distinct
 * Challenges — and would be a different payload from a different endpoint.
 *
 * Derived at query time and stored nowhere, for the same reason a Personal Best
 * is: a materialised ranking is a second answer to a question the Runs already
 * answer, and Claiming moves Runs between Users, which would leave every
 * precomputed figure on both sides wrong.
 *
 * @param entries              the top of the ranking, best first, and empty
 *                             when the Challenge has not been attempted by
 *                             enough people to have one worth showing. Empty is
 *                             not an error: the Challenge exists and the screen
 *                             has a Discipline-level fallback to offer instead.
 * @param you                  the requesting User's own row, wherever they
 *                             stand — inside {@code entries} or far below it.
 *                             Sent separately rather than only in the list so a
 *                             screen can pin it into view without fetching a
 *                             second page to find out where it went. Null when
 *                             this browser is nobody, or is somebody who has not
 *                             attempted this Challenge.
 * @param participants         how many distinct Users have a Run on this
 *                             Challenge — the population being ranked, not the
 *                             number of Runs, because one player's afternoon of
 *                             replays is one participant.
 * @param minimumParticipants  how many it takes before the ranking is shown at
 *                             all. Published rather than hidden in the server so
 *                             the fallback can say what it is waiting for
 *                             instead of leaving a blank space.
 */
@Schema(description = "A ranking of Users by their best Run on one Challenge, derived at query time")
public record Leaderboard(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID passageId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Discipline discipline,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<LeaderboardEntry> entries,
        @Schema(description = "The requesting User's own row, wherever they stand") LeaderboardEntry you,
        @Schema(description = "Distinct Users with a Run on this Challenge", example = "37",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int participants,
        @Schema(description = "Distinct Users needed before the ranking is shown", example = "5",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int minimumParticipants) {}
