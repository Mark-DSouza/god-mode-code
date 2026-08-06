package dev.markdsouza.godmodecode.user;

import dev.markdsouza.godmodecode.config.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Arriving, and being recognised on the way back.
 *
 * Two endpoints rather than one "get or create", because the two are not the
 * same request: reading the current User is safe and repeatable, creating one is
 * neither. Collapsing them would mean a prefetch, a retry or a crawler each
 * leaving a User behind.
 */
@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "Anyone who has played, Claimed or otherwise")
public class UserController {

    private final UserService users;
    private final RecognitionCookie cookie;

    UserController(UserService users, RecognitionCookie cookie) {
        this.users = users;
        this.cookie = cookie;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Create an Unclaimed User",
            description = """
                    Creates a User with no credentials attached and a generated Handle, and sets \
                    the cookie that recognises this browser as them on later visits. Nothing is \
                    asked of the visitor.

                    A browser that already holds a valid cookie is told who it is instead, with \
                    200 — so a retry, a double submit or a second tab cannot strand the Runs the \
                    first User already has.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "201",
                description = "The Unclaimed User that was created",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = User.class))),
        @ApiResponse(
                responseCode = "200",
                description = "This browser was already someone, and still is",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = User.class)))
    })
    public ResponseEntity<User> create(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey) {
        // This is the one request on the site that cannot be safely repeated, and
        // browsers repeat requests. Checking first costs a single indexed lookup
        // and removes the whole class of "reload created a second me".
        Optional<User> alreadySomeone = currentUser(recognitionKey);
        if (alreadySomeone.isPresent()) {
            // No Set-Cookie: the browser already holds the right key, and
            // reissuing one can only lose it.
            return ResponseEntity.ok(alreadySomeone.get());
        }

        UserService.Arrival arrival = users.createUnclaimedUser();
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, cookie.carrying(arrival.recognitionKey()).toString())
                .body(arrival.user());
    }

    @GetMapping(path = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Read the User this browser is",
            description = """
                    Returns the User the request's cookie identifies. 404 means this browser has \
                    never been here, or was here longer ago than the cookie lasts — the caller's \
                    cue to create one.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "The User this browser is recognised as",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = User.class))),
        @ApiResponse(
                responseCode = "404",
                description = "This browser is nobody yet",
                content = @Content)
    })
    public ResponseEntity<User> me(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey) {
        // A cookie that no longer matches a row is treated exactly like no cookie
        // at all: the User it named is gone, and the caller should create one
        // rather than be told about a database that no longer holds them.
        return currentUser(recognitionKey).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(path = "/claim", produces = MediaType.APPLICATION_JSON_VALUE)
    @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    @Operation(
            summary = "Claim the User this browser is",
            description = """
                    Attaches the identity provider's credentials to the User this browser is \
                    recognised as, choosing the Handle given in the request body (ADR-0011).

                    If those credentials already belong to a different User, this browser's Runs \
                    are merged into that User instead — silently and always, because Runs are \
                    append-only facts with no conflict to resolve (ADR-0007) — and the response \
                    carries a fresh cookie recognising this browser as the account it was merged \
                    into.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "Claimed, or merged into an existing account",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = User.class))),
        @ApiResponse(
                responseCode = "404",
                description = "This browser is nobody yet — there is no User here to Claim",
                content = @Content),
        @ApiResponse(
                responseCode = "409",
                description = "The chosen Handle is already taken",
                content = @Content),
        @ApiResponse(responseCode = "401", description = "No valid bearer token was presented", content = @Content)
    })
    public ResponseEntity<User> claim(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ClaimRequest request) {
        Optional<User> source = currentUser(recognitionKey);
        if (source.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        UserService.ClaimResult result = users.claim(source.get(), jwt.getSubject(), request.handle());
        return switch (result) {
            case UserService.ClaimResult.HandleTaken() -> ResponseEntity.status(HttpStatus.CONFLICT).build();
            // Same status as a taken Handle: both mean "this request cannot
            // proceed as asked", and this browser is unreachable from the
            // shipped UI in the first place — signing in is only ever
            // offered to an Unclaimed User (ADR-0007).
            case UserService.ClaimResult.NotYourCredential() -> ResponseEntity.status(HttpStatus.CONFLICT).build();
            case UserService.ClaimResult.Claimed(User user, Optional<String> newRecognitionKey) -> {
                ResponseEntity.BodyBuilder response = ResponseEntity.ok();
                // Only present for a merge: a first-time claim leaves this
                // browser recognised as the same row it already was, and
                // reissuing the cookie it already correctly holds can only
                // risk losing it.
                newRecognitionKey.ifPresent(
                        key -> response.header(HttpHeaders.SET_COOKIE, cookie.carrying(key).toString()));
                yield response.body(user);
            }
        };
    }

    /** The User a possibly-absent cookie value names, if it names one still on file. */
    private Optional<User> currentUser(String recognitionKey) {
        return Optional.ofNullable(recognitionKey).flatMap(users::recognise);
    }
}
