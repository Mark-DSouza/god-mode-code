package dev.markdsouza.godmodecode.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The OpenAPI document is the contract the typed frontend client is generated
 * from, and CI fails on any drift between the two.
 */
@Configuration
public class OpenApiConfig {

    /** Referenced by name from {@code UserController.claim}. */
    public static final String BEARER_AUTH = "bearerAuth";

    @Bean
    OpenAPI godModeCodeOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("GOD_MODE_CODE API")
                        .version("0.0.1")
                        .description("Backend for GOD_MODE_CODE."))
                // A single relative server entry, because the API is only ever
                // reachable at the same origin as the app that calls it
                // (ADR-0002). Emitting an absolute URL here would put a
                // hostname into generated clients and invite a second origin.
                .servers(List.of(new Server().url("/").description("Same origin as the application")))
                .components(new Components()
                        .addSecuritySchemes(
                                BEARER_AUTH,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description(
                                                "The identity provider's ID token, validated by the backend as a resource server (ADR-0011).")));
    }
}
