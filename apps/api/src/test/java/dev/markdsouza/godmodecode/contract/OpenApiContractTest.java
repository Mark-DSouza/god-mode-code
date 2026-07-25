package dev.markdsouza.godmodecode.contract;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;

/**
 * The backend owns the API contract, and the frontend's types are generated
 * from it. This is the gate that keeps the committed copy honest.
 *
 * Run normally, it fails if the document the application serves differs from
 * the one in the repository. Run with {@code -Dgmc.contract.write=true} it
 * rewrites that file instead — which is what {@code scripts/generate-contract.sh}
 * does.
 *
 * Regenerating in CI and diffing would catch the same drift, but only after a
 * push. Failing here means a developer who changes a response shape finds out
 * from the test suite they were already running.
 */
class OpenApiContractTest extends AbstractIntegrationTest {

    /** Relative to the api module, which is the working directory under Surefire. */
    private static final Path COMMITTED_CONTRACT =
            Path.of("..", "..", "packages", "api-client", "openapi.json");

    private static final ObjectMapper JSON = new ObjectMapper()
            // Sorted keys and a stable indent, so the committed file changes
            // only when the contract does — not because Spring happened to
            // register two controllers in a different order.
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
            .enable(SerializationFeature.INDENT_OUTPUT);

    @Autowired
    TestRestTemplate http;

    @Test
    @DisplayName("the committed contract matches the document the backend serves")
    void contractIsInSync() throws Exception {
        String served = canonicalise(http.getForObject("/api/openapi", String.class));

        if (Boolean.getBoolean("gmc.contract.write")) {
            Files.createDirectories(COMMITTED_CONTRACT.getParent());
            Files.writeString(COMMITTED_CONTRACT, served, StandardCharsets.UTF_8);
            return;
        }

        assertThat(COMMITTED_CONTRACT)
                .as("the API contract has never been generated — run scripts/generate-contract.sh")
                .exists();

        assertThat(canonicalise(Files.readString(COMMITTED_CONTRACT, StandardCharsets.UTF_8)))
                .as("""
                        The OpenAPI document served by the backend differs from the one committed \
                        at packages/api-client/openapi.json. Run scripts/generate-contract.sh and \
                        commit the result, so the frontend's generated types match the backend.
                        """)
                .isEqualTo(served);
    }

    @Test
    @DisplayName("the contract describes the health endpoint under /api")
    void describesTheHealthEndpoint() {
        JsonNode document = readServedDocument();

        assertThat(document.at("/paths/~1api~1health/get").isMissingNode()).isFalse();
        // The single relative server entry is what keeps generated clients from
        // baking in a hostname (ADR-0002).
        assertThat(document.at("/servers/0/url").asText()).isEqualTo("/");
    }

    private JsonNode readServedDocument() {
        try {
            return JSON.readTree(http.getForObject("/api/openapi", String.class));
        } catch (Exception e) {
            throw new IllegalStateException("Could not read the served OpenAPI document", e);
        }
    }

    private static String canonicalise(String json) throws Exception {
        return JSON.writeValueAsString(JSON.readTree(json)) + "\n";
    }
}
