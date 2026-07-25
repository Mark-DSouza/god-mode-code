package dev.markdsouza.godmodecode.health;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The one endpoint the walking skeleton needs: proof that a browser can reach
 * the backend through the proxy, and that the backend can reach its database.
 */
@RestController
@RequestMapping("/api/health")
@Tag(name = "Health", description = "Liveness and dependency status")
public class HealthController {

    private final HealthService healthService;

    HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    // The produces declaration is not decoration: without it springdoc emits the
    // response under `*/*`, and a generated client then has no content type to
    // key its response type off.
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Report the backend's status and that of its dependencies",
            description = """
                    Returns 200 when every dependency is reachable and 503 when any is not, \
                    so an uptime check can rely on the status code alone rather than parsing \
                    the body.
                    """)
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "Every dependency is reachable",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = HealthStatus.class))),
        @ApiResponse(
                responseCode = "503",
                description = "At least one dependency is unreachable",
                content = @Content(
                        mediaType = MediaType.APPLICATION_JSON_VALUE,
                        schema = @Schema(implementation = HealthStatus.class)))
    })
    public ResponseEntity<HealthStatus> health() {
        HealthStatus status = healthService.check();
        // A degraded backend that answers 200 is worse than one that does not
        // answer: the external uptime monitor would report the site healthy
        // while every request fails.
        return ResponseEntity.status(status.healthy() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                .body(status);
    }
}
