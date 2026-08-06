package dev.markdsouza.godmodecode.typing;

import dev.markdsouza.godmodecode.integrity.Rejection;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Submitting a finished Run, and being told what it was actually worth.
 */
@RestController
@RequestMapping("/api/typing-runs")
@Tag(name = "Typing Runs", description = "Runs against a Passage, verified server-side")
public class TypingRunController {

    private final TypingRunService runs;
    private final UserService users;
    private final RateLimits rateLimits;

    TypingRunController(TypingRunService runs, UserService users, RateLimits rateLimits) {
        this.runs = runs;
        this.users = users;
        this.rateLimits = rateLimits;
    }

    @PostMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Submit a finished Run for Verification",
            description = """
                    Takes raw data — the text as typed, the keystroke count, the two timestamps — \
                    and recomputes WPM and Accuracy from it. The request body has nowhere to put a \
                    client-computed metric, because none would be believed (ADR-0003).

                    A refusal is 422 with a machine-readable reason, not a 400: the request was \
                    well formed and was understood, and it is the Run that did not survive.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "201",
                description = "The Run as the server computed it",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = TypingRun.class))),
        @ApiResponse(
                responseCode = "401",
                description = "This browser is nobody yet",
                content = @Content),
        @ApiResponse(
                responseCode = "422",
                description = "The Run was not recorded, and why",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = Rejection.class))),
        @ApiResponse(
                responseCode = "429",
                description = "Too many Runs have been submitted by this User or from this address recently",
                content = @Content)
    })
    // A wildcard because the two documented answers carry different bodies: a
    // TypingRun on 201, a Rejection on 422. The alternative is to throw for the
    // refusal and catch it in an @ExceptionHandler, which would buy a tighter
    // signature by making an expected result into an exception. The response
    // schemas are not lost — they are declared above and pinned by
    // OpenApiContractTest against the committed document.
    public ResponseEntity<?> submit(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey,
            @Valid @RequestBody TypingRunSubmission submission,
            HttpServletRequest request) {

        Optional<User> user = Optional.ofNullable(recognitionKey).flatMap(users::recognise);
        if (user.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (!rateLimits.allowRunSubmission(user.get().id(), ClientAddress.of(request))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }

        return switch (runs.submit(user.get().id(), submission)) {
            case TypingRunService.Submitted.Recorded recorded ->
                ResponseEntity.status(HttpStatus.CREATED).body(recorded.run());
            case TypingRunService.Submitted.Refused refused ->
                ResponseEntity.unprocessableEntity().body(Rejection.of(refused.reason()));
        };
    }
}
