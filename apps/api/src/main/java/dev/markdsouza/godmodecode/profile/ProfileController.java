package dev.markdsouza.godmodecode.profile;

import dev.markdsouza.godmodecode.user.RecognitionCookie;
import dev.markdsouza.godmodecode.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * How the player is doing, for the player themselves.
 *
 * Scoped to the User the cookie identifies, with no id in the path. Somebody
 * else's profile is a different endpoint with different rules about what it may
 * show, and an id parameter here would be an invitation to enumerate Users
 * before those rules exist.
 */
@RestController
@RequestMapping("/api/profile")
@Tag(name = "Profile", description = "Personal Bests and recent Runs, derived from a User's Runs")
public class ProfileController {

    private final ProfileService profiles;
    private final UserService users;

    ProfileController(ProfileService profiles, UserService users) {
        this.profiles = profiles;
        this.users = users;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Read this browser's own profile",
            description = """
                    Personal Bests per Discipline, best Accuracy, recent average, and the most \
                    recent Runs of both kinds interleaved. Every figure is computed from the \
                    User's Runs at the moment of the request; none of it is stored.

                    A User with no Runs is a 200 with empty lists, not a 404. They exist and \
                    have simply not played yet, and the screen has an inviting first-Run state \
                    to show for it.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "The profile of the User this browser is",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = Profile.class))),
        @ApiResponse(
                responseCode = "404",
                description = "This browser is nobody yet",
                content = @Content)
    })
    public ResponseEntity<Profile> mine(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey) {
        return Optional.ofNullable(recognitionKey)
                .flatMap(users::recognise)
                .map(user -> ResponseEntity.ok(profiles.of(user)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
