package dev.markdsouza.godmodecode.profile;

import dev.markdsouza.godmodecode.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;

/**
 * What a User can do at their best, where they are lately, and the shape of
 * their recent Runs.
 *
 * A read model and not a person. CONTEXT.md rules "profile" out as a word for a
 * User, and this is not one: it is the answer to "how am I doing", assembled
 * from a User and their Runs at the moment it is asked for and stored nowhere.
 *
 * @param personalBests    one per Discipline the User has a ranked Run in.
 *                         Absent rather than zero for a Discipline never played
 *                         — a best of 0 WPM is a claim about somebody's typing,
 *                         and it would be a false one.
 * @param bestAccuracy     the highest Accuracy of any Typing Run, and null when
 *                         there are none. Solve Runs are not eligible and their
 *                         absence here is the design: there is no target text to
 *                         be accurate against (ADR-0006).
 * @param recentAverageWpm the mean WPM of exactly the Runs in {@code history},
 *                         so the figure and the chart beside it can never
 *                         disagree about which Runs "lately" means. Null when
 *                         there are none.
 * @param history          the most recent Runs of both kinds, newest first.
 */
@Schema(description = "A User's Personal Bests and recent Runs, derived at query time")
public record Profile(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) User user,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PersonalBest> personalBests,
        @Schema(description = "Highest Accuracy across Typing Runs", example = "99.2") BigDecimal bestAccuracy,
        @Schema(description = "Mean WPM across the Runs in history", example = "126.4") BigDecimal recentAverageWpm,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<HistoryEntry> history) {}
