package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.integrity.Rejection;
import dev.markdsouza.godmodecode.user.RecognitionCookie;
import dev.markdsouza.godmodecode.user.User;
import dev.markdsouza.godmodecode.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
 * Submitting a finished Solve Run, and being told what the judge made of it.
 */
@RestController
@RequestMapping("/api/solve-runs")
@Tag(name = "Solve Runs", description = "Runs against a Pattern, judged by execution")
public class SolveRunController {

    private final SolveRunService runs;
    private final UserService users;

    SolveRunController(SolveRunService runs, UserService users) {
        this.runs = runs;
        this.users = users;
    }

    @PostMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Submit a finished Solve Run to be judged",
            description = """
                    Takes the lines that were written, assembles them with the Pattern's Scaffold, \
                    and has the judge execute the result against every one of the Pattern's tests. \
                    The Verdict comes back from that execution; the duration and the WPM are \
                    recomputed from the raw submission (ADR-0003).

                    A Failed Verdict is a 201. The Solve Run happened, it is recorded, and it \
                    belongs to the player — a Solve Run can fail, which is the difference between \
                    it and a Typing Run (ADR-0006).

                    422 is a submission that was not recorded at all, with the reason. 503 is the \
                    judge being unreachable: no Verdict exists, nothing about the submitted source \
                    can be concluded, and the Issue is left unspent so the same lines can be sent \
                    again.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "201",
                description = "The Solve Run as judged and recorded, whatever the Verdict",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = SolveRun.class))),
        @ApiResponse(
                responseCode = "401",
                description = "This browser is nobody yet",
                content = @Content),
        @ApiResponse(
                responseCode = "422",
                description = "The Solve Run was not recorded, and why",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = Rejection.class))),
        @ApiResponse(
                responseCode = "503",
                description = "There is no Verdict to be had. Only the Code Discipline is affected",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = Unjudged.class)))
    })
    // A wildcard because the three documented answers carry three different
    // bodies. The schemas are declared above and pinned by OpenApiContractTest
    // against the committed document, so nothing is lost by the signature.
    public ResponseEntity<?> submit(
            @CookieValue(name = RecognitionCookie.NAME, required = false) String recognitionKey,
            @Valid @RequestBody SolveRunSubmission submission) {

        Optional<User> user = Optional.ofNullable(recognitionKey).flatMap(users::recognise);
        if (user.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return switch (runs.submit(user.get().id(), submission)) {
            case SolveRunService.Submitted.Recorded recorded ->
                ResponseEntity.status(HttpStatus.CREATED).body(recorded.run());
            case SolveRunService.Submitted.Refused refused ->
                ResponseEntity.unprocessableEntity().body(Rejection.of(refused.reason()));
            case SolveRunService.Submitted.NotJudged notJudged ->
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(new Unjudged(notJudged.explanation()));
        };
    }
}
