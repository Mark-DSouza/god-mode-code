package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.user.RecognitionCookie;
import dev.markdsouza.godmodecode.user.User;
import dev.markdsouza.godmodecode.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Browsing the catalogue, and asking for one of it.
 *
 * The two verbs differ for the reason they differ everywhere else in this API.
 * Browsing is a GET because looking is free and repeatable; asking for a Pattern
 * is a POST because it records an Issue and abandons whatever Challenge the
 * player was holding, and a prefetcher or a back button must not be able to do
 * that on somebody's behalf.
 */
@RestController
@RequestMapping("/api/patterns")
@Tag(name = "Patterns", description = "The Code Discipline's catalogue")
public class PatternController {

    private final PatternRepository patterns;
    private final SolveChallengeService challenges;
    private final UserService users;

    PatternController(PatternRepository patterns, SolveChallengeService challenges, UserService users) {
        this.patterns = patterns;
        this.challenges = challenges;
        this.users = users;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Browse the Patterns that can be played",
            description = """
                    Every activated Pattern — by Family, then by Seniority, then by name — optionally \
                    narrowed to one Family and one Seniority. Each carries its prompt and its \
                    Example Tests, so a player can read the contract they will be judged against \
                    before starting.

                    Inactive Patterns are absent rather than listed as unavailable. A Pattern is \
                    inactive because nobody has yet proved its tests are correct, and offering one \
                    would be offering a Challenge that might be unwinnable.

                    Hidden Tests are not here, and there is no endpoint that serves them. They \
                    live in the judge's own binary (ADR-0005), and their failure is only ever \
                    reported to a player as a count.
                    """)
    @ApiResponse(
            responseCode = "200",
            description = "The Patterns that match",
            content = @Content(
                    mediaType = MediaType.APPLICATION_JSON_VALUE,
                    array = @ArraySchema(schema = @Schema(implementation = Pattern.class))))
    public List<Pattern> browse(
            @Parameter(description = "Only this Family") @RequestParam(required = false) Family family,
            @Parameter(description = "Only this Seniority") @RequestParam(required = false) Seniority seniority) {
        return patterns.browse(family, seniority);
    }

    @PostMapping(path = "/{slug}/challenges", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Be handed this Pattern to solve",
            description = """
                    Records an Issue against the User — who got what, when, and until when — and \
                    returns the Pattern with its Scaffold and Example Tests.

                    Unlike a Passage, the player names which one. There is nothing to shop for: a \
                    Pattern is a technique to practise, not a score to farm.

                    Asking again abandons whatever Challenge the User was holding, in either \
                    Discipline, so nobody can hold several at once and submit whichever went best \
                    (ADR-0003). The window is flat rather than scaled by length: a Pattern is \
                    answered by thinking, and there is nothing about it to time by the character.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "201",
                description = "The Challenge, and when it stops being answerable",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = SolveChallenge.class))),
        @ApiResponse(
                responseCode = "401",
                description = "This browser is nobody yet — create a User first",
                content = @Content),
        @ApiResponse(
                responseCode = "404",
                description = "No activated Pattern has that slug",
                content = @Content)
    })
    public ResponseEntity<SolveChallenge> request(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey,
            @PathVariable String slug) {

        Optional<User> user = Optional.ofNullable(recognitionKey).flatMap(users::recognise);
        if (user.isEmpty()) {
            // A Run has to belong to somebody (ADR-0007), and there is nobody
            // here yet. The frontend creates a User on first load.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return challenges
                .issueTo(user.get().id(), slug)
                .map(challenge -> ResponseEntity.status(HttpStatus.CREATED).body(challenge))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
