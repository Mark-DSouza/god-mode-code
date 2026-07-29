package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Running the activation gate over the Patterns that have not passed it.
 *
 * The step after a content migration: the migration ships the Patterns, this
 * proves their tests are correct, and only then can anybody be given one. It is
 * a route rather than something the application does at startup because booting
 * must not depend on the judge — a judge outage takes the Code Discipline with
 * it and nothing else (ADR-0005).
 *
 * <h2>On it being open</h2>
 *
 * There is no operator authentication in this application yet. What keeps an
 * open route from being a way to keep the judge busy is that it only ever judges
 * Patterns that are still inactive: once the catalogue is through the gate, this
 * costs one query and starts nothing. It cannot activate anything a curator did
 * not already ship, and it cannot deactivate anything at all.
 */
@RestController
@RequestMapping("/api/patterns/activations")
@Tag(name = "Patterns", description = "The Code Discipline's catalogue")
public class PatternActivationController {

    private final PatternActivationService activations;

    PatternActivationController(PatternActivationService activations) {
        this.activations = activations;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Run the activation gate over every Pattern awaiting it",
            description = """
                    Assembles each inactive Pattern's reference solution with its Scaffold exactly \
                    as a player's submission would be, has the judge execute it, and activates the \
                    Pattern only if the Verdict is Passed and the judge ran as many tests as the \
                    Pattern has.

                    That second condition is not a formality. The judge compiles its catalogue into \
                    its binary and is deployed separately from the database, so the two can skew — \
                    and a judge running an older copy of a Pattern would answer Passed against \
                    fewer tests than the curator wrote, which is true and useless.

                    Answers 200 whatever happened. A Pattern that did not pass is not an error in \
                    this request; it is the gate doing its job, and the body says so per Pattern. \
                    Already-activated Patterns are not re-judged and are absent from the answer.
                    """)
    @ApiResponse(
            responseCode = "200",
            description = "What the gate made of each Pattern that was awaiting it",
            content = @Content(
                    mediaType = MediaType.APPLICATION_JSON_VALUE,
                    array = @ArraySchema(schema = @Schema(implementation = PatternActivation.class))))
    public List<PatternActivation> activate() {
        return activations.activateWhatIsPending();
    }
}
