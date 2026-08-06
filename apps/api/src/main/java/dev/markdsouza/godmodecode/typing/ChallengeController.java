package dev.markdsouza.godmodecode.typing;

import dev.markdsouza.godmodecode.ratelimit.ClientAddress;
import dev.markdsouza.godmodecode.ratelimit.RateLimits;
import dev.markdsouza.godmodecode.user.RecognitionCookie;
import dev.markdsouza.godmodecode.user.User;
import dev.markdsouza.godmodecode.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Asking for something to do.
 *
 * POST rather than GET, and not because a Passage is being created. Asking for
 * a Challenge writes down that it went out and abandons whatever the player was
 * holding before — a GET that a prefetcher, a crawler or the browser's back
 * button could repeat would quietly throw away a Challenge somebody was
 * mid-way through reading.
 */
@RestController
@RequestMapping("/api/challenges")
@Tag(name = "Challenges", description = "Being handed something to type")
public class ChallengeController {

    private final ChallengeService challenges;
    private final UserService users;
    private final RateLimits rateLimits;

    ChallengeController(ChallengeService challenges, UserService users, RateLimits rateLimits) {
        this.challenges = challenges;
        this.users = users;
        this.rateLimits = rateLimits;
    }

    @PostMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Be handed a Passage to transcribe",
            description = """
                    Records an Issue against the User — who got what, when, and until when — and \
                    returns the Passage. Which Passage arrives is the server's choice.

                    Asking again abandons the Challenge the User was holding, so a player can skip \
                    a Passage they do not fancy, and nobody can hold several at once and submit \
                    whichever went best (ADR-0003).
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "201",
                description = "The Challenge, and when it stops being answerable",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = Challenge.class))),
        @ApiResponse(
                responseCode = "401",
                description = "This browser is nobody yet — create a User first",
                content = @Content),
        @ApiResponse(
                responseCode = "404",
                description = "That Discipline has no Passages. Code never will (ADR-0004)",
                content = @Content),
        @ApiResponse(
                responseCode = "429",
                description = "Too many Challenges have been asked for by this User or from this address recently",
                content = @Content)
    })
    public ResponseEntity<Challenge> request(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey,
            @Valid @RequestBody ChallengeRequest request,
            HttpServletRequest httpRequest) {

        Optional<User> user = Optional.ofNullable(recognitionKey).flatMap(users::recognise);
        if (user.isEmpty()) {
            // A Run has to belong to somebody (ADR-0007), and there is nobody
            // here yet. The frontend creates a User on first load, so this is
            // the answer for a request that skipped the site rather than for a
            // visitor who did something wrong.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (!rateLimits.allowChallengeIssuing(user.get().id(), ClientAddress.of(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }

        return challenges
                .issueTo(user.get().id(), request.discipline())
                .map(challenge -> ResponseEntity.status(HttpStatus.CREATED).body(challenge))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping
    @Operation(
            summary = "Give up the Challenge you are holding",
            description = """
                    Voids whatever Challenge this User is holding, without recording a Run against \
                    it. Leaving mid-Run (the Escape key) calls this so the Issue stops being live \
                    immediately, rather than sitting live until the next Challenge is requested.

                    Answers 204 whether or not anything was actually live to give up, so a player \
                    who has already finished, or never started, is not told anything went wrong.
                    """)
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Nothing is live for this User anymore", content = @Content),
        @ApiResponse(
                responseCode = "401",
                description = "This browser is nobody yet",
                content = @Content)
    })
    public ResponseEntity<Void> abandon(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey) {
        Optional<User> user = Optional.ofNullable(recognitionKey).flatMap(users::recognise);
        if (user.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        challenges.abandon(user.get().id());
        return ResponseEntity.noContent().build();
    }
}
