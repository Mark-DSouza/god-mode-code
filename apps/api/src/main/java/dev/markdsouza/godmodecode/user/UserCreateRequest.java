package dev.markdsouza.godmodecode.user;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * What a browser sends when it asks to become an Unclaimed User.
 *
 * Empty in every environment without a Turnstile site configured — the
 * frontend never renders the widget there (the same posture ADR-0011 takes
 * toward sign-in), and {@link TurnstileVerifier} treats a blank token exactly
 * like a missing body in that case.
 */
@Schema(description = "What creating an Unclaimed User asks the widget to prove, if this deployment has one")
public record UserCreateRequest(
        @Schema(description = "The Cloudflare Turnstile widget's token, absent where no widget is configured")
                String turnstileToken) {}
