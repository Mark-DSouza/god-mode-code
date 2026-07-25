package dev.markdsouza.godmodecode.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
@Tag(name = "Users", description = "Identity, Claimed or otherwise")
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
                    the cookie that recognises this browser as them on later visits. Called by a \
                    visitor who arrives without one; nothing is asked of them.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "201",
                description = "The Unclaimed User that was created",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = User.class)))
    })
    public ResponseEntity<User> create() {
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
        return Optional.ofNullable(recognitionKey)
                .flatMap(users::recognise)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
