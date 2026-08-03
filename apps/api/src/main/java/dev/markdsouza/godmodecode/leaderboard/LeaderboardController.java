package dev.markdsouza.godmodecode.leaderboard;

import dev.markdsouza.godmodecode.user.RecognitionCookie;
import dev.markdsouza.godmodecode.user.User;
import dev.markdsouza.godmodecode.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where a player stands on the exact Challenge they just attempted.
 *
 * Hung off the Passage rather than gathered under a {@code /api/leaderboards}
 * of its own, because a per-Challenge Leaderboard is a fact about that
 * Challenge and is only ever asked for when you have one in hand — from the
 * result screen, or from a row in a browser. Nobody picks a Passage out of a
 * list of hundreds to see its ranking.
 */
@RestController
@Tag(name = "Leaderboards", description = "Rankings by best Run, per Challenge")
public class LeaderboardController {

    /**
     * How long a Leaderboard may be served from a cache.
     *
     * Long enough that the burst this endpoint actually sees — a player finishing
     * a Run, reading the board, expanding it, and coming back after the next Run
     * — costs the database one query rather than four. Short enough that a Run
     * recorded now appears on the board within the time it takes to type
     * another one. A ranking is not a bank balance; half a minute stale is
     * invisible, and the asker's own new Run arrives on the result screen from
     * the response that recorded it regardless.
     */
    private static final Duration BRIEFLY = Duration.ofSeconds(30);

    private final LeaderboardService leaderboards;
    private final UserService users;

    LeaderboardController(LeaderboardService leaderboards, UserService users) {
        this.leaderboards = leaderboards;
        this.users = users;
    }

    @GetMapping(path = "/api/passages/{passageId}/leaderboard", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Read one Passage's Leaderboard",
            description = """
                    Users ranked by their best Run on this Passage — only their best, so one \
                    fast typist replaying it all afternoon holds one row rather than the top ten. \
                    Tied WPMs share a position.

                    Unclaimed Users are ranked identically to Claimed ones and appear in the same \
                    list (ADR-0007).

                    `entries` is empty until enough distinct Users have attempted the Passage; \
                    `participants` and `minimumParticipants` say how far off that is, so the \
                    caller can fall back to the Discipline rather than show a ranking of two. \
                    `you` carries the requesting User's own row whether or not it is in the \
                    published top, and survives the threshold — it is a fact about their own Run \
                    rather than a claim about a population.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "The ranking, and where the asker stands in it",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = Leaderboard.class))),
        @ApiResponse(responseCode = "404", description = "No such Passage", content = @Content)
    })
    public ResponseEntity<Leaderboard> forPassage(
            @PathVariable UUID passageId,
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey) {

        // A browser that is nobody still gets the board. A ranking is public —
        // it is the one screen a visitor can be shown before they have played
        // anything — and only the pinned row needs to know who is asking.
        UUID viewerId = Optional.ofNullable(recognitionKey)
                .flatMap(users::recognise)
                .map(User::id)
                .orElse(null);

        return leaderboards
                .forPassage(passageId, viewerId)
                .map(leaderboard -> ResponseEntity.ok()
                        .cacheControl(CacheControl.maxAge(BRIEFLY).cachePublic())
                        // The payload carries the asker's own row, so it is not
                        // one response for everybody. Vary is what keeps a shared
                        // cache honest about that: the Recognition Key is the
                        // only cookie this site sets, so the cache key becomes
                        // "this board, for this browser" and a second view by the
                        // same player is the hit this is here for. Without it a
                        // shared cache would serve one player's pinned row to
                        // everybody behind it.
                        .header(HttpHeaders.VARY, HttpHeaders.COOKIE)
                        .body(leaderboard))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
